# Phase 2: Honest Dashboard & Peer Surface — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** `/gsd:discuss-phase 2 --auto` — auto-selected recommended defaults for every gray area (see `02-DISCUSSION-LOG.md` for alternatives considered).

<domain>
## Phase Boundary

Phase 2 turns the dashboard honest. It is the first surface where a user sees what `pim-daemon` is actually doing — every field on screen is sourced from live JSON-RPC calls and event streams (`status` / `status.event`, `peers.list` / `peers.discovered` / `peers.event`, `logs.event`). Phase 1 delivered the plumbing (Tauri sidecar + typed `callDaemon` + `useDaemonState`); Phase 2 uses it.

**Ships:**

1. A **navigation shell** (sidebar + content pane per `UX-PLAN §4a`) that hosts at minimum `Dashboard` and `Logs` in v1 of this phase; `Peers` reuses the Dashboard peer list for now (dedicated Peers tab is Phase 3 work per REQ traceability — `PEER-02/03` are Phase 3). The shell must accommodate `Routing`, `Gateway`, `Settings` in later phases without re-layout.
2. A **live Dashboard** (`STAT-01..04`, `PEER-01`) laying out: header (node name + status dot + mesh IP/interface/uptime), connected peer list (with honest transport + state), nearby-not-paired section (`PEER-05`), and a metrics strip (forwarded bytes/packets, dropped with reason, peer count, current egress gateway).
3. A **Peer Detail surface** (`PEER-04`) opened from any peer row, showing the full node_id (with short→full reveal on hover), mesh_ip, route hops, last_seen, latency, trust state, and the handshake troubleshoot log — all sourced from RPC.
4. A **Pair Approval modal** (`PEER-06`) that fires when a `peers.event { kind: "discovered" | pair_request }` arrives mid-session, with honest copy and explicit `[ Trust and connect ]` / `[ Decline ]` actions.
5. A **Logs tab** (`OBS-01`) streaming `logs.event` with a level filter (`trace/debug/info/warn/error`) and a peer filter, updating in real time.

**Does NOT ship (belongs to other phases):**

