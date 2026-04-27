# Phase 4: Routing & Onboarding Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 04-routing-onboarding-polish
**Mode:** Autonomous decision pass — user directed Claude to drive every gray area without interactive discussion ("não vamos discutir, faça o que vc achar melhor… execute a fase").

**Areas covered (4):**
1. Onboarding step 3 + Solo-mode actions (UX-01 + UX-02)
2. Route toggle UX — placement + pre-flight (ROUTE-01 + ROUTE-02)
3. Routing screen — layout + refresh strategy (ROUTE-03 + ROUTE-04)
4. Critical error states + microcopy authority (UX-03 + UX-08)

---

## 1. Onboarding step 3 + Solo-mode actions

### 1a. Where does the post-bootstrap "Add peer / Run solo" picker live?

| Option | Description | Selected |
|---|---|---|
| 2nd step inside FirstRunScreen | Render the picker as a second internal screen of FirstRunScreen, after `[ Start pim ]` succeeds. Avoids a new component but couples Phase 01.1's first-run with Phase 4 onboarding scope. | |
| Standalone WelcomeScreen rendered by AppRoot between FirstRunScreen and AppShell | Three render states in AppRoot: loading / first-run / welcome / app. Picker lives in its own component, gated by `localStorage["pim-ui.onboarding.completed"]`. | ✓ |
| One-time Dashboard banner | Render as a banner on Dashboard when `!localStorage[onboarding.completed] && !peers.length`. Mixes onboarding state into the steady-state dashboard surface. | |
| Modal overlay on first Dashboard mount | Lock the dashboard behind a modal until choice is made. Contradicts UX-PLAN §1 P1 "honest over polished" — modal would imply Dashboard isn't ready. | |

**Selected:** Standalone WelcomeScreen rendered by AppRoot.
**Rationale:** Keeps the 3-interaction count clean (FirstRunScreen step 1 → TUN modal step 2 → WelcomeScreen step 3), separates concerns (Phase 01.1 owns bootstrap, Phase 4 owns onboarding completion), and the localStorage flag means the screen is one-shot — returning users skip directly to AppShell without code paths in Dashboard pretending to be onboarding-aware.

### 1b. What does `[ + Add peer nearby ]` actually do?

| Option | Description | Selected |
|---|---|---|
| Open a modal that runs a discovery scan | Implies an `invite`/`discovery.start` RPC the daemon doesn't expose. Would have to fake it. | |
| Scroll focus to NearbyPanel + announce "scanning…" if discovered list empty | Reuses the daemon's already-running peers.subscribe; the affordance points at the surface where pairing happens. | ✓ |
| Open the existing PairApprovalModal in outbound mode | Outbound mode requires a target node_id; there's nothing to pair with yet on the dashboard click path (NearbyPanel rows have their own `[ Pair ]` button). | |
| Trigger an RPC that requests `peers.discovered()` | The daemon's discovery is broadcast-driven; an explicit fetch wouldn't accelerate discovery. | |

**Selected:** Scroll to NearbyPanel + honest "scanning…" hint when empty.
**Rationale:** Honest-by-construction — directs the user to the panel where the daemon's running discovery surfaces results. No fake RPC, no fake modal.

### 1c. What does `[ Invite peer ]` do given no `invite.*` RPC exists in v1?

| Option | Description | Selected |
|---|---|---|
| Generate a fake `pim://invite/abc123…` URL with copy/QR/share buttons | Would lie about what the system can do — UX-PLAN §1 P1 forbids it. | |
| Open InvitePeerSheet with an honest stub: kernel repo install link + explanation that remote invites need an RPC pending v0.6 | The brand-honest version of UX-PLAN §Flow 3. Surfaces what the system actually does (point peer at install page; pair on local network). | ✓ |
| Disable the button with "(v0.6+)" tooltip | Hides the affordance. UX-02 SC3 mandates the action be present. | |
| Defer the button entirely | Same hiding problem. | |

**Selected:** InvitePeerSheet with honest stub.
**Rationale:** Brand-honest, satisfies UX-02 SC3 (the action is present), uses the existing Sheet primitive, telegraphs the v0.6 roadmap to power users (Mira) without misleading newcomers (Aria).

---

## 2. Route toggle UX

### 2a. Where on Dashboard does the route toggle live?

| Option | Description | Selected |
|---|---|---|
| New ROUTING CliPanel between IdentityPanel and PeerListPanel | New panel slot in the existing 4-panel stack. Mirrors UX-PLAN §6a mockup's vertical position. | ✓ |
| Sub-row inside IdentityPanel | Couples identity (read-only state) with routing (read-write knob); muddies the panel's purpose. | |
| Action row above PeerListPanel | Coexists with peer-list buttons; cluttered. | |
| Compact pill near DaemonToggle | Implies routing and daemon-on are the same layer; they aren't. | |

**Selected:** New ROUTING CliPanel between IdentityPanel and PeerListPanel.
**Rationale:** Matches UX-PLAN §6a verbatim. Panel-as-feature-surface keeps Mira's mental model of the routing knob as a separate concern.

### 2b. Pre-flight ~500ms UX

