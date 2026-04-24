# Phase 3: Configuration & Peer Management — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** `/gsd:discuss-phase 3 --auto` — Claude auto-selected the recommended option for every gray area after loading PROJECT.md, REQUIREMENTS.md, STATE.md, Phase 1 and Phase 2 CONTEXT.md, UX-PLAN.md §6f + §7 + §8, kernel `docs/RPC.md` §5.5, and the live codebase. See `03-DISCUSSION-LOG.md` for the alternatives considered per area.

<domain>
## Phase Boundary

Phase 3 gives the user first-class control over every daemon knob pim-daemon exposes for v1 — plus the two surfaces Phase 2 intentionally deferred: static-peer add/remove and log search + snapshot export.

**Ships:**

1. **Settings screen** (new sidebar tab `⌘6`) — a scrollable page with nine collapsible sections in fixed order per `UX-PLAN §6f`:
   1. **Identity** — node name (read-only `node_id`, `public_key`, copy buttons)
   2. **Transport** — interface, MTU, mesh_ip (static / auto), listen port
   3. **Discovery** — broadcast on/off, bluetooth on/off, wifi_direct on/off, auto-connect
   4. **Trust** — authorization policy radio (`allow_all` / `allow_list` / `TOFU`) + trusted-peers list (read-only in Phase 3; editing the list is Phase 4/5 scope beyond `CONF-05`)
   5. **Routing** — (REQ CONF-* don't enumerate routing knobs; Phase 3 exposes only the knobs also referenced by `ROUTE-*` that don't require live routing logic — see **D-19**)
   6. **Gateway** — placeholder section with Linux-only messaging; full gateway controls ship in Phase 5 (`GATE-*`). Phase 3 renders the section header + one-line summary only so the IA is stable.
   7. **Notifications** — the two events `UX-04` + `UX-05` call out (all-gateways-lost, kill-switch-active). Phase 3 wires the toggle state into config but actual notification firing lands in Phase 5 with `UX-04`.
   8. **Advanced — raw config** — full TOML editor with daemon-side `config.save({dry_run: true})` validation, inline per-line errors, preserved edit buffer on reject, "Raw is source of truth" detection.
   9. **About** — UI version, daemon version, kernel repo link, show `source_path`, "crash log" link → Logs tab filtered by `level: error`.

   Each section renders collapsed by default with a one-line summary (e.g. `Discovery: broadcast on, BLE off, 3 trusted peers`) and opens with click or keyboard navigation.

2. **Peers tab content expansion** — the `⌘2` Peers tab stops aliasing the Dashboard peer list (Phase 2 compromise) and becomes a dedicated screen with:
   - The connected-peer list + Nearby-not-paired list from Phase 2 (reused components)
   - **`[ + Add static peer ]`** action row → opens a `Sheet` form (address, mechanism radio, optional label) that calls `peers.add_static`
   - **`[ Remove ]`** action on each static row (rows with `static: true`) → opens confirmation `Dialog` that calls `peers.remove`

3. **Logs tab feature-completion** (now implements `OBS-02 + OBS-03`):
   - **Text search** — debounced client-side filter over the existing Phase 2 in-memory ring buffer
   - **Time-range filter** — dropdown with presets (`Last 5m` / `Last 15m` / `Last 1h` / `All session` / `Custom…`)
   - **`[ Export debug snapshot ]`** button — downloads a single `.json` file containing current `DaemonSnapshot.status` + the last 2000 log entries + UI/session metadata

**Does NOT ship (deferred to later phases):**

- Actual notification firing (toast + OS notification) — Phase 5 (`UX-04` + `UX-05`)
- Command palette `⌘K` access to settings — Phase 5 (`UX-07`)
- Gateway enable toggle + preflight UI — Phase 5 (`GATE-01..04`)
- Menu-bar popover / tray / AppIndicator — Phase 5 (`UX-05..06`)
- Identity key backup/export/import — deferred (BACKUP-01/02)
- Route-internet-via-mesh toggle — Phase 4 (`ROUTE-01/02`)
- Onboarding / solo-mode polish — Phase 4 (`UX-01..03`, `UX-08`)
- Shared trusted-peers list editor (editing the allow-list) — not in `CONF-05` wording; deferred to Phase 4 UX pass or a later settings revision

</domain>

<decisions>
## Implementation Decisions

### Navigation & IA integration

