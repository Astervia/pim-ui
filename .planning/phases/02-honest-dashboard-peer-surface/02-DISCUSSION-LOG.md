# Phase 2: Honest Dashboard & Peer Surface — Discussion Log

> **Audit trail only.** Not consumed by downstream agents (researcher, planner, executor).
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered and the auto-selected defaults chosen by `/gsd:discuss-phase 2 --auto`.

**Date:** 2026-04-24
**Phase:** 02-honest-dashboard-peer-surface
**Mode:** `--auto` — Claude picked the recommended default for every gray area; no interactive questions were asked.
**Areas discussed:** Navigation shell, Reactive subscription strategy, Dashboard layout, Peer row anatomy, Peer Detail surface, Nearby/not-paired section, Pair approval modal, Metrics strip, Logs tab, Error + connection states.

---

## Navigation shell

| Option | Description | Selected |
|--------|-------------|----------|
| Plain React `useState` tab router + ⌘-shortcuts | No extra dep; fits one-window Tauri app. Matches `UX-PLAN §4a`. | ✓ |
| `react-router-dom` | Full URL semantics; helpful if deep-linking / browser back is ever needed. | |
| `@tanstack/router` | Type-safe routes; overkill for 5 static tabs. | |

**Rationale:** Phase 2 has one window and five top-level tabs; `useState` + keyboard shortcuts is honest and ~0 kB heavier than the status quo. Router libs become worth the cost when the menu-bar popover (Phase 5) needs to drive navigation from outside the window — re-evaluate there.

## Reactive subscription strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Global `status` + `peers` subs in `useDaemonState`; per-screen `logs` sub | Low-volume streams live globally; high-volume `logs` scoped to its own screen. | ✓ |
| All three subs global | Simpler lifecycle, but `logs.event` at warn/debug level on a noisy daemon can flood a buffer we aren't displaying. | |
| All three subs per-screen | Wastes event-stream setup/teardown when the dashboard always wants status/peers. | |

**Rationale:** `status.event` and `peers.event` are expected to fire ~dozens of times per minute; `logs.event` at `info+` can fire hundreds/sec. Subscribing to logs only while the tab is mounted keeps memory + render cost bounded without compromising what the dashboard shows.

## Fan-out layer

| Option | Description | Selected |
|--------|-------------|----------|
| One `listen()` in `useDaemonState` + internal `Map<RpcEventName, Set<Handler>>` | W1 single-listener contract from Phase 1 Plan 01; enforced by grep. | ✓ |
| One `listen()` per subscribe call | Leaks OS-level listeners; explicitly rejected in Phase 1 UI-SPEC. | |

**Rationale:** Phase 1 already chose this; Phase 2 inherits the rule. The grep assertion `grep -c 'listen(' src/lib/rpc.ts == 0` must still pass after Phase 2.

## Dashboard layout

| Option | Description | Selected |
|--------|-------------|----------|
| 4 stacked `CliPanel`s (Identity · Peers · Nearby · Metrics) | Reuses brand hero primitive; mirrors `UX-PLAN §6a` ASCII mockup structurally. | ✓ |
| 2-column grid (Identity+Metrics left, Peers+Nearby right) | Efficient on wide screens but fights the terminal/scroll reading order. | |
| Tabbed within-dashboard (Status \| Peers \| Nearby) | Hides critical info behind a click — contradicts P1 "honest over polished." | |

## Peer row anatomy

| Option | Description | Selected |
|--------|-------------|----------|
| One-line monospace: short_id · label · mesh_ip · transport · state · hops · latency · last_seen | Dense, scan-friendly, honest; every field sourced from `PeerSummary`. | ✓ |
| Two-line card with primary/secondary info | More breathing room but halves density and needs pixel-precise spacing. | |
| Expanding row (click to unfold in place) | Adds animation + layout-shift complexity; slide-over is cleaner. | |

**Sort order:** gateway peers → active → relayed → connecting → failed, then by `label ?? short_id` alphabetically. Stable across events so the list doesn't shuffle on every `state_changed`.

## Peer Detail surface

| Option | Description | Selected |
|--------|-------------|----------|
| Right-edge slide-over (shadcn `Sheet` / `Dialog side=right`) | Matches `UX-PLAN §6a` "slide-over"; dashboard stays visible behind. | ✓ |
| Full-route detour (`/peers/:id`) | Breaks the one-window shell; needs routing. | |
| Inline expand under the row | Janky with variable-height content; lays out poorly for handshake logs. | |
| Modal over dashboard | Loses the "see peers list + detail together" affordance. | |