| Option | Description | Selected |
|---|---|---|
| Inline expanding checklist (✓/✗ rows) below toggle | UX-PLAN §Flow 4 verbatim. Computed client-side from existing Status (no RPC). | ✓ |
| Optimistic toggle with a thin progress bar; on failure roll back | Hides what's being checked. Mira-hostile. | |
| Modal dialog with checklist | Heavyweight; interrupts the flow. | |
| No pre-flight; just call the RPC and report the response | Loses the "what's being checked" transparency. | |

**Selected:** Inline expanding checklist with `[ CONFIRM TURN ON ]` / `[ CANCEL ]` actions.
**Rationale:** Honest-by-construction, names the technical state, fast (client-derived from Status), gives Mira a debugging surface (rows update live as `status.event`s arrive).

### 2c. What does pre-flight check given no `route.preflight()` RPC?

| Option | Description | Selected |
|---|---|---|
| Read Status: interface.up + selected_gateway != null + active gateway peer | Pure client-side derivation; <50ms; no RPC. | ✓ |
| Call `route.set_split_default` directly and treat the response as pre-flight | The RPC may have side effects. Two-step (pre-check then commit) is what the user sees in UX-PLAN §Flow 4. | |
| Add a new `route.preflight()` Tauri command that wraps daemon checks | Out of scope for Phase 4 — a new daemon RPC is kernel-side work. | |

**Selected:** Read Status, derive client-side.
**Rationale:** Aligns with daemon-driven invariant. The actual `route.set_split_default` call is the source of truth for whether routing was enabled — pre-flight is a UI courtesy that explains failures before the RPC.

---

## 3. Routing screen — layout + refresh strategy

### 3a. Layout: how many panels, what order?

| Option | Description | Selected |
|---|---|---|
| Two CliPanels: ROUTING TABLE + KNOWN GATEWAYS | UX-PLAN §6c maps directly. | |
| Three CliPanels: route toggle (mirror) + ROUTING TABLE + KNOWN GATEWAYS | Lets Mira toggle routing from the routing surface itself; mirrors UX-PLAN §6c "Above: the route internet via mesh toggle". | ✓ |
| One CliPanel split with box-drawing into two sections | Crowds; hard to scan. | |

**Selected:** Three CliPanels — toggle echo + table + gateways.
**Rationale:** UX-PLAN §6c authority. Same toggle component instance as Dashboard means no state sync drift.

### 3b. Refresh strategy for `route.table()`

| Option | Description | Selected |
|---|---|---|
| One-shot fetch on tab mount + manual refresh button | Stale data guaranteed if user stays on tab. | |
| Polling every N seconds while tab visible | Polling contradicts "daemon is source of truth" — and the daemon doesn't promise stable polling cadence. | |
| Refetch driven by status.event of relevant kinds (route_on/off, gateway_selected/lost, kill_switch) — no polling | Aligned with W1 single-listener pattern; uses fan-out subscription. Manual refresh button retained as escape hatch. | ✓ |
| Add a route.subscribe / route.event channel | Doesn't exist in v1 daemon RPC; out of scope. | |

**Selected:** Status-event-driven refetch + manual refresh escape hatch.
**Rationale:** Daemon-driven invariant honored. Low-volume events make refetch cheap. Manual button covers the buggy-daemon case.

### 3c. Selected-gateway highlight

| Option | Description | Selected |
|---|---|---|
| Row tint only (text-primary) | Subtle; might miss in a long table. | |
| Leading `◆` glyph only | Brand-consistent with peer rows; needs scan time. | |
| Both — leading `◆` glyph + text-primary destination | Eye lands on it from any height; matches Phase 2 peer-row honesty pattern. | ✓ |

**Selected:** Both — leading `◆` glyph + text-primary tint.
**Rationale:** Strongest visual signal; aligns with brand glyph language.

---

## 4. Critical error states + microcopy authority

### 4a. Kill-switch banner placement + blocking strategy

| Option | Description | Selected |
|---|---|---|
| Top-of-app blocking banner (above Sidebar) | Implies a system-wide event; would need new layout slot. | |
| Banner above active-screen content, sibling to LimitedModeBanner | Matches existing chrome architecture; non-modal. Mira can still read logs / route table while the banner is up. | ✓ |
| Modal overlay that blocks all input until acknowledged | Contradicts brand — Mira needs surfaces accessible during incident. | |
| Inline Identity-panel chip on Dashboard only | Fails to surface on Routing screen (where the user is most likely to land during a kill-switch event). | |

**Selected:** Banner above active-screen content, sibling to LimitedModeBanner.
**Rationale:** Visible on every screen; non-blocking; reuses border-left destructive pattern; one-click resolution via `[ TURN OFF KILL-SWITCH ]`.

### 4b. Banner activation source

| Option | Description | Selected |
|---|---|---|
| Derived from `Status` (route_on === true && selected_gateway === null) | Pure derivation; no banner-state machine; aligns with reactive contract. | ✓ |
| Stored boolean toggled by `kill_switch` event | Adds banner-state to manage; can desync from snapshot. | |
| Both — derived primary + event triggers a one-shot toast | Banner stays derived; event triggers an arrival toast for visibility on background screens. | ✓ (combined) |