- **D-01:** Add the `Settings` tab to the Phase 2 sidebar shell at the bottom of the main-nav list, keyboard shortcut `⌘6` per `UX-PLAN §4a`. Do NOT add any tabs beyond `Dashboard`, `Peers`, `Routing` (grayed, Phase 4), `Gateway` (grayed, Phase 5), `Logs`, `Settings`. The Phase 2 shell already reserves the grayed Routing/Gateway rows — extend by flipping `Settings` from grayed-reserved to active, and leaving Routing/Gateway grayed.
- **D-02:** The Peers tab (`⌘2`) transitions from "aliased to Dashboard peer list" (Phase 2 D-01 compromise) to a dedicated screen component (`src/screens/peers.tsx`). The Dashboard keeps showing its own connected-peer list — the Peers tab is a **richer** surface with add/remove actions + the full Nearby panel + the Peer Detail slide-over wired to the `PEER-04` surface from Phase 2. The two surfaces share the peer row components but own their own scroll container.
- **D-03:** Settings content is a single long scrollable column (NOT paginated, NOT a left-sub-nav tree). Sections are stacked `CliPanel`s. The collapsed summary line is authoritative at a glance — users don't have to open a section to see its state (direct application of `UX-PLAN §1 P1`).

### Section rendering

- **D-04:** Each settings section wraps in the existing brand `CliPanel` primitive with its title, `[STATUS]` badge, and box-drawing header. Collapse/expand via a new `CollapsibleCliPanel` variant that uses Radix `@radix-ui/react-collapsible` (already a shadcn transitive) as the state primitive — install via shadcn `collapsible.tsx` if not yet present.
- **D-05:** The collapsed summary line lives in the `CliPanel` header area, right of the title. Example: `┌─── DISCOVERY ───┐ broadcast on · BLE off · 3 trusted peers [▸]`. Expanded state replaces the summary with `[▾]` and renders the section body below.
- **D-06:** Keyboard navigation: `Tab` moves between section toggles; `Enter`/`Space` opens/closes; `⌘↑` collapses all; `⌘↓` expands all. (Match the power-keyboard affordance Mira expects.) Omit arrow-key navigation in v1 — not worth the focus-management cost.

### Form controls + validation

- **D-07:** All sections use **`react-hook-form`** (install as a new dependency) for form state, dirty tracking, and validation orchestration. Rationale: needed for per-section dirty state, client-side validation feedback, and uncontrolled inputs (matters for the raw TOML textarea + rapidly-typed fields). Alternative zustand + manual dirty flags is more code for less guarantee.
- **D-08:** Zod is NOT introduced for form validation. Client-side validation is minimal: required-field checks, numeric range hints (port 1-65535, MTU 576-9216), and string trimming. **Authoritative validation is the daemon's `config.save({dry_run: true})` path** — the form calls dry_run before writing. Adding zod would duplicate schema definition (rpc-types.ts already defines the shapes); keep the client permissive and let the daemon be the single validator per `PROJECT.md` "daemon is source of truth" constraint.
- **D-09:** Form control inventory:
  - **Text input** (`src/components/ui/input.tsx` — already installed) for node name, interface name, label-per-peer
  - **Number input** — variant of `Input` with `type="number"` and `step`, min/max — wrap in `src/components/ui/number-input.tsx` (new); use for MTU, listen port
  - **Toggle** (`src/components/ui/switch.tsx` — new shadcn install) for all boolean knobs: broadcast, bluetooth, wifi_direct, auto-connect, notifications-enable
  - **Radio group** (`src/components/ui/radio-group.tsx` — new shadcn install) for trust policy (`allow_all` / `allow_list` / `TOFU`) and mesh_ip mode (`static` / `auto`)
  - **Select** (`src/components/ui/select.tsx` — already present for Phase 2 Logs filter) reused where appropriate
  - **Textarea** — native `<textarea>` wrapped in a monospace container for the raw TOML editor (NOT a rich editor — see D-14)

### Save semantics

- **D-10:** **Per-section save**, NOT app-wide "Save all". Each expanded section renders a `[ Save ]` action row at its bottom that is enabled only when `isDirty === true` for that section's `react-hook-form` instance. Save calls `config.save` with the **full merged config** — the UI reconstructs the complete TOML from (a) the parsed server-returned config, (b) the form's current values for this section's knobs, and (c) any unmapped fields preserved from the original document. See D-15 for the preservation strategy.
- **D-11:** Save flow — two-step with dry-run:
  1. Build the full TOML document locally from the merged state
  2. Call `config.save({ format: "toml", config: <doc>, dry_run: true })` — block UI on result (spinner on Save button)
  3. On dry-run success: call `config.save({ format: "toml", config: <doc>, dry_run: false })` (the real write)
  4. On dry-run reject: surface the daemon's `errors[]` inline per affected field (map `path` to form field), keep the edit buffer (i.e. do NOT reset the form), show a toast `"Daemon rejected settings: {first error.message}"`
  5. On success: toast `"Saved."`; if `requires_restart[]` is non-empty, extend the toast: `"Saved. Restart pim to apply: {requires_restart.join(", ")}"` with a `[ Restart ]` action that calls `daemon.stop()` → `daemon.start()` (Phase 1 commands)