## Nearby / not-paired section

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `CliPanel` below Peers, always visible | Preserves "app is listening" mental model; empty state reads `no devices discovered yet · discovery is active`. | ✓ |
| Collapsed by default, expand to see | Hides a Phase 2 success criterion (PEER-05). | |
| Inline badge on the Peers panel header | Too subtle for the product promise. | |

## Pair Approval modal

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn `Dialog` with focus trap, queue-on-collision, `Esc` to decline | Matches Briar pattern cited in `UX-PLAN §Flow 2`; honest copy verbatim from the plan. | ✓ |
| Toast-style non-blocking prompt | Easy to miss an incoming pair request — betrays the Aria persona. | |
| System notification | Phase 5 territory (UX-04); out of scope for Phase 2. | |

**Trigger paths locked:** inbound (daemon-emitted pair request) and outbound (user clicks `[ Pair ]` on a Nearby row). Only one modal open at a time; subsequent requests queue.

## Metrics strip

| Option | Description | Selected |
|--------|-------------|----------|
| One dense line inside a `METRICS` `CliPanel`: peers · forwarded · dropped · egress | Matches ASCII mockup; 1.2 MB / 3,847 pkts / "(congestion)" reason surfaces honestly. | ✓ |
| Grid of stat tiles (4 cards) | Fights the monospace aesthetic; introduces visual weight that competes with the peer list. | |
| Sparkline charts | Looks polished but Phase 2 has no historical store — would be synthesized. | |

**Egress copy:** `egress local` when `routes.selected_gateway === null` (not `"none"` — "none" implies failure; "local" honestly names local-only routing).

## Logs tab

| Option | Description | Selected |
|--------|-------------|----------|
| Separate sidebar route, `useLogsStream` hook, virtualized list (`react-window`), 2000-entry ring buffer, auto-scroll with "jump to bottom" pill | Phase 2 scope: level + peer filter only; search + time-range are Phase 3. | ✓ |
| Logs inside Dashboard as a fourth panel | Crowds the dashboard; fights the Layer 3 doctrine from `UX-PLAN §8`. | |
| Logs as a modal / slide-over | Too temporary; the Logs tab is a persistent surface per `UX-PLAN §4a`. | |

**Server-side `min_level` filter (daemon-enforced) + client-side peer filter (per `LogEvent.peer_id`)** — matches the `LogsSubscribeParams` shape in `rpc-types.ts` (sources are module-based, not peer-based).

## Error + connection states

| Option | Description | Selected |
|--------|-------------|----------|
| Dim last-known snapshot at `opacity-60` + `"Last seen: {ts}"` line + Phase 1 `LimitedModeBanner` | Honest last-state surfacing (UX-PLAN §6h); never blanks the dashboard. | ✓ |
| Full-screen "Disconnected" placeholder | Betrays the daemon-is-source-of-truth principle — last-known state is more useful than a void. | |

**Subscription failure retry:** one retry at 500 ms backoff, then a toast — never a silent failure.

## Scope creep / redirected items

Nothing mid-discussion attempted to escape Phase 2 scope (`--auto` can't introduce scope creep). All out-of-phase ideas are captured under `<deferred>` in `CONTEXT.md`.

## Claude's Discretion

Captured as the `Claude's Discretion` subsection in `02-CONTEXT.md` — Tailwind class selection, shadcn primitive installs, hook split decisions, virtualization implementation, exact file layout, and log-level color palette are delegated to research/planning.

## Auto-selection summary

Every gray area above resolved to its first-listed (recommended) option. No user input was collected. The decisions in `02-CONTEXT.md` are Claude's best-effort defaults grounded in:
- `UX-PLAN.md` §1 design principles (P1–P5)
- `UX-PLAN.md` §6a dashboard ASCII mockup (layout oracle)
- `PROJECT.md` stakeholder decisions locked 2026-04-24
- Phase 1 Plan 01 locked decisions (W1 contract, snake_case wire names, `as const` error codes)
- The `rpc-types.ts` contract as the single shape authority

If the user disagrees with any default, the path forward is either to edit `02-CONTEXT.md` directly before planning proceeds, or to re-run `/gsd:discuss-phase 2` without `--auto` and override the specific areas interactively.