**Selected:** Derived from Status + event triggers one-shot toast.
**Rationale:** Banner is reactive state; toast acknowledges arrival even if user isn't looking at the active screen.

### 4c. Handshake-fail "Couldn't verify this peer" placement

| Option | Description | Selected |
|---|---|---|
| Sub-line below standard PeerRow when state==="failed" with pair_failed event | Visible on Dashboard + Peers tab; clickable docs link. | ✓ |
| Inline tooltip on hover | Hides the docs path until hover; Mira-hostile. | |
| Replace the standard row content entirely | Loses other peer fields needed for diagnosis. | |
| Only in PeerDetailSheet | Forces an extra click to see why a peer failed. | |

**Selected:** Sub-line below standard row + same docs link in PeerDetailSheet's failed-event callout.
**Rationale:** Surfaces the resolution path at the point of friction (peer row visible) and at the point of investigation (detail sheet). Both link to the same `docs/SECURITY.md §3.2`.

### 4d. docs/SECURITY.md §3.2 — link target since the doc doesn't exist

| Option | Description | Selected |
|---|---|---|
| Create docs/SECURITY.md as a v1 minimal file with §3.2 | Honest — the link clicks through to real content explaining the failure. | ✓ |
| Link to kernel repo placeholder (e.g. issues page) | Off-brand and misleading. | |
| Show copy without an actual link | Half-honest; makes Mira look up the doc manually. | |
| Defer the link until docs land | Then UX-08 audit can't pass. | |

**Selected:** Create docs/SECURITY.md with §3.2.
**Rationale:** Phase 4 is the right phase to author this doc — UX-03 needs the link, the doc needs to exist, and the v1-minimal version is small enough to ship as part of the Phase 4 plan without scope creep.

### 4e. docs/COPY.md authority — create or retarget?

| Option | Description | Selected |
|---|---|---|
| Create docs/COPY.md as a single voice contract aggregating UX-PLAN §7 + STYLE.md + Phase 4 strings | Single audit target; mechanical script can grep against it. | ✓ |
| Retarget UX-08 wording to point to UX-PLAN §7 | Less duplication, but UX-PLAN §7 doesn't enumerate every Phase 4 string and isn't structured for grep audit. | |
| Skip the audit entirely; rely on grep-against-`!` only | Misses banned-phrase regressions. | |

**Selected:** Create docs/COPY.md.
**Rationale:** Single source for the audit script; future phases can extend it with their own strings; grep-friendly structure.

### 4f. Audit method

| Option | Description | Selected |
|---|---|---|
| `scripts/audit-copy.mjs` script (Node ESM, no new dep) — regex scanner over JSX text + selected props | Mechanical, fast, runnable as `pnpm audit:copy`. | ✓ |
| Babel AST scanner | More accurate but slower and adds dep. Reserved for v2 if regex misses cases. | |
| Manual review only | Doesn't scale; regression-prone. | |
| Per-string `expect(string).toMatchSnapshot()` tests | Brittle; couples test surface to copy revisions. | |

**Selected:** Regex-based `scripts/audit-copy.mjs` + `pnpm audit:copy` script.
**Rationale:** Lightweight, mechanical, audit-as-CLI matches the brand's terminal-native ethos.

---

## Claude's Discretion (locked as not-asked)

The following decisions were made unilaterally by Claude based on Phase 1/2/01.1/03 patterns and brand absolutes; documented here so the user can audit:

- **Snapshot extension policy:** No new fields on `DaemonSnapshot`. Phase 4 surfaces derive their state from existing fields via new selector hooks (`useRouteOn`, `useSelectedGateway`, `useKillSwitch`).
- **No new RPC methods, no new Tauri commands, no new Rust modules.** Phase 4 is purely UI-layer work atop existing v1 RPC surface.
- **Atomic commits per task:** Phase 4 inherits the per-task commit policy from Phases 1/2/3.
- **Test placement:** Collocated with implementation files (`*.test.ts` next to `*.ts`).
- **Animation:** Brand-permitted 100ms linear; Phase 4 ships instant transitions, defers polish.
- **Sonner toast position:** Default top-right.
- **`[ refresh ]` button vs icon:** Text per brand; no icon-as-text.

---

## Deferred Ideas Captured During Decision Pass

(Captured in `04-CONTEXT.md <deferred>` section.)

- Real `pim://invite/...` deep-link generation + handler (needs `invite.*` RPC, kernel v0.6+).
- Settings → Routing knob section (Phase 3 D-19 placeholder; future phase).
- `route.table()` polling fallback (manual refresh button is current escape hatch).
- Babel AST upgrade for `audit-copy.mjs` (regex-only ships v1).
- Kill-switch toast position promotion to `top-center`.
- Animation polish on RouteTogglePanel state transitions.
- `localStorage` migration / versioning.
- Per-peer "trust this peer" retry from failed-row affordance.
- `docs/SECURITY.md` v2 expansion (remote daemon TCP, audit trails, key rotation guidance).

---

*End of discussion log.*