- **D-12:** Raw TOML tab has its own `[ Save ]` flow that skips step 1's document assembly — it saves the textarea buffer verbatim with `dry_run` first. On reject, the daemon's per-line errors render inline **in the editor gutter** next to the offending line (see D-14).
- **D-13:** Unsaved-changes protection — if the user switches section or tab (sidebar change, `Peers`/`Dashboard`/`Logs`), and any section is `isDirty`, render a shadcn `AlertDialog`: `"Discard unsaved changes in {section name}?"` with actions `[ Discard ]` / `[ Stay ]`. Also gate the daemon stop path (Phase 1 `StopConfirmDialog`) — if dirty sections exist, surface the same discard warning before the stop-confirm runs.

### Raw TOML editor

- **D-14:** The raw TOML editor is a **plain `<textarea>` with a left-gutter line-number column**, rendered in `Geist Mono` per brand. **Do NOT introduce CodeMirror, Monaco, Prism, or any syntax-highlighting editor.** Rationale:
  - Bundle discipline — CodeMirror is ~200 KB gzipped, Monaco is ~1 MB. Terminal-aesthetic demands the textarea *look* like a terminal, not a VSCode-lite.
  - Validation is server-side (dry_run). Client-side syntax highlighting adds value only if it catches errors locally — we don't (the daemon does).
  - Matches `UX-PLAN §6f` "full TOML editor, validator, import/export" — the word "editor" is textarea-sufficient in Layer 3.

  Inline error rendering: the gutter shows `⚠` on lines with daemon errors; below each erroring line, a muted `text-destructive` row reads `col {column}: {message}` (single line, no collapsing). Clicking a gutter marker moves the cursor to `(line, column)` in the textarea.

- **D-15:** **"Raw is source of truth" detection** — on every successful save (form OR raw), the UI:
  1. Re-calls `config.get({ format: "toml" })` to get the authoritative doc
  2. Parses the TOML client-side (install **`@iarna/toml`** as a new dependency — ~30 KB gzipped, no native deps, well-tested)
  3. For each form-mapped section, diffs parsed keys against the schema-known keys. If the section's parsed AST contains keys NOT in the form schema (e.g. a `[transport]` subsection has `transport.advanced.reconnect_backoff_ms` which the form doesn't expose), the UI sets `sectionRawIsSourceOfTruth[section] = true` and persists the flag to `localStorage` under `pim-ui.section-raw-wins.{section}`.
  4. On next open of that section, the section body renders a top banner:
     ```
     ┌─ Raw is source of truth ─┐
     │ This section's config    │
     │ has fields the form view │
     │ cannot represent. Edit   │
     │ in the Advanced tab.     │
     └──────────────────────────┘
     ```
     with a `[ Open Advanced ]` button that scrolls Settings to the raw-TOML section.
  5. The flag clears the next time the form save succeeds AND the re-fetched TOML matches the schema.

### Peer add/remove flow

- **D-16:** Add-static-peer form lives on the **Peers tab**, not in Settings. `[ + Add static peer ]` action row at the top of the peer list (above the connected-peers panel). Clicking opens a shadcn `Sheet` (reuse Phase 2 D-15 slide-over shell if installed) on the right side, 480 px wide.
- **D-17:** Form fields:
  - **Address** — text input. Placeholder hints per mechanism: `"192.168.1.5:9000"` for tcp, `"AA:BB:CC:DD:EE:FF"` for bluetooth, `"AA:BB:CC:DD:EE:FF"` for wifi_direct. No client-side format regex (daemon validates with `-32012`); show daemon error inline on reject.
  - **Mechanism** — radio group: `tcp` / `bluetooth` / `wifi_direct`. Default: `tcp`. Mirror the `peers.add_static` params spec.
  - **Label** — optional text input, max 64 chars, monospace, "Nickname (optional)" placeholder.
  - Submit button `[ Add peer ]` (primary); cancel button `[ Cancel ]`.
- **D-18:** On submit: call `peers.add_static({ address, mechanism, label })`. On success, close the sheet; the new peer will appear in the list via the Phase 2 `peers.event { kind: "connected" }` once the handshake completes. If the daemon returns `-32011` (already exists), inline error on the address field: `"That peer is already configured."`. On `-32012`, inline error: `"Address format not recognized by the daemon."`. On `-32602`, surface as toast + log to troubleshoot buffer.
- **D-19:** Remove flow — per connected-peer row with `static: true`, render a small `[ Remove ]` button right-aligned. Click opens a shadcn `AlertDialog`:
  ```
  Remove {label ?? short_id}?
  
  This peer will be removed from pim.toml and disconnected.
  Nearby discovery can re-pair it later.
  ```
  Actions: `[ Remove ]` / `[ Cancel ]`. On confirm, call `peers.remove({ config_entry_id })` — use the `config_entry_id` the daemon returned from `peers.list`. Handle `-32010` (not found) as a race-toast: `"Peer was already removed."`. **Per the ROADMAP success criterion 5** the change must be reflected in the live list within 2s — achieved via the existing Phase 2 `peers.event` subscription, which fires `{ kind: "disconnected" }` before the RPC resolves.