- `peers.add_static` / `peers.remove` form (PEER-02/03 → Phase 3)
- Settings sections, raw TOML editor (CONF-* → Phase 3)
- Log search / time-range filter / debug snapshot export (OBS-02/03 → Phase 3)
- Route-internet-via-mesh toggle semantics (ROUTE-01/02 → Phase 4). The toggle can appear as a visual control in the dashboard if trivial, but it must be disabled with "Routing lands in Phase 4" copy or omitted — never a fake toggle.
- Gateway view (GATE-* → Phase 5)
- Menu-bar popover / tray / command palette (UX-05..07 → Phase 5)
- Onboarding (UX-01 → Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Navigation shell

- **D-01:** Introduce a client-side tab router in `src/App.tsx` using a plain React `useState<"dashboard" | "peers" | "logs" | ...>()` switch with keyboard shortcuts (`⌘1` Dashboard, `⌘2` Peers, `⌘5` Logs per `UX-PLAN §4a`). No `react-router` dependency in v1 — the app has one window, no URL semantics, and router libs drag in history + link components that fight the monospace shell. Revisit when deep-linking or the menu-bar popover (Phase 5) needs to drive navigation from outside the window.
- **D-02:** Sidebar is 240 px wide, fixed, rendered as a `<nav>` with monospace labels and ⌘-shortcut hints per row. Use box-drawing separators (`├──`) consistent with `CliPanel`. Tabs for Phase 2: Dashboard, Peers (aliased to Dashboard peer list for now), Logs. Reserve grayed-out rows for Routing / Gateway / Settings so the shell shape is stable.
- **D-03:** Content pane is a single `<main>` that renders the active screen component; each screen is self-contained and owns its own RPC subscriptions beyond the global `useDaemonState` snapshot.

### Reactive subscription strategy

- **D-04:** Extend `useDaemonState` (Phase 1 Plan 03 scope) to also own the global `status.subscribe` and `peers.subscribe` lifecycles — both are low-volume, app-wide, and the dashboard needs them the moment the window mounts. `logs.subscribe`, by contrast, is high-volume and only meaningful while the Logs tab is visible, so it lives in a dedicated `useLogsStream` hook that subscribes on mount and unsubscribes on unmount.
- **D-05:** Per the W1 single-listener contract (Phase 1 Plan 01 locked decision, `STATE.md`): `src/lib/rpc.ts` registers zero Tauri listeners. The one global `listen(DaemonEvents.rpcEvent, ...)` lives in `useDaemonState`, and it fans out by `event` name to registered handlers via an internal `Map<RpcEventName, Set<Handler>>`. `useLogsStream` registers its handler with that fan-out, not with Tauri directly.
- **D-06:** On `status.event`, re-merge into the existing `DaemonSnapshot.status` — do not re-fetch. On `peers.event { kind: "connected" | "disconnected" | "state_changed" }`, mutate the `snapshot.peers` list in place (produce a new array reference, but diff at the row level). On `peers.event { kind: "discovered" }`, push onto a separate `discovered[]` list that feeds the Nearby section. On `peers.event { kind: "pair_failed" }`, surface as a toast + append to the target peer's troubleshoot log buffer (kept in memory only, not persisted).
- **D-07:** The dashboard must not display any field the daemon hasn't provided yet. On first mount after Phase 1 connection, `useDaemonState` fires one `callDaemon("status", null)` to seed the snapshot, then transitions to event-driven mode. Until the seed resolves, the dashboard shows the existing `LimitedModeBanner` (Phase 1) or a "Loading status…" line — never placeholder zeros.

### Dashboard layout

- **D-08:** Reuse `CliPanel` (the brand hero) as the wrapper for each dashboard section: Identity panel, Peers panel, Nearby panel, Metrics panel. Each panel has its own `┌─── TITLE ───┐` header and `[STATUS]` badge. Panels stack vertically in a single column (no grid) at typical desktop widths; this matches `UX-PLAN §6a`'s ASCII mockup and keeps the Ctrl-F browsing affordance a terminal user expects.
- **D-09:** Identity panel is the top `CliPanel`: first line `█ pim · {node.name}` + `StatusIndicator` at right; second line `mesh: {mesh_ip} · interface {iface.name} · {iface.up ? "up" : "down"} · {uptime}`. When `iface.up === false`, the interface chip flips to `text-destructive` and the line includes `· Show why →` linking to Logs filtered by `source: "transport"`.
- **D-10:** The "Route internet via mesh" toggle is **not** rendered in Phase 2. The success-criteria mockup in `UX-PLAN §6a` shows it on the dashboard, but the toggle's semantics (`route.set_split_default`, pre-flight, honest surfacing) belong to Phase 4 per `ROUTE-01..04` traceability. Omit entirely — do not ship a disabled stub.

### Peer row anatomy

- **D-11:** Each connected peer row is one line of monospace text with fixed-width columns:
  `{short_id}  {label ?? "—"}  {mesh_ip}  via {transport}  {StatusIndicator} {state}  {hops>1 ? "(" + hops + " hops)" : ""}  {latency_ms ? latency_ms + "ms" : ""}  {last_seen_s}s`
  Transport names are the daemon's strings verbatim (`tcp` / `bluetooth` / `wifi_direct` / `relay`). State names verbatim (`active` / `relayed` / `connecting` / `failed`). A relayed peer MUST show `relayed` with `StatusIndicator` `◈ amber`, NEVER `active ◆ green` — this is the phase's non-negotiable honesty test (`ROADMAP §Phase 2 success criterion 3`).
- **D-12:** Row is clickable — click opens the Peer Detail surface. Entire row is the click target; the StatusIndicator glyph has `role="img"` with an `aria-label` of the state name (already implemented in `status-indicator.tsx`).
- **D-13:** Sort order: gateway peers first (`is_gateway: true`), then active, then relayed, then connecting, then failed; within each group, sorted by `label ?? short_id` lexically. Deterministic + user-predictable — don't sort by `last_seen` because that makes the list shuffle on every event.
- **D-14:** Empty connected-peers state renders one line inside the Peers panel: `no peers connected · discovery is active` — never `"Add your first peer!"` infantilizing copy (P5 solo-mode, `UX-PLAN §1 P5`). `[ + Add peer nearby ]` and `[ Invite peer ]` action rows appear below the peer list regardless of whether the list is empty.

### Peer Detail surface

- **D-15:** Peer Detail is a **right-edge slide-over panel** (not a modal, not a full-route detour). Implemented as a shadcn `Dialog` in side-sheet mode (shadcn `Sheet` primitive if available; otherwise a `Dialog` with `side="right"` styling) occupying ~480 px. Dashboard stays visible underneath at reduced opacity. Matches `UX-PLAN §6a` "Peer Detail slide-over" and the "slide-over / detail pane" row in `§3d`.
- **D-16:** Slide-over header: node label + short_id with a `[ show full ]` button that swaps in the full 64-char node_id (all-caps lock-style reveal, clicking again hides). Close via `Esc`, click outside, or `×` glyph in top-right.
- **D-17:** Slide-over body sections, in fixed order:
  1. **Identity** — full node_id (click to copy), short_id, mesh_ip, label (editable post-Phase 3 — Phase 2 shows read-only)
  2. **Connection** — transport, state (with StatusIndicator), hops, last_seen, latency, is_gateway flag
  3. **Trust** — from the PeerSummary: `static` flag (`"configured in pim.toml"` or `"paired via discovery"`). Full trust-state editing is Phase 3 — this surface shows current state only.
  4. **Troubleshoot log** — most recent `peers.event` entries scoped to this peer (last 25, from in-memory buffer; empty state: "No events recorded this session"). If the peer's most recent state is `failed`, pin the last `pair_failed` event at top with its `reason` highlighted in `text-destructive`.
- **D-18:** No `[ Retry ] [ Trust this peer ] [ Forget peer ]` actions in Phase 2 — those call `peers.pair` / `peers.remove` which are Phase 3 (`PEER-02/03`). Render the affordances as grayed-out rows with `"(Phase 3)"` tag, or omit entirely — omit for cleanliness.

### Nearby-not-paired section

- **D-19:** Dedicated `CliPanel` titled `NEARBY — NOT PAIRED` rendered below the connected Peers panel. Always visible (not collapsed) — visibility preserves the user's mental model of "the app is listening for peers." When the discovered list is empty, body reads `no devices discovered yet · discovery is active`.
- **D-20:** Each row: `{label_announced ?? "anonymous"}  {short_id ?? "(no id)"}  via {mechanism}  first seen {first_seen_s}s ago`. Per row, a right-aligned `[ Pair ]` action — clicking opens the Pair Approval modal in **outbound mode** (see D-21). Anonymously-announced entries (null `node_id`) still get a Pair action because the modal shows the warning and lets the user consent (but this is advanced — Phase 2 can choose to hide Pair on anonymous rows; default: hide, defer pairing to a future phase).
- **D-21:** The Pair Approval modal has two trigger paths:
  - **Inbound** — a `peers.event { kind: "discovered" }` arrives that appears to be a pair-handshake (daemon-determined; emitted on the event stream). Modal copy: `"{label_announced ?? short_id} wants to join your mesh."`. Actions: `[ Trust and connect ]` (calls `peers.pair({ node_id, trust: "persist" })`) / `[ Decline ]` (closes modal, no RPC call — daemon times out discovery entry on its own).
  - **Outbound** — user clicks `[ Pair ]` on a Nearby row. Modal copy: `"Pair with {label ?? short_id} via {mechanism}?"`. Actions: `[ Trust and connect ]` / `[ Cancel ]`.
  Both paths surface the 8-char short_id prominently and offer a `[ show full ]` reveal — mirrors the Briar/Add-peer-nearby flow in `UX-PLAN §Flow 2`.
- **D-22:** The modal is a shadcn `Dialog` with focus trap and `Esc` to Decline/Cancel. Only ONE Pair modal can be open at a time; if a second `peers.event discovered` arrives while the modal is already open, queue it and render it after the current one closes. Queue depth is logged to the troubleshoot log, not shown in the UI.

### Metrics strip

- **D-23:** Bottom `CliPanel` titled `METRICS`. One dense line (wraps on narrow widths):
  `peers {connected_count} · forwarded {bytes} / {packets} pkts · dropped {count}{reason ? " (" + reason + ")" : ""} · egress {selected_gateway ? short_id(selected_gateway) : "local"}`
  Uses the `StatusStats` shape from `rpc-types.ts` verbatim. When `stats.dropped === 0`, the dropped segment renders without the reason clause. When `routes.selected_gateway === null`, `egress` reads `local` (not `"none"` — "none" implies something went wrong; "local" honestly names the local-only routing state).
- **D-24:** Numeric formatting: bytes use `1.2 MB` short form (SI binary, 1 decimal); packet counts use grouped digits (`3,847`); large second counts (`last_seen_s`, `uptime_s`) render with a small helper `formatDuration` (e.g. `4h 22m`, `32s`, `3d 12h`). Put helpers in `src/lib/format.ts`.

### Logs tab

- **D-25:** Logs is a separate screen (sidebar tab `⌘5`). It owns a `useLogsStream` hook that:
  1. On mount, calls `callDaemon("logs.subscribe", { min_level: currentFilter.level, sources: [] })` and stores the returned `subscription_id`.
  2. Registers a fan-out handler on `useDaemonState`'s `rpcEvent` bus for `event: "logs.event"`.
  3. Appends each `LogEvent` to a capped in-memory ring buffer (`maxEntries: 2000`, drop-oldest). Larger cap than the 25-per-peer troubleshoot log because this is the Layer-3 log viewer.
  4. On unmount, calls `logs.unsubscribe({ subscription_id })` and removes the fan-out handler.
- **D-26:** UI layout: top filter bar, then the log list. Filter bar:
  - **Level** — single-select buttons / segmented control: `trace` `debug` `info` `warn` `error`. Changing it re-calls `logs.subscribe` on the daemon side (new subscription_id, old one unsubscribed) because `min_level` filtering is server-side per `rpc-types.ts` `LogsSubscribeParams`.
  - **Peer** — `<select>` listing `(all)` + every connected peer by `label ?? short_id`. Peer filter is **client-side** (the daemon's `sources` parameter is module-based, not peer-based; peer filter runs on each incoming `LogEvent.peer_id`).
- **D-27:** Each log row renders in Warp-block style but flattened: `{ts (HH:mm:ss)}  {level-colored badge}  {source}  {peer_short_id ?? "—"}  {message}`. Rows are virtualized via react-window (or similar) because 2000 entries × event rate can jank a DOM render. If react-window adds bundle weight we don't want, use a windowed-render manual implementation; decision: start with `react-window`, swap to manual only if bundle audit demands.
- **D-28:** Auto-scroll behavior: sticky-to-bottom when the user is scrolled within 40 px of the bottom (Slack/terminal pattern). If they scroll up, disengage auto-scroll and show a `[ N new · jump to bottom ]` pill in the bottom-right. Clicking the pill jumps + re-engages auto-scroll.
- **D-29:** Search / time-range filter and `Export debug snapshot` (`OBS-02/03`) are **not** in Phase 2. Phase 2 ships level + peer filter only.

### Error + connection states

- **D-30:** When the Phase 1 `LimitedModeBanner` is active (daemon stopped / disconnected / reconnecting), the dashboard panels render in a muted state: last-known `DaemonSnapshot.status` values stay visible but dimmed (`opacity-60`), and an inline note in the Identity panel reads `Last seen: {baselineTimestamp}`. Don't blank the panels — honest last-state is more useful than an empty screen (`UX-PLAN §6h` pattern).
- **D-31:** When a subscription fails (RPC error code `-32050 AlreadySubscribed` or `-32603 InternalError`), log the error and retry once with a 500 ms backoff. If still failing, surface a toast: `"Couldn't subscribe to {stream}. Check the Logs tab."` — do not silently fail. This is the honest-surfacing rule (P1 + P3).

### Claude's Discretion

The following details are **not** locked — the planner/researcher/executor may choose any reasonable implementation without coming back to the user:

- Exact Tailwind class selection for panel spacing, borders, and text colors — must come from the pim brand token set (`.design/branding/pim/patterns/pim.yml` + `src/globals.css` inlined tokens), must not introduce gradients or border-radius, and must match the existing `CliPanel`/`StatusIndicator` aesthetic. Specific paddings, gaps, and grid-vs-flex choices are delegated.
- Whether to split `useDaemonState` into smaller sub-hooks (`usePeers`, `useStatus`) or keep one fat hook — whichever gives simpler tests.
- The exact shadcn primitives pulled in for `Sheet`, `Dialog`, `Select`, `Segmented` (the new-york variant is already chosen; individual component installs are routine).
- The virtualized-log implementation detail (react-window vs manual) — decide during research/planning.
- Log-level color palette — pick from existing brand tokens (`text-destructive` for error, `text-accent` for warn, default for info, `text-muted-foreground` for debug/trace).
- File layout inside `src/screens/` vs `src/components/brand/` vs `src/components/peers/` — follow the established pattern in Phase 1 (brand primitives in `brand/`, app-screen containers in `screens/`). New subsystems (peers, logs) get their own folders.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, plan-checker, executor) MUST read these before planning or implementing.**

### Project-level specs

- `.planning/PROJECT.md` — Core value, stakeholder-locked decisions 2026-04-24, constraints, tech stack
- `.planning/REQUIREMENTS.md` — The 9 Phase-2 requirements (`STAT-01..04`, `PEER-01`, `PEER-04..06`, `OBS-01`) and their acceptance-criteria phrasing
- `.planning/ROADMAP.md` — Phase 2 goal, 7 success criteria, and the phase boundary against Phases 3/4/5

### UX & design

- `docs/UX-PLAN.md` §1 (design principles P1–P5 — **non-negotiable, especially P1 Honest over polished + P3 Daemon is source of truth**)
- `docs/UX-PLAN.md` §3c–3f (feature inventory: network status, peer management, discovery, authorization)
- `docs/UX-PLAN.md` §4a (desktop sidebar + content pane IA)
- `docs/UX-PLAN.md` §4c (shared primitives: CliPanel, KeyValueTable, ActionRow)
- `docs/UX-PLAN.md` §6a (Dashboard ASCII mockup — copy the layout structure, not pixel-for-pixel)
- `docs/UX-PLAN.md` §6b (Peers tab — most of this is Phase 3, but the "Nearby (not paired)" section is Phase 2)
- `docs/UX-PLAN.md` §6e (Logs tab — Warp-block style, filter bar)
- `docs/UX-PLAN.md` §6h (error states: daemon crashed, interface down, kill-switch, permission missing)
- `docs/UX-PLAN.md` §7 (microcopy + terminology table — **verified against `STAT-*`/`PEER-*`/`OBS-*` strings**)
- `.design/branding/pim/patterns/pim.yml` — Brand tokens (colors, typography, spacing, box-drawing characters)
- `.design/branding/pim/patterns/STYLE.md` — Voice contract (declarative, no exclamation marks, no hype)

### Kernel / RPC contract

- `proximity-internet-mesh/docs/RPC.md` §5.1 (`status` method + Status shape) — **the wire truth; `src/lib/rpc-types.ts` mirrors this**
- `proximity-internet-mesh/docs/RPC.md` §5.2 (`peers.list`, `peers.discovered`, `peers.pair`, `peers.subscribe`, `peers.event` stream)
- `proximity-internet-mesh/docs/RPC.md` §5.6 (`logs.subscribe`, `logs.event` stream — including the 5 level strings and `LogsSubscribeParams`)
- `proximity-internet-mesh/docs/RPC.md` §5.7 (`status.event` kinds — `role_changed`, `interface_up/down`, `gateway_selected/lost`, `route_on/off`, `kill_switch`)
- `docs/research/kernel-study.md` — Exhaustive kernel study (read §peers / §logs sections for event-stream semantics and ordering guarantees)

### Phase 1 artifacts (already locked)

- `.planning/phases/01-rpc-bridge-daemon-lifecycle/01-01-SUMMARY.md` — Phase 1 Plan 01 locked decisions: as-const error codes, single-listener W1 contract, snake_case wire names, 20-method `RpcMethodMap`, Tauri command + event names
- `src/lib/rpc-types.ts` — Typed mirror of RPC contract; Phase 2 imports `Status`, `StatusEvent`, `StatusEventKind`, `PeerSummary`, `PeerDiscovered`, `PeerEvent`, `PeerEventKind`, `LogEvent`, `LogLevel`, `SubscriptionResult`
- `src/lib/rpc.ts` — `callDaemon<M>`, `subscribeDaemon`, `unsubscribeDaemon`, `DaemonCommands`, `DaemonEvents`
- `src/lib/daemon-state.ts` — `DaemonSnapshot` shape; Phase 2 extends with per-event merge logic but MUST NOT change the existing field names
- `src/components/brand/cli-panel.tsx` — **Brand hero primitive — every Phase 2 panel wraps in this**
- `src/components/brand/status-indicator.tsx` — `PeerState` → glyph mapping; reuse as-is
- `src/components/ui/` — shadcn (new-york) `badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx` — additional primitives installed as needed (`dialog`, `sheet`, `select` are expected; `tooltip` and `scroll-area` likely)

### Design system

- `src/globals.css` — Inlined brand tokens (kernel-repo submodule blocked per `STATE.md` blockers); Phase 2 styles use the existing CSS variables — NO new hard-coded colors

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`CliPanel`** (`src/components/brand/cli-panel.tsx`): title-bar + `[STATUS]` badge + monospace body. Wraps every Phase 2 dashboard section and the Logs tab container.
- **`StatusIndicator`** (`src/components/brand/status-indicator.tsx`): Unicode glyph per `PeerState`. Use verbatim in peer rows, peer detail, and the Pair Approval modal.
- **`Badge`** (`src/components/ui/badge.tsx`), **`Button`** (`src/components/ui/button.tsx`), **`Card`**, **`Input`** — shadcn new-york. Use `Button` for action rows, `Badge` for the `[STATUS]` chip in CliPanel.
- **`callDaemon<M>`** (`src/lib/rpc.ts`): typed RPC invocation. Phase 2 calls `status`, `status.subscribe`, `peers.list`, `peers.discovered`, `peers.subscribe`, `peers.pair`, `logs.subscribe`, `logs.unsubscribe`.
- **`DaemonEvents.rpcEvent`** (`src/lib/rpc.ts`): the single Tauri event channel. Phase 2 MUST NOT add a second `listen(...)` call anywhere — route through `useDaemonState`'s fan-out.

### Established Patterns (from Phase 1)

- **Snake_case on the wire, verbatim in TS**: every field coming from the daemon keeps its snake_case name (`node_id_short`, `mesh_ip`, `forwarded_bytes`, `last_seen_s`). Phase 2 UI code reads these snake_case fields directly — no camelCase translation layer.
- **W1 single-listener contract**: enforced by a grep assertion (`grep -c 'listen(' src/lib/rpc.ts == 0`). Phase 2 must pass the same check; any new `listen(...)` calls outside `useDaemonState` reject the plan.
- **`as const` over `enum`**: Phase 2 introduces no new enums — all strings (`PeerTransport`, `PeerState`, `PeerEventKind`, `LogLevel`, `StatusEventKind`) are literal unions imported from `rpc-types.ts`.
- **Compile-only type tests**: Phase 1 Plan 01 established `rpc-types.test.ts` (no vitest runtime). Phase 2 can add similar compile-only tests for any new narrow types (e.g. a `PeerGroup` discriminator) using `@ts-expect-error` + structural assertions.
- **Tailwind via brand tokens, not literal colors**: every color reference in Phase 1 code uses tokens like `text-primary`, `text-accent`, `text-destructive`, `text-muted-foreground`, `bg-popover`, `border-border`. Phase 2 uses the same palette — NO `text-green-500` etc.
- **TDD where behavior is mechanical**: Phase 1 Plan 01 landed RED→GREEN cleanly for type-level and state-machine logic. Phase 2 follows the same pattern for the fan-out dispatcher, subscription lifecycle, and formatting helpers. UI components may ship without tests if the behavior is purely visual (documented, not enforced).

### Integration Points

- **`useDaemonState` hook** — Phase 1 Plan 03 creates it; Phase 2 extends it. The hook is the single entry point every Phase 2 screen uses to read live state.
- **`App.tsx`** — Phase 1 Plan 04 rewires the root component. Phase 2's first task is to replace the flat "render Dashboard" call with the sidebar shell described in D-01/02/03.
- **`src/screens/dashboard.tsx`** — Phase 1 Plan 04 rewires this against `useDaemonState`; Phase 2 REWRITES it with the 4-panel layout (Identity, Peers, Nearby, Metrics).
- **Tauri commands registered in Phase 1 Plan 02** — Rust side must pass through `logs.subscribe` / `logs.unsubscribe` JSON-RPC calls unchanged; no new `#[tauri::command]` handlers are required for Phase 2 (the generic `daemon_call` + `daemon_subscribe` + `daemon_unsubscribe` surface is sufficient).

### Creative options the architecture enables

- Because the event fan-out lives in one place, Phase 2 can compose multiple screens that each scope-subscribe without OS-level listener bloat — the hook dedupes at the fan-out layer.
- The snake_case-verbatim rule makes it trivial to persist a debug snapshot (Phase 3 `OBS-03`) — `JSON.stringify(snapshot.status)` produces bytes identical to `pim status --json`.

</code_context>

<specifics>
## Specific Ideas / References

- **Dashboard ASCII mockup** from `UX-PLAN §6a` is the layout oracle — copy the **structure** (Identity header line, Peers panel, actions row, metrics line), not the character-for-character framing.
- **Peer Detail slide-over** — reference the `UX-PLAN §Flow 6 · Troubleshoot` log block (lines 448–462) for the handshake-log section; every failure line must show timestamp + daemon reason + relevant docs section, pulled straight from `LogEvent.message` + `LogEvent.fields`.
- **Pair Approval modal copy** — verbatim from `UX-PLAN §Flow 2`: header `"{label_announced ?? short_id} wants to join your mesh."`, sub-line `"↳ node ID: {short_id}  [show full]"`, actions `[ Trust and connect ]` / `[ Decline ]`.
- **"Nearby — not paired" copy** from `UX-PLAN §3e`: section title `NEARBY — NOT PAIRED`, empty state `no devices discovered yet · discovery is active`.
- **Microcopy table** in `UX-PLAN §7` is authoritative for user-facing strings — "virtual network connection" not "TUN", "your address on the mesh" not "mesh_ip", "Couldn't verify this peer" not "handshake rejected". The daemon's raw strings (e.g. `transport: "tcp"`, `state: "failed"`) are technical labels and ARE rendered verbatim — the microcopy rule applies to surrounding explanatory text, not wire values.

</specifics>

<deferred>
## Deferred Ideas

These surfaced while mapping Phase 2 but belong in later phases — captured so we don't lose them.

- **Peer add/remove actions** in the Peer Detail slide-over (`[ Retry ] [ Trust this peer ] [ Forget peer ]`) — Phase 3 (PEER-02/03).
- **Static peer form** with address + mechanism + label — Phase 3 (PEER-02).
- **Settings sidebar entry + the 9 collapsible sections** — Phase 3 (CONF-01..07).
- **Raw TOML editor with dry-run validation** — Phase 3 (CONF-06/07).
- **Log text search + time-range filter + `Export debug snapshot` button** — Phase 3 (OBS-02/03).
- **"Route internet via mesh" toggle** on the dashboard — Phase 4 (ROUTE-01/02). The visual slot may be reserved in the layout; semantics ship in Phase 4.
- **Routing view** with live routing table + known gateways — Phase 4 (ROUTE-03/04).
- **Kill-switch banner + "Couldn't verify this peer" error copy** — Phase 4 (UX-03). Phase 2 surfaces failed peers honestly but does not land the full error-state catalogue.
- **Copy audit against `docs/COPY.md` (Aria-copy + Mira-annotation columns)** — Phase 4 (UX-08). Phase 2 uses microcopy matching `UX-PLAN §7`, but `docs/COPY.md` is where the final audit happens.
- **Onboarding, solo-mode first-class UX, `Add peer nearby` flow end-to-end (QR + BLE scan)** — Phase 4 (UX-01/02).
- **Gateway section, pre-flight UI, conntrack gauge** — Phase 5.
- **Menu-bar popover / tray / AppIndicator / command palette / toast + system notifications** — Phase 5 (UX-04..07).
- **Per-peer reputation scores** — not in daemon; kernel-roadmap work.
- **Dedicated `Peers` tab** distinct from Dashboard's peer list — Phase 3 absorbs this when the add-peer form + peer-remove flows exist. Phase 2 can point the `⌘2` sidebar route at the same Dashboard peer list.
- **Deep-linking to the Logs tab filtered by peer + time range** from an inline "Show why" link — Phase 3 (once OBS-02 lands the time-range filter and the log URL scheme is designed).

</deferred>

---

*Phase: 02-honest-dashboard-peer-surface*
*Context gathered: 2026-04-24 via `/gsd:discuss-phase 2 --auto`*