- **D-20:** Non-static peers (discovered + paired via `peers.pair`, `static: false`) do NOT get a `[ Remove ]` button in Phase 3 — removing them would require a different RPC (`peers.unpair` does not yet exist in v1). Defer to a future phase (capture in deferred).

### Logs tab completion

- **D-21:** Text search — render a monospace `<input>` in the Phase 2 Logs filter bar between the level buttons and the peer select. Debounce user input 300 ms. Search is **client-side** (scans the existing Phase 2 `useLogsStream` in-memory ring buffer) using a case-insensitive substring match across `message` + `source` + `peer_short_id`. No regex mode in v1 (complexity creep).
- **D-22:** Time-range filter — render as a `<select>` between the peer select and the `[ Export debug snapshot ]` button. Options: `Last 5 min` / `Last 15 min` / `Last 1 hour` / `All session` / `Custom…`. `Custom…` opens a `Dialog` with two time-of-day inputs (`from` / `to`) defaulting to the oldest and newest entries in the buffer. Filter is **client-side** (the daemon's `logs.subscribe` has no time-range param; only `min_level` + `sources`). Time-filtered rows are hidden from render, not deleted from the buffer.
- **D-23:** `[ Export debug snapshot ]` button — right-aligned in the filter bar. Click assembles a JSON blob synchronously:
  ```typescript
  {
    snapshot_version: 1,
    ui_version: string,             // from package.json
    captured_at: string,            // ISO-8601
    daemon_status: DaemonSnapshot["status"] | null,
    peers: DaemonSnapshot["peers"],
    discovered: DaemonSnapshot["discovered"],
    logs: LogEvent[],               // all entries currently in the ring buffer
    filters_applied: {
      level: LogLevel,
      peer_id: string | null,
      text: string,
      time_range: string,
    }
  }
  ```
  Triggers download via `URL.createObjectURL(new Blob([json], { type: "application/json" }))` → `<a download="pim-debug-snapshot-{ISO}.json">` click → `URL.revokeObjectURL` in microtask. No file system API (that's Tauri-v2 and desktop-only; the Blob approach works in both Tauri and future mobile).
- **D-24:** The snapshot JSON is the same shape the daemon's `pim status --json` + `pim logs --json` would emit concatenated — keep field names snake_case per the Phase 1 convention so pasting the snapshot into a kernel-repo bug report can be diffed against daemon outputs.

### Restart-required UX

- **D-25:** The daemon's `ConfigSaveResult.requires_restart: string[]` must be surfaced honestly — never silently discarded. After a successful save, if `requires_restart.length > 0`:
  1. Show toast `"Saved. Restart pim to apply: {requires_restart.join(", ")}"`.
  2. The toast includes a `[ Restart ]` action.
  3. On click: call `daemon.stop()` (Phase 1 RPC), wait for `DaemonSnapshot.state === "stopped"`, then call `daemon.start()`.
  4. If the user dismisses the toast, the affected sections show a small `⚠ Pending restart: {fields}` line in their collapsed summary until the daemon actually restarts.
- **D-26:** On first render of a section, check `requires_restart` state persisted in `localStorage` (key `pim-ui.pending-restart`). Clear entries from that set whenever a `status.event { kind: "role_changed" }` or an "app startup after daemon restart" event arrives (best proxy we have for "daemon restarted").

### About section

- **D-27:** The About section renders:
  - UI version: `import.meta.env.VITE_APP_VERSION` (populate from `package.json` via Vite's `define`)
  - Daemon version: `rpc.hello` response cached on connection (Phase 1 `RPC-02`)
  - Kernel repo link: `https://github.com/Astervia/proximity-internet-mesh` — opens via Tauri shell `open` (NOT `window.open` — Tauri convention)
  - `source_path` — the `config.get` response's `source_path` field, copyable via a `[ Copy path ]` button
  - Crash log link: `[ Open crash log ]` button → routes to Logs tab with filter `level: error`, time-range `All session`
  - Build hash (short commit) if available via `VITE_APP_COMMIT`

### Settings fetch lifecycle

- **D-28:** Settings-screen data comes from **one** `config.get({ format: "toml" })` call on mount. Parse the returned TOML client-side with `@iarna/toml` into a typed structure. The parsed AST is the single source for every section's form initialization.
- **D-29:** Refetch `config.get` on every successful save (D-11 step 5 implicitly includes this). Do NOT subscribe to a "config changed" event — v1 daemon doesn't emit one; the user is the only writer through this UI, so a save-side refetch is sufficient. If the daemon grows a `config.event` stream later, that's a minor wiring change.
- **D-30:** Non-section refetches: after `peers.add_static` / `peers.remove` success, call `config.get` to pick up the updated `[[peers]]` array and trigger the raw-is-source-of-truth scan. The Peer list itself doesn't wait for this — it updates via the Phase 2 `peers.event` stream.

### Client-side TOML library

- **D-31:** Install `@iarna/toml` at the UI layer. Version pin: `^2.2.5`. Two usages:
  - `TOML.parse(string) → unknown` — for raw→form sync and schema-drift detection
  - `TOML.stringify(object) → string` — for form→raw document assembly (D-10)
  
  Do NOT write a hand-rolled TOML parser. Do NOT use a TOML grammar from Tauri backend (that adds a round-trip; the daemon's own parse is already used via `dry_run`). `@iarna/toml` is the Node-standard JS TOML package, maintained, 0 dependencies, 30 KB.

### Error-path honesty

- **D-32:** Every failure surface points to the Logs tab per `UX-PLAN §6h`:
  - `config.save` reject → toast `"Settings rejected. [Show in Logs →]"` routes to Logs tab filtered by `source: "config"`.
  - `peers.add_static` handshake never completes → the Phase 2 `peers.event { kind: "pair_failed" }` flows through — rely on it; don't double-surface.
  - Network-layer RPC errors (connection dropped while saving) → the Phase 1 `LimitedModeBanner` is the source of truth; the per-section Save button reverts to enabled state so the user can retry after reconnect.

### Claude's Discretion

The following details are **not** locked — the planner/researcher/executor may choose any reasonable implementation without coming back to the user:

- Exact Tailwind classes for section headers, form gaps, and label typography — must stay within the brand token set (`.design/branding/pim/patterns/pim.yml` + `src/globals.css`). No gradients, no border-radius.
- Exact animation timing for section collapse/expand (150–250 ms range is fine). Radix Collapsible's default is acceptable.
- Whether to split `src/screens/settings.tsx` into one file per section or keep them inline — follow the pattern that emerges naturally (>300 LoC per section → split).
- The precise mapping of form field paths to TOML `errors[].path` strings — daemon docs are the oracle; handle the 95% case and fall back to section-level banner for unmapped errors.
- The textarea's exact line-height and gutter width — target ~22 px row, 48 px gutter; tune for readability.
- How `@iarna/toml` failures are surfaced if the daemon ever returns unparseable TOML (shouldn't happen; if it does, banner in the raw-TOML section: `"Couldn't parse TOML returned by daemon. [Show raw →]"`).
- Whether to name the new Peers screen component `src/screens/peers.tsx` or `src/screens/peers/index.tsx` — either is fine.
- Whether the `[ Restart ]` toast action shows a confirmation dialog first — recommended "no" (user already clicked Restart), but executor may add one if it feels safer.
- Whether the Settings tab icon is a gear, `⚙`, or text-only — text-only is strongly recommended (matches brand; monospace labels only per `UX-PLAN §4c`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, plan-checker, executor) MUST read these before planning or implementing.**

### Project-level specs

- `.planning/PROJECT.md` — Core value + stakeholder-locked decisions 2026-04-24 (raw TOML is source of truth; daemon is source of truth; no "Advanced" mode toggle; Layer 1/2/3 disclosure)
- `.planning/REQUIREMENTS.md` — The 11 Phase-3 requirements (`PEER-02/03`, `CONF-01..07`, `OBS-02/03`) and their acceptance-criteria phrasing
- `.planning/ROADMAP.md` — Phase 3 goal + 6 success criteria + boundary vs Phases 2 / 4 / 5

### UX & design

- `docs/UX-PLAN.md` §1 (design principles P1–P5 — **non-negotiable, especially P1 Honest + P3 Daemon-is-source-of-truth + P5 Solo-mode-first-class**)
- `docs/UX-PLAN.md` §3f (Authorization / trust — radio policy model drives `CONF-05`)
- `docs/UX-PLAN.md` §3j (Observability — drives `OBS-02/03`)
- `docs/UX-PLAN.md` §3k (Configuration tier table — L2 vs L3 split for `CONF-*`)
- `docs/UX-PLAN.md` §6f (Settings screen — nine sections in fixed order, one-line summary visible collapsed)
- `docs/UX-PLAN.md` §6h (Error states — daemon crashed, interface down, kill-switch, permission missing)
- `docs/UX-PLAN.md` §7 (Microcopy table — "your address on the mesh", "Couldn't verify this peer", tone rules)
- `docs/UX-PLAN.md` §8 (Progressive disclosure — the three-layer strategy is why Raw TOML lives in Layer 3)
- `docs/creator-brief.md` — Locked decisions
- `.design/branding/pim/patterns/pim.yml` — Brand tokens (colors, typography, spacing, box-drawing characters)
- `.design/branding/pim/patterns/STYLE.md` — Voice contract (declarative, no exclamation marks, no hype)

### Kernel / RPC contract

- `proximity-internet-mesh/docs/RPC.md` §5.2 (`peers.add_static` at line 271, `peers.remove` at line 298, `peers.pair` at line 331 — error codes, result shapes, `config_entry_id` semantics)
- `proximity-internet-mesh/docs/RPC.md` §5.5 (`config.get` at line 490, `config.save` at line 511 — TOML/JSON format, `dry_run`, `errors[]` with `line`/`column`/`path`, `requires_restart[]`, error codes `-32020` / `-32021`)
- `proximity-internet-mesh/docs/RPC.md` §5.6 (`logs.subscribe` / `logs.unsubscribe` — already consumed in Phase 2; Phase 3 adds client-side search + time range over the existing buffer, NOT new RPC calls)
- `docs/research/kernel-study.md` — Exhaustive kernel study; read §config / §peers sections for config-file semantics and static-peer handling

### Phase 1 artifacts (already locked)

- `.planning/phases/01-rpc-bridge-daemon-lifecycle/01-01-SUMMARY.md` — RPC error codes as `as const`, single-listener W1 contract, snake_case wire names, `RpcMethodMap`, Tauri command + event names
- `.planning/phases/01-rpc-bridge-daemon-lifecycle/01-02-SUMMARY.md` — Tauri commands `daemon_call` / `daemon_subscribe` / `daemon_unsubscribe` — Phase 3 uses these unchanged; no new `#[tauri::command]` handlers required
- `.planning/phases/01-rpc-bridge-daemon-lifecycle/01-03-SUMMARY.md` — `useDaemonState` hook, `DaemonSnapshot` shape, B2 `TunPermissionProvider`, W1 fan-out dispatcher
- `.planning/phases/01-rpc-bridge-daemon-lifecycle/01-04-PLAN.md` — Limited-mode surfaces, `DaemonToggle`, `LimitedModeBanner`, `StopConfirmDialog` (Phase 3 reuses `StopConfirmDialog` gating in D-13)
- `src/lib/rpc-types.ts` — Typed RPC contract mirror. Phase 3 imports `ConfigGetParams`, `ConfigGetResult`, `ConfigSaveParams`, `ConfigSaveResult`, `RpcErrorCode.ConfigSaveRejected` (-32021), error code `-32020` (ValidationFailed)
- `src/lib/rpc.ts` — `callDaemon<M>`, `DaemonCommands`, `DaemonEvents`
- `src/lib/daemon-state.ts` — `DaemonSnapshot` shape; Phase 3 consumes unchanged
- `src/hooks/use-daemon-state.ts` — Single global fan-out dispatcher; Phase 3 forms MUST NOT add new `listen(...)` calls outside this hook
- `src/components/brand/cli-panel.tsx` — **Brand hero primitive — every Phase 3 settings section wraps in this (or the collapsible variant)**
- `src/components/brand/status-indicator.tsx` — `PeerState` → glyph mapping; reuse as-is
- `src/components/brand/stop-confirm-dialog.tsx` — Reuse pattern for the Remove-peer AlertDialog (D-19) and unsaved-changes dialog (D-13)
- `src/components/brand/daemon-toggle.tsx` — Reuse for the `[ Restart ]` toast action (D-25) — calls the same `daemon.stop()` → `daemon.start()` sequence
- `src/components/ui/` — shadcn (new-york) `badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx` already installed. Phase 3 adds `switch.tsx`, `radio-group.tsx`, `select.tsx` (if not yet present from Phase 2), `collapsible.tsx`, `sheet.tsx`, `alert-dialog.tsx`, `form.tsx`, `toast.tsx` (or `sonner.tsx`)

### Phase 2 artifacts (in-flight — read whichever exist)

- `.planning/phases/02-honest-dashboard-peer-surface/02-CONTEXT.md` — Sidebar IA with grayed-reserved slots that Phase 3 fills in (D-01)
- `.planning/phases/02-honest-dashboard-peer-surface/02-UI-SPEC.md` — UI design contract for dashboard / peers / logs surfaces — Phase 3's Peers tab and Logs tab extensions MUST remain visually coherent with this spec
- Any Phase 2 PLAN files — if they land before Phase 3 execution, they lock the sidebar shell Phase 3 extends. If they don't exist yet at planning time, Phase 3's planner MUST flag this as a sequencing dependency

### Design system

- `src/globals.css` — Inlined brand tokens (kernel-repo submodule blocked per `STATE.md` blockers); Phase 3 styles use the existing CSS variables — NO new hard-coded colors

### External library docs (for planner context)

- `@iarna/toml` — https://www.npmjs.com/package/@iarna/toml (TOML parse/stringify, 30 KB, 0 deps)
- `react-hook-form` — https://react-hook-form.com/docs (form state, dirty tracking, validation)
- Radix `Collapsible` — https://www.radix-ui.com/primitives/docs/components/collapsible (installed transitively via shadcn)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1 + in-flight Phase 2)

- **`CliPanel`** (`src/components/brand/cli-panel.tsx`): Phase 3 settings sections wrap in a `CollapsibleCliPanel` variant of this.
- **`StatusIndicator`** (`src/components/brand/status-indicator.tsx`): reused for peer rows in the Remove confirmation dialog.
- **`DaemonToggle`** (`src/components/brand/daemon-toggle.tsx`): Phase 3's restart action reuses the underlying stop→start sequence.
- **`StopConfirmDialog`** (`src/components/brand/stop-confirm-dialog.tsx`): pattern-copy for `Remove peer?` (D-19) and `Discard unsaved changes?` (D-13) AlertDialogs.
- **`LimitedModeBanner`** (`src/components/brand/limited-mode-banner.tsx`): already handles the daemon-stopped case; Phase 3 settings respect it (sections disabled when daemon disconnected).
- **`useDaemonState`** (`src/hooks/use-daemon-state.ts`): the single fan-out dispatcher. Phase 3 forms call `callDaemon("config.get", ...)` and `callDaemon("config.save", ...)` directly; do NOT add any `listen(...)` calls outside this hook.
- **`callDaemon<M>`** + `RpcMethodMap` typing (`src/lib/rpc.ts` + `rpc-types.ts`): `config.get` / `config.save` / `peers.add_static` / `peers.remove` are already typed in `RpcMethodMap`.

### Established Patterns

- **Snake_case on the wire, verbatim in TS**: Phase 3 inherits this. Form field names in TypeScript use the daemon's field names (`mesh_ip`, `listen_port`, `auto_connect`, etc.). Display labels use Aria-copy per `UX-PLAN §7`.
- **W1 single-listener contract**: enforced by grep assertion. Phase 3 forms do not introduce new `listen(...)` calls.
- **`as const` over `enum`**: Phase 3 introduces no new enums. All strings (`PeerTransport`, `AuthPolicy`, `MeshIpMode`, `LogLevel`) are literal unions from `rpc-types.ts`.
- **Compile-only type tests**: `rpc-types.test.ts` pattern continues for any new narrow types (e.g. `SettingsSection` discriminator, `PeerAddStaticParams` shape guards).
- **Tailwind via brand tokens, not literal colors**: `text-primary`, `text-accent`, `text-destructive`, `text-muted-foreground`, `bg-popover`, `border-border`. Phase 3 honors this — NO `text-red-500` etc.
- **TDD where behavior is mechanical**: TOML parse/stringify round-trips, diff-detection logic, raw-is-source-of-truth scan, address/port validation — all mechanical and testable. Visual-only components may ship without tests.

### Integration Points

- **`App.tsx`** / sidebar shell (Phase 2): Phase 3 flips Settings from grayed-reserved to active; adds the peer-add action row on Peers tab.
- **`src/screens/settings.tsx`** (new): orchestrates the nine sections + shared `react-hook-form` per-section instance.
- **`src/screens/peers.tsx`** (new): the dedicated Peers screen with add/remove actions.
- **`src/lib/config/`** (new directory): houses `parse-toml.ts`, `assemble-toml.ts`, `schema-diff.ts`, `section-schemas.ts` — the TOML ↔ form orchestration logic.
- **Tauri commands registered in Phase 1 Plan 02** — `daemon_call` / `daemon_subscribe` / `daemon_unsubscribe` are sufficient; no new `#[tauri::command]` handlers required for Phase 3.

### Creative options the architecture enables

- Because the event fan-out lives in one place, the Settings screen can piggyback on the existing `peers.event` stream to update the raw-is-source-of-truth flag whenever `[[peers]]` mutates without a dedicated config-change event.
- The snake_case-verbatim rule makes the debug snapshot export (D-23, OBS-03) trivial — `JSON.stringify(snapshot)` produces bytes identical to `pim status --json` concatenated with `pim logs --json`.
- `@iarna/toml` round-trip stability means a user can open the raw editor, reformat, save → form view recovers cleanly, as long as the parsed AST is unchanged.

</code_context>

<specifics>
## Specific Ideas / References

- **Settings section order and copy** — verbatim from `UX-PLAN §6f`: Identity, Transport, Discovery, Trust, Routing, Gateway, Notifications, Advanced — raw config, About. Do NOT reorder; users scan top-down.
- **One-line summary pattern** — `UX-PLAN §6f` explicitly calls out `"Discovery: broadcast on, BLE off, 3 trusted peers"` as the example. Every summary follows this shape: `{key}: {value} · {key}: {value} · {N} {thing}`. Separator is `·` (middle dot), not `,`.
- **Raw-is-source-of-truth banner wording** — **exactly** `"Raw is source of truth — form view shows a subset"` per `ROADMAP.md` success criterion 4 and `CONF-07`. Do NOT paraphrase.
- **Trust policy radio labels** — `allow_all` renders as `Allow all (trust-on-first-use disabled)`, `allow_list` as `Allow list (only peers in trusted-peers)`, `TOFU` as `Trust on first use (default for mesh discovery)`. The daemon's wire values are lowercase; UI labels are sentence case.
- **`UX-PLAN §7` microcopy** applies to surrounding explanatory text — e.g. the Transport section's "mesh_ip" field label reads `"Your address on the mesh"` with an `ⓘ` tooltip showing `"mesh_ip · the IP address assigned to this node on the pim network"`. Daemon raw field names ARE rendered verbatim inside code-formatted strings in the raw TOML editor and in tooltips.
- **Peer add form copy** — `Sheet` title: `"Add a static peer"`. Address label: `"Peer address"`. Mechanism label: `"How to reach it"`. Label field placeholder: `"Nickname (optional)"`. Primary action: `[ Add peer ]`.
- **Remove peer dialog copy** — verbatim in D-19; mirrors the "state of the system, never blame the user" tone from `UX-PLAN §7`.
- **Debug snapshot filename** — `pim-debug-snapshot-{YYYY-MM-DDTHH-mm-ssZ}.json`. ISO timestamp with colons replaced by hyphens (Windows-safe).
- **The `UX-PLAN §6h` "Daemon crashed" banner** — Phase 3 inherits the Phase 1 `LimitedModeBanner`; Settings sections gray out input rows when banner is active (form values read from cache — last-known `config.get` — but saves are disabled with an inline hint `"Daemon stopped — reconnect to save."`).

</specifics>

<deferred>
## Deferred Ideas

Surfaced during Phase 3 mapping; captured so they don't get lost.

- **Syntax-highlighted TOML editor** (CodeMirror 6 or Monaco) — rejected in D-14 on bundle-size + brand-aesthetic grounds. Revisit if user-testing shows the plain textarea is too painful for the Mira persona.
- **TOML import / export from file** — `UX-PLAN §3k` lists import/export as L3. Phase 3 ships in-app editing only; file-system import/export lands later (not in current v1 requirements list).
- **Identity key regeneration (lock-confirmed)** — `UX-PLAN §6f` Identity section mentions `regenerate (lock-confirmed)`. Not in `CONF-02` (which only covers node name). Defer to a future phase (likely aligned with BACKUP-01/02).
- **Identity backup / export / import** — `BACKUP-01` / `BACKUP-02` explicitly deferred per REQUIREMENTS v2.
- **Allow-list editor** — `CONF-05` says "authorization policy radio + trusted-peers list". Read-only list in Phase 3; editable list (add/remove trusted peers from within Settings, distinct from Peers tab pair flow) lands in Phase 4 or 5 — the Trust section ships with a `[ Edit in Advanced ]` fallback for v1.
- **Config file import/export via UI** — deferred; see TOML import/export above.
- **Settings → Gateway full controls** — Phase 5 (`GATE-01..04`). Phase 3 renders only the section header + Linux-only messaging.
- **Settings → Notifications enforcement** — the UI toggles land in Phase 3, but actual notification firing (`UX-04` toast + `UX-05` system notification for kill-switch / all-gateways-lost) lands in Phase 5.
- **Remove non-static peers** — Phase 3 only exposes remove for `static: true` peers. Removing discovered/paired peers requires an `peers.unpair` RPC that v1 doesn't expose. Defer; file against kernel repo if needed.
- **Command palette `⌘K` for settings** — Phase 5 (`UX-07`).
- **Deep-linking to a specific settings section** — would be useful from Dashboard "Show why" links (e.g. interface-down → link to Settings → Transport). Defer to Phase 4 where the `UX-03` error-state catalogue lands.
- **Real-time collaborative config editing** — explicitly NOT a pim v1 concern (single-user, local-only).
- **Per-field "Reset to default" buttons** — `UX-PLAN §6f` doesn't call this out. Defer to a polish pass.

### Reviewed Todos (not folded)

None — `/gsd:todo match-phase` returned 0 matches for Phase 3.

</deferred>

---

*Phase: 03-configuration-peer-management*
*Context gathered: 2026-04-24 via `/gsd:discuss-phase 3 --auto`*
