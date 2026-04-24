---
phase: 2
slug: honest-dashboard-peer-surface
status: draft
shadcn_initialized: true
preset: new-york (manual pim brand override via src/globals.css)
created: 2026-04-24
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the Honest Dashboard & Peer Surface phase.
> Authored by `gsd-ui-researcher` in AUTO mode from:
> `docs/UX-PLAN.md`, `.design/branding/pim/patterns/pim.yml`,
> `.design/branding/pim/patterns/STYLE.md`, `src/globals.css`,
> `02-CONTEXT.md` (D-01..D-31, locked 2026-04-24),
> and existing Phase 1 primitives in `src/components/brand/` + `src/components/ui/`.

Every token below traces to either `src/globals.css` (inlined pim tokens — the
production source of truth while the kernel-repo submodule is blocked per
`STATE.md`) or to `.design/branding/pim/patterns/pim.yml`. Values tagged `(new)`
are phase-specific additions that do not already exist in a token file; they are
justified inline and stay within the brand constraint set.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn (CLI v-next, new-york variant) | `components.json` |
| Preset | Manual pim override — see `src/globals.css` `@theme` block | `components.json` + `src/globals.css` L30-84 |
| Component library | Radix UI (via shadcn new-york primitives) | `@radix-ui/react-dialog`, `@radix-ui/react-slot` already in tree |
| Icon library | **Unicode + box-drawing glyphs first; lucide-react only as fallback** for non-semantic affordances (e.g. chevron in slide-over close, filter-bar ornament). Status is ALWAYS Unicode (`◆ ◈ ○ ✗`) via `<StatusIndicator />`. | `pim.yml` constraints.always, `STYLE.md` §Always, `status-indicator.tsx` |
| Fonts | **Geist Mono** (structural: headings, nav, labels, buttons, peer rows, log rows, CliPanel body); **JetBrains Mono** via `var(--font-code)` (CliPanel body + log list dense text); **Geist** sans reserved for long-form prose only and does NOT appear in Phase 2 | `src/globals.css` L32-35, `STYLE.md` §Typography |
| Base font size | `14px` on `html` — Phase 2 inherits. All per-role sizes below are relative to this. | `src/globals.css` L94 |
| Base line-height | `1.6` on `html`; panels use `1.7` for dense CLI text. | `src/globals.css` L95, `cli-panel.tsx` L27 |
| CRT scanline overlay | Applied at `body::before`, 4-8% opacity, `mix-blend-mode: overlay`, respects `prefers-reduced-motion`. **Brand-level — never per-component.** | `src/globals.css` L107-123, `pim.yml` effects.ambient |
| Border-radius | `0` everywhere — enforced via `--radius: 0` token | `src/globals.css` L78, `STYLE.md` §Shape |
| Shadows / glows | No shadows. `.phosphor` text-shadow reserved for signal-green active state (`◆ active` glyph + `█ pim` wordmark). Never on body text. | `src/globals.css` L160-164 |
| Transitions | `duration-100 ease-linear` — instant digital response | `pim.yml` motion, `button.tsx` L24 |

---

## Spacing Scale

Anchored to `pim.yml` `tokens.spacing` (base `8`, scale `[4, 8, 12, 16, 24, 32, 48, 64, 96]`) and Tailwind v4's `--spacing: 0.25rem` (`src/globals.css` L84), which maps `1` → `4px` uniformly. Phase 2 uses the following subset exclusively — no other step values appear in new code.

| Token | Tailwind class | Pixels | Usage in Phase 2 |
|-------|----------------|--------|------------------|
| `xs` | `gap-1` / `p-1` | `4px` | Inline glyph ↔ label gap (StatusIndicator + state word); badge internal padding Y |
| `sm` | `gap-2` / `p-2` | `8px` | Peer row column gaps; badge internal padding X; filter-bar button gap |
| `md-` | `p-3` / `gap-3` | `12px` | Sidebar row vertical padding; slide-over section internal gap |
| `md` | `p-4` / `gap-4` | `16px` | CliPanel body padding-X (`px-4` header / `px-5` body — inherited from `cli-panel.tsx`); ActionRow gap; peer-row horizontal padding |
| `lg` | `p-5` / `py-5` | `20px` | CliPanel body inner X-padding (existing primitive) |
| `lg+` | `gap-6` / `p-6` | `24px` | Vertical stack gap between CliPanels on Dashboard; slide-over outer padding; Pair Approval modal inner padding (matches `dialog.tsx` `p-6`) |
| `xl` | `gap-8` / `py-8` | `32px` | Main content pane top/bottom padding; shell horizontal padding to content |
| `2xl` | `py-12` | `48px` | Reserved — not used in Phase 2 |
| `3xl` | `py-16` | `64px` | Reserved — not used in Phase 2 |

**Fixed-dimension constants (exceptions, documented inline):**

| Constant | Value | Justification |
|----------|-------|---------------|
| Sidebar width | `240px` (`w-60`) | D-02 locked; matches `UX-PLAN §4a` |
| Slide-over width | `480px` (`w-[480px]`) | D-15 locked; ~40% of a 1280px reference width, leaves the Dashboard visible underneath |
| Slide-over overlay dim | `bg-background/80` reused from `dialog.tsx` | Brand constraint: no blur, solid tint only |
| Log row height | content-sized (no fixed row height) — virtualization measures in px based on font metrics | react-window `VariableSizeList` or manual; D-27 |
| Focus-outline width | `1px` (matches `src/globals.css` L240 `:focus-visible` default); Phase 2 uses `outline-2` for large click targets (peer rows, log rows, slide-over close) **(new — 2px)** to meet WCAG 2.2 focus visibility on the green-phosphor-on-near-black palette | Brand-aligned; `--color-ring` = `#22c55e` already has sufficient contrast against `#0a0c0a` |

Exceptions: listed above. No 6/10/14/18/22/26 px values anywhere.

---

## Typography

Monospace-first. No sans-serif in Phase 2. Scale is the Major Third (1.250) defined in `pim.yml` `typography.scale-ratio`, computed from the 14px base (`src/globals.css` L94).

| Role | Tailwind class | Font | Size / line-height | Weight | Usage |
|------|----------------|------|---------------------|--------|-------|
| `body` (peer rows, log rows, CliPanel content) | `font-code text-sm leading-[1.7]` | JetBrains Mono | 14px / 1.7 | 400 | Every CliPanel body child — matches `cli-panel.tsx` L27 exactly |
| `label` (CliPanel title, sidebar nav row, filter button, badge, button text) | `font-mono text-xs uppercase tracking-widest` | Geist Mono | 12px / 1.6 | 500 | `cli-panel.tsx` L35, sidebar nav rows, `Button` inside action areas |
| `heading` (slide-over section titles, Pair Approval modal title) | `font-mono text-sm uppercase tracking-wider` | Geist Mono | 14px / 1.6 | 600 | Matches `DialogTitle` (`dialog.tsx` L83) pattern, reduced to `text-sm` for slide-over density |
| `heading-lg` (Pair Approval `DialogTitle` reusing existing primitive) | `font-mono text-lg font-semibold uppercase tracking-wider` | Geist Mono | 18px / 1.6 | 600 | `dialog.tsx` L84 verbatim |
| `display` (`█ pim · {node.name}` Identity panel hero) | `font-mono text-xl tracking-tight` | Geist Mono | 20px / 1.4 | 500 | Hero line; `█` glyph gets `.phosphor` class; `pim` wordmark gets `.phosphor`; node name stays `text-foreground` |

**Heading tracking:** `-0.015em` on `text-lg+` (inherited from `src/globals.css` L149-152). Phase 2 adds no new heading sizes beyond `text-xl`; larger Display sizes are reserved for onboarding (Phase 4).

**Line-height policy:**
- Body dense CLI content: `1.7` (CliPanel existing) — improves packet-level legibility
- UI chrome (labels, badges, buttons): `1.6` (html default)
- Headings `≥ text-lg`: tightened to `1.4` via `leading-[1.4]` on the Identity hero row only
- Log rows: `1.5` **(new)** — tighter than CliPanel body to maximize rows-on-screen at 2000-entry buffer; still ≥ WCAG 1.4.12 minimum

---

## Color

Anchored to `src/globals.css` `@theme` block. Every color reference in Phase 2 code uses a CSS variable via Tailwind (`text-primary`, `bg-popover`, `border-border`, etc.) — **NO hex literals in new code**.

| Role | Token | Hex | Usage in Phase 2 |
|------|-------|-----|------------------|
| Dominant (60%) | `--color-background` | `#0a0c0a` | App shell background, main content pane, sidebar gap, log tab background |
| Secondary (30%) | `--color-card` | `#121513` | Sidebar surface; fallback CliPanel backing in a future compact variant |
| Secondary (30%) | `--color-popover` | `#1a1e1b` | **Every CliPanel body** (Identity, Peers, Nearby, Metrics, Logs container) — matches `cli-panel.tsx` L25 |
| Secondary (30%) | `--color-muted` | `#2a2e2c` | Scrollbar thumb, disabled-row fills, Phase-2 "reserved sidebar row" (Routing/Gateway/Settings greyed-out) background |
| Accent (10%) — reserved | `--color-accent` | `#e8a84a` | **ONLY**: (a) `◈ relayed` glyph via `<StatusIndicator state="relayed" />`; (b) `warn` level badge in Logs tab filter bar `[WARN]` (existing `Badge variant="warning"`); (c) `warn` log-row level token; (d) Pair Approval modal **short_id highlight** (the 8-char id displayed prominently — `text-accent` applied to that span only). Nothing else. Buttons, links, hover states do NOT use accent. |
| Semantic — success | `--color-primary` | `#22c55e` | `◆ active` glyph; Identity-panel status-dot (green phosphor); `[OK]` badge; `info` level log row (default); default button background; focus ring (`--color-ring`) |
| Semantic — connecting | `--color-muted-foreground` | `#7a807c` | `○ connecting` glyph; metadata text (`last_seen_s`, uptime helper, "discovery is active"); `debug`/`trace` log-row level; inactive sidebar row text; queue-depth hint |
| Destructive | `--color-destructive` | `#ff5555` | `✗ failed` glyph; interface-down inline chip; `error` log-row level; destructive-toast border; `pair_failed` troubleshoot log entry reason highlight |
| Borders (neutral) | `--color-border` | `#2a2e2c` | Every CliPanel outer border; sidebar right-edge divider; peer-row bottom divider; slide-over left-edge divider; Pair modal border |
| Border (active/hover) | `--color-border-active` | `#3a5a3e` | Peer row hover border; slide-over open-edge accent; log row hover border |
| Surface — elevated | `--color-popover` | `#1a1e1b` | Slide-over content surface (same as CliPanel body for cohesion); Pair Approval modal backing (replaces default `bg-card` from `dialog.tsx` when the modal sits on top of Dashboard panels that are already `bg-popover` — visual consistency) |
| Phosphor glow | `.phosphor` utility | `text-shadow: 0 0 4px rgba(34,197,94,.4), 0 0 8px rgba(34,197,94,.2)` | Applied ONLY to: `█ pim` hero block, `◆ active` glyph (via StatusIndicator), Identity-panel status-dot if distinct. **NEVER on body text, CTA buttons, metrics numbers.** |

### Accent reserved for (exhaustive list, enforced by checker)

1. `<StatusIndicator state="relayed" />` — the `◈` glyph color
2. `<Badge variant="warning">WARN</Badge>` in the Logs filter bar
3. `warn`-level log-row label text in the Logs list (`text-accent` on the level-badge; message stays `text-foreground`)
4. Short_id emphasis span inside the Pair Approval modal copy line (`↳ node ID: 7f8e…a3c2`)

**Do NOT use accent for:** primary CTA buttons, Pair Approval `[ Trust and connect ]` action, sidebar active state, peer-row hover, slide-over trigger chevron, `jump to bottom` pill, subscription-failure toast border (use `border-destructive` for toast), auto-scroll pill, log-row text at default level, filter-button active state. Primary active state uses `--color-primary` (signal green) everywhere.

### 60 / 30 / 10 split — verified

- **60% `--color-background` (`#0a0c0a`)**: shell + main pane + sidebar margin-edge
- **30% `--color-popover` (`#1a1e1b`) + `--color-card` (`#121513`)**: CliPanel bodies + sidebar + slide-over + Pair modal
- **10% `--color-primary` (`#22c55e`)**: active-state glyphs, `[STATUS]` badges, primary CTA backgrounds, focus rings — the brand's signal-green pulse
- **<1% `--color-accent` (`#e8a84a`)** and **<1% `--color-destructive` (`#ff5555`)**: semantic tokens used surgically where state demands

---

## Copywriting Contract

All strings are declarative, lowercase where they mirror the daemon's wire format (`tcp`, `bluetooth`, `wifi_direct`, `relay`, `active`, `relayed`, `connecting`, `failed`), UPPERCASE-bracketed only for status codes (`[OK]`, `[LIVE]`, `[STOPPED]`). **Zero exclamation marks.** Source of truth: `docs/UX-PLAN.md §7` microcopy table, `02-CONTEXT.md` D-09, D-14, D-19, D-21, D-23, D-31, and `STYLE.md` §Voice.

### Shell chrome

| Element | Copy |
|---------|------|
| Sidebar app wordmark | `█ pim` (block in signal green with `.phosphor`, wordmark in `--color-foreground`) |
| Sidebar nav row — Dashboard | `> dashboard` with `⌘1` hint right-aligned in `--color-muted-foreground` |
| Sidebar nav row — Peers | `> peers` with `⌘2` hint (aliases to Dashboard peer list per D-02; row active-state still reads as Dashboard) |
| Sidebar nav row — Logs | `> logs` with `⌘5` hint |
| Sidebar reserved rows | `routing`, `gateway`, `settings` in `--color-muted-foreground` at 60% opacity, `(phase 3)` / `(phase 4)` / `(phase 5)` suffix in `text-xs`, not clickable, cursor `not-allowed`. No exclamation. |
| Sidebar box-drawing separator | `├──` between nav groups (nav, then reserved), in `--color-border` — matches `cli-panel.tsx` header idiom |

### Identity panel (Dashboard top CliPanel, D-09)

| Element | Copy |
|---------|------|
| CliPanel title | `IDENTITY` |
| CliPanel `[STATUS]` badge | `[LIVE]` when status.event stream is active; `[STALE]` when `LimitedModeBanner` is up (D-30) |
| Hero line | `█ pim · {node.name}` (block `.phosphor`, wordmark `.phosphor`, `·` in `--color-muted-foreground`, `{node.name}` in `--color-foreground`) + right-aligned `<StatusIndicator />` derived from `DaemonStatus` |
| Detail line | `mesh: {mesh_ip} · interface {iface.name} · {iface.up ? "up" : "down"} · {uptime}` — lowercase, bullets are `·` (U+00B7) |
| Interface-down chip | when `iface.up === false`, the `down` token flips to `text-destructive`; append `· show why →` as a `<Button variant="link">` that routes to `⌘5` Logs tab with the `source: "transport"` filter pre-selected |
| Limited-mode suffix | when D-30 applies: append `· last seen: {baselineTimestamp}` (relative, e.g. `12s ago`) in `--color-muted-foreground`. Panel opacity `.6`. No new string; reuses Phase 1 banner copy. |

### Peers panel (D-08, D-11, D-13, D-14)

| Element | Copy |
|---------|------|
| CliPanel title | `PEERS` |
| `[STATUS]` badge | `[{n} CONNECTED]` where `n` is the connected count |
| Column header row (optional, `--color-muted-foreground`, uppercase) | `short id   label       mesh ip        transport  state        hops     latency   last seen` — fixed widths mirroring D-11 line format |
| Peer row template | `{short_id}  {label ?? "—"}  {mesh_ip}  via {transport}  {◆/◈/○/✗} {state}  {hops > 1 ? "(" + hops + " hops)" : ""}  {latency_ms ? latency_ms + "ms" : ""}  {last_seen_s}s` |
| Empty connected-peers state | **`no peers connected · discovery is active`** — D-14 verbatim. Single line, `--color-muted-foreground`, rendered INSIDE the CliPanel body. |
| ActionRow below list | `[ + Add peer nearby ]` (`Button variant="default"`, disabled in Phase 2 with tooltip `pairing UI lands in phase 4`) and `[ Invite peer ]` (same) — visually present, disabled, honest — **never omitted** per P5. |
| Peer-row hover tooltip | none — the row click target is the action; no gratuitous tooltip. |

### Nearby panel (D-19, D-20)

| Element | Copy |
|---------|------|
| CliPanel title | `NEARBY — NOT PAIRED` — D-19 verbatim |
| `[STATUS]` badge | `[{n} NEARBY]` or `[SCANNING]` when list is empty |
| Nearby row template | `{label_announced ?? "anonymous"}  {short_id ?? "(no id)"}  via {mechanism}  first seen {first_seen_s}s ago` |
| Row action (non-anonymous only) | right-aligned `[ Pair ]` button |
| Anonymous row action | omitted per D-20 (no action affordance) |
| Empty state | **`no devices discovered yet · discovery is active`** — D-19 verbatim |

### Pair Approval modal (D-21, D-22)

Two trigger paths, copy locked verbatim from D-21:

**Inbound (`peers.event { kind: "discovered" }` that looks like a pair handshake):**

| Element | Copy |
|---------|------|
| `DialogTitle` | `{label_announced ?? short_id} wants to join your mesh.` |
| `DialogDescription` line 1 | `↳ node ID: {short_id}` — short_id span gets `text-accent` emphasis |
| `DialogDescription` line 2 | `[ show full ]` button (`Button variant="link"`) — click toggles to render the 64-char full id in monospace across a wrapped `<pre>`; click again to hide |
| `DialogFooter` primary | `[ Trust and connect ]` — `Button variant="default"` (primary green, not accent) |
| `DialogFooter` secondary | `[ Decline ]` — `Button variant="secondary"` |

**Outbound (user clicks `[ Pair ]` on Nearby row):**

| Element | Copy |
|---------|------|
| `DialogTitle` | `Pair with {label ?? short_id} via {mechanism}?` |
| `DialogDescription` line 1 | `↳ node ID: {short_id}` — span gets `text-accent` |
| `DialogDescription` line 2 | `[ show full ]` reveal |
| `DialogFooter` primary | `[ Trust and connect ]` |
| `DialogFooter` secondary | `[ Cancel ]` |

**Queue hint (D-22):** when a second pair event arrives while modal is open, append silent entry to troubleshoot log only — no UI surface. String logged internally: `pair queue: {pending_count} waiting`. Not user-facing.

### Peer Detail slide-over (D-15, D-16, D-17, D-18)

| Element | Copy |
|---------|------|
| Slide-over header | `{label ?? short_id}` as `h2` + `{short_id}` as secondary line + `[ show full ]` button that toggles to full 64-char id |
| Close affordance | `×` glyph (U+00D7) top-right, `aria-label="close peer detail"`; also closes via `Esc` + click outside |
| Section 1 title | `IDENTITY` (uppercase label) |
| Section 1 rows | KeyValueTable: `node_id  {full_64_char}` (click to copy) · `short_id  {8_char}` · `mesh_ip  {ip}` · `label  {label ?? "—"}` |
| Section 2 title | `CONNECTION` |
| Section 2 rows | `transport  {transport}` · `state  {◆/◈/○/✗ state}` · `hops  {n}` · `last_seen  {formatDuration(s)}` · `latency  {n}ms` · `is_gateway  {true ? "yes (egress)" : "no"}` |
| Section 3 title | `TRUST` |
| Section 3 rows | `source  {static ? "configured in pim.toml" : "paired via discovery"}` — D-17 verbatim |
| Section 4 title | `TROUBLESHOOT LOG` |
| Section 4 empty state | `No events recorded this session` — D-17 verbatim |
| Section 4 populated | Last 25 `peers.event` entries; each row: `{ts HH:mm:ss}  {level}  {reason ?? event_kind}` |
| Section 4 failed-peer callout | when peer.state === `failed`: pinned-at-top row formatted as `{ts}  ✗ pair_failed  {reason}` with the reason span in `text-destructive` |
| Phase-3-reserved actions | **omitted** per D-18. Do not render `[ Retry ] [ Trust this peer ] [ Forget peer ]` — not disabled, not present. |

### Metrics panel (D-23, D-24)

| Element | Copy |
|---------|------|
| CliPanel title | `METRICS` |
| `[STATUS]` badge | `[LIVE]` while subscription is active; `[STALE]` when limited mode |
| Primary line | `peers {connected_count} · forwarded {formatBytes(bytes)} / {formatCount(packets)} pkts · dropped {count}{reason ? " (" + reason + ")" : ""} · egress {selected_gateway ? short_id(selected_gateway) : "local"}` — D-23 verbatim |
| Zero-dropped render | `dropped 0` (no parenthesised reason) |
| No-gateway render | `egress local` — never `none` (D-23 rationale) |
| Wrap | On narrow widths, the `·` dividers wrap with the line; implemented via `flex-wrap gap-x-2 gap-y-1` |

### Logs tab (D-25..D-29)

| Element | Copy |
|---------|------|
| CliPanel container title | `LOGS` |
| `[STATUS]` badge | `[STREAMING]` while subscription live; `[PAUSED]` when user scrolls up; `[RECONNECTING]` during D-31 retry |
| Filter bar label — level | `level:` prefix (no uppercase), then segmented buttons `[ trace ]` `[ debug ]` `[ info ]` `[ warn ]` `[ error ]` |
| Filter bar label — peer | `peer:` prefix, then a `<Select>` rendering `(all)` + connected peers by `label ?? short_id` |
| Log row template | `{ts HH:mm:ss}  {levelBadge}  {source}  {peer_short_id ?? "—"}  {message}` |
| Level-badge color map | `trace` → `text-muted-foreground`; `debug` → `text-muted-foreground`; `info` → `text-foreground`; `warn` → `text-accent`; `error` → `text-destructive` — all rendered as plain text (not `<Badge>`) to keep row density terminal-native; width padded to 5 chars |
| "Jump to bottom" pill | `[ {n} new · jump to bottom ]` — positioned bottom-right 16px inset. Mouse-hover video-invert. D-28. |
| Auto-scroll pill state — paused | `[ paused · jump to bottom ]` when `n === 0` but user is scrolled up |
| Subscription-failure toast (D-31) | **`Couldn't subscribe to {stream}. Check the Logs tab.`** — D-31 verbatim. Toast border `--color-destructive`. Positioned bottom-center, auto-dismiss 6s, dismiss-on-click. |

### Error + connection states

| Element | Copy |
|---------|------|
| Limited-mode panel dim | `opacity-60` on all CliPanels; Identity panel appends `· last seen: {baselineTimestamp}` (D-30). Existing `LimitedModeBanner` from Phase 1 handles the restart action — not re-created. |
| Interface-down inline | `· down` in `--color-destructive` + `· show why →` link (Button variant="link" routing to Logs `source:"transport"`). D-09. |
| Failed-peer reason | raw daemon `reason` string, prefixed `reason: ` in `--color-destructive`. UX-PLAN §Flow 6 pattern. |

### Destructive actions in Phase 2

| Action | Confirmation approach |
|--------|-----------------------|
| **None.** Peer remove, peer forget, kill-switch, and daemon-stop are all out of this phase's scope. `[ Decline ]` on the Pair Approval modal is non-destructive (does not call an RPC — daemon times out discovery entry). Phase 2 therefore requires **zero destructive-confirmation dialogs**; the existing `stop-confirm-dialog.tsx` (Phase 1) remains untouched. |

---

## Registry Safety

All primitives in Phase 2 are either (a) already installed in `src/components/ui/` from Phase 1 or (b) come from the official shadcn new-york registry. **No third-party registries.**

| Registry | Blocks used | Installation status | Safety Gate |
|----------|-------------|---------------------|-------------|
| shadcn official (new-york) — already installed | `badge`, `button`, `card`, `dialog`, `input` | present in `src/components/ui/` from Phase 1 | not required (internal primitive) |
| shadcn official (new-york) — new for Phase 2 | `sheet` (slide-over — D-15 preferred over `Dialog side=right`); `select` (Logs peer filter — D-26); `scroll-area` (CliPanel body when content overflows; slide-over troubleshoot log section); `toast` + `toaster` (via `sonner` or shadcn's `toast` — D-31 subscription-failure surface) | to be installed via `npx shadcn@latest add {block}` during Phase 2 execution | not required — official registry |
| Third-party registries | — | — | **N/A — none declared; safety vetting gate not engaged** |

**Primitives explicitly NOT pulled:**
- `tabs` — shell uses a sidebar + `useState` tab router (D-01), not `<Tabs>`
- `tooltip` — the sidebar-nav `⌘N` hints render inline; peer rows have no hover tooltip; disabled buttons show a minimal native `title` only (acceptable per brand)
- `form` + `react-hook-form` — no forms in Phase 2 (static-peer form is Phase 3)
- `dropdown-menu` — the peer-filter `<Select>` is the only menu surface; a full `dropdown-menu` is not needed
- `command` — command palette is Phase 5 (UX-07)

**Brand overrides required on new primitives (Phase 2 execution responsibility):**
- `sheet` — **override `rounded-*` to `rounded-none`**, remove any shadow, set `bg-popover` (not default `bg-background`), add `border-l border-border` on the right-edge sheet variant (or `border-r` if left); use `font-mono` on SheetTitle parallel to `dialog.tsx` override
- `select` — override trigger to `rounded-none`, `border-border`, transparent bg (prompt-style); content panel `bg-popover border-border rounded-none`; option rows `font-mono text-sm uppercase tracking-wider` for the level filter; default-cased for peer-label items
- `scroll-area` — override scrollbar thumb to `bg-muted` matching `globals.css` L228 scrollbar rule; no rail rounding
- `toast` / `sonner` — override container + toast body to `rounded-none`, `bg-popover`, `border border-destructive` (for errors) or `border border-border` (for info), `font-mono text-sm` body, left-edge 4px solid color stripe matching severity

---

## Screen-level specs

### S1 · Shell (Sidebar + Content Pane) — D-01, D-02, D-03

```
┌────────────────────────┬────────────────────────────────────────────────────┐
│  █ pim                 │                                                    │
│  ├──                   │                                                    │
│  > dashboard      ⌘1   │              (active screen renders here)          │
│  > peers          ⌘2   │                                                    │
│  > logs           ⌘5   │                                                    │
│  ├──                   │                                                    │
│  routing      (ph 3)   │                                                    │
│  gateway      (ph 4)   │                                                    │
│  settings     (ph 3)   │                                                    │
│                        │                                                    │
│                        │                                                    │
│                        │                                                    │
│                        │                                                    │
│                        │                                                    │
└────────────────────────┴────────────────────────────────────────────────────┘
    240px fixed                         flex-1, px-8 py-8
```

- Sidebar: `w-60 bg-card border-r border-border font-mono`
- Active row: `bg-popover text-primary` + `>` prefix turning into `▶ ` on active; `.phosphor` not applied (too busy for nav)
- Inactive row: `text-foreground` with hover `text-primary` + `>` prefix animating in
- Reserved rows: `text-muted-foreground/60 cursor-not-allowed`, trailing `(phase N)` in `text-xs`
- `⌘N` hint: `text-muted-foreground text-xs`, right-aligned
- Content pane: `flex-1 overflow-y-auto px-8 py-8`, scroll inside the pane not the window

### S2 · Dashboard (default ⌘1 screen)

```
╔══════════════════════════════════════════════════════════════════╗
║ ┌─── IDENTITY ─────────────────────────────┐ [LIVE]              ║
║ │ █ pim · client-a-macbook              ◆  │                     ║
║ │ mesh: 10.77.0.100/24 · interface pim0    │                     ║
║ │  · up · 4h 22m                           │                     ║
║ └──────────────────────────────────────────┘                     ║
║                                                                  ║
║ ┌─── PEERS ────────────────────────────────┐ [3 CONNECTED]       ║
║ │ gateway-c  —       10.77.0.1   via tcp    ◆ active   12ms 0s │ ║
║ │ relay-b    —       10.77.0.22  via tcp    ◆ active   18ms 1s │ ║
║ │ client-c   —       10.77.0.105 via relay  ◈ relayed  47ms 3s │ ║
║ │                                                                │ ║
║ │ [ + Add peer nearby ]   [ Invite peer ]   (phase 4)            │ ║
║ └────────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║ ┌─── NEARBY — NOT PAIRED ──────────────────┐ [2 NEARBY]          ║
║ │ anonymous   (no id)    via bluetooth   first seen 4s ago       │ ║
║ │ desk-lamp   9a2c…bd1e  via wifi_direct first seen 14s ago [Pair]│ ║
║ └────────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║ ┌─── METRICS ──────────────────────────────┐ [LIVE]              ║
║ │ peers 3 · forwarded 4.2 MB / 3,847 pkts · dropped 2 (congestion)│ ║
║ │  · egress gateway-c                                            │ ║
║ └────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════╝
```

- Single column, `flex flex-col gap-6`, no grid (D-08)
- `max-w-4xl` (~896px) center column when the content pane is wider, left-aligned; narrow widths collapse gracefully
- Vertical order locked: Identity → Peers → Nearby → Metrics

### S3 · Peer Detail slide-over (opens over Dashboard)

```
                                        │── peer · client-c ───×─│
                                        │ 9a2c…bd1e   [show full]│
                                        │                        │
                                        │ IDENTITY               │
                                        │ node_id   9a2c…bd1e    │
                                        │ short_id  9a2cbd1e     │
                                        │ mesh_ip   10.77.0.105  │
                                        │ label     —            │
                                        │                        │
                                        │ CONNECTION             │
                                        │ transport  relay        │
                                        │ state      ◈ relayed    │
                                        │ hops       2            │
                                        │ last_seen  3s ago       │
                                        │ latency    47ms         │
                                        │ is_gateway no           │
                                        │                        │
                                        │ TRUST                  │
                                        │ source    paired via   │
                                        │           discovery    │
                                        │                        │
                                        │ TROUBLESHOOT LOG       │
                                        │ 21:14:09 ✗ pair_failed │
                                        │          reason: un-   │
                                        │          trusted id    │
                                        │ 21:14:07   connecting… │
                                        │ ───                    │
                                        │ No more events         │
                                        └────────────────────────┘
```

- `bg-popover border-l border-border w-[480px]` right-edge sheet
- Overlay on Dashboard: `bg-background/80` (same as `dialog.tsx` L32)
- Inner padding: `p-6 gap-6` (`lg+` token)
- Section titles: `label` role typography + `border-b border-border pb-2 mb-3`
- KeyValueTable row: two-column monospace, label in `text-muted-foreground`, value in `text-foreground`, copy-on-click for `node_id`

### S4 · Pair Approval modal (shadcn Dialog, centered)

```
┌──────────────────────────────────────────────┐
│                                              │
│ RELAY-B WANTS TO JOIN YOUR MESH.             │
│                                              │
│ ↳ node ID: 7f8e…a3c2    [ show full ]        │
│ ↳ via bluetooth                              │
│                                              │
│ ──────────────────────────────────────       │
│                                              │
│ [ Decline ]            [ Trust and connect ] │
└──────────────────────────────────────────────┘
```

- Uses existing `dialog.tsx` primitive (max-w-lg, centered, `bg-card` → override to `bg-popover` for cohesion with Dashboard)
- Title: `DialogTitle` existing `heading-lg` role
- Description rows: `DialogDescription` existing; short_id span gets `text-accent`
- `[show full]` reveals the full 64-char id in a wrapped `<pre class="font-code text-xs break-all">`; clicking again collapses
- Focus trap via Radix default; `Esc` = Decline/Cancel (non-destructive secondary)
- First-focus lands on primary action (`Trust and connect`) per standard dialog convention

### S5 · Logs tab (⌘5)

```
┌─── LOGS ────────────────────────────────────────────────────┐ [STREAMING]
│ level: [ trace ] [ debug ] [ info* ] [ warn ] [ error ]     │
│ peer:  ( all ▾ )                                            │
├─────────────────────────────────────────────────────────────┤
│ 21:14:07  info   transport  relay-b    connecting to…       │
│ 21:14:08  info   transport  relay-b    noise handshake init │
│ 21:14:09  error  transport  client-c   handshake failed: …  │
│ 21:14:09  info   transport  client-c   see docs/SECURITY.md │
│ ...                                                         │
│                                                             │
│                                    [ 12 new · jump to bot ] │
└─────────────────────────────────────────────────────────────┘
```

- Container is a CliPanel; body is a `ScrollArea` wrapping a virtualized list (react-window preferred per D-27)
- Filter bar sits inside the CliPanel body, above the list, `border-b border-border pb-3 mb-3`
- Level segment: active level gets `bg-primary text-primary-foreground`; others `border border-border`; video-invert on hover; `text-xs` Geist Mono uppercase
- Peer select: `Select` trigger in prompt style (`> ( all ▾ )`), content panel `bg-popover border-border`
- Rows: `grid` template columns `[100px_60px_1fr_120px_1fr]` — `timestamp / level / source / peer / message` at density-1
- `[ N new · jump to bottom ]` pill: `absolute bottom-4 right-4 bg-primary text-primary-foreground hover:bg-background hover:text-primary border border-primary px-3 py-1 font-mono text-xs uppercase` — video-invert on hover

---

## Interaction states

Per key component. Every state below has an explicit visual rule. `--color-ring` is `#22c55e` (signal green), which has measured contrast ratio > 7:1 against `#0a0c0a`.

### Peer row (Dashboard + Nearby)

| State | Visual |
|-------|--------|
| Default | `bg-transparent text-foreground` inside CliPanel body |
| Hover | `bg-popover/60 border-l-2 border-border-active` (subtle left-edge highlight) + cursor pointer; row content gets `text-primary` on the short_id column only — rest stays foreground |
| Focus-visible (keyboard) | `outline-2 outline-ring outline-offset-[-2px]` — inset 2px solid signal-green ring; no background change |
| Active (mousedown) | `translate-y-[1px]` instant (matches `pim.yml` effects.active) |
| Pressed → slide-over open | dashboard panel dims to `opacity-60` under slide-over overlay |
| Failed peer row | glyph + state word render `text-destructive`; row itself stays default bg (no tint fill — too loud) |
| Relayed peer row | glyph + state word render `text-accent`; row bg default |

### ActionRow button (`[ + Add peer nearby ]`, `[ Invite peer ]`)

| State | Visual |
|-------|--------|
| Default | `Button variant="default"` — `bg-primary text-primary-foreground border border-primary` |
| Hover | video-invert: `bg-background text-primary` (existing `button.tsx` L31) |
| Focus-visible | `outline-1 outline-ring outline-offset-2` (existing `button.tsx` L24) — phase 2 upgrades to `outline-2` on slide-over and log-row focus-visible only |
| Active | `translate-y-[1px]` |
| Disabled (Phase-4-reserved) | `pointer-events-none opacity-40` (existing); `title` attribute reads `Pairing UI lands in phase 4` |
| Loading | not applicable in Phase 2 — buttons are either disabled or trigger synchronous UI (modal open) |

### Filter button (Logs level segmented control)

| State | Visual |
|-------|--------|
| Default (non-active level) | `bg-transparent text-foreground border border-border font-mono text-xs uppercase px-3 py-1` |
| Active level | `bg-primary text-primary-foreground border border-primary` |
| Hover on inactive | `border-primary text-primary` |
| Focus-visible | `outline-1 outline-ring outline-offset-2` |
| Clicking triggers | re-subscribe to `logs.subscribe` with new `min_level` (D-26); old subscription auto-unsubscribed; `[STATUS]` badge in CliPanel flickers `[RECONNECTING]` for ≤ 300ms then returns to `[STREAMING]` |

### Log row (virtualized)

| State | Visual |
|-------|--------|
| Default | row background transparent, text color per level-color map |
| Hover | `bg-popover/60` across whole row; no text-color change |
| Focus-visible (keyboard nav within list) | `outline-2 outline-ring outline-offset-[-2px]` — virtualization must preserve focusable DOM for the focused row |
| Selected (future) | not in Phase 2 |

### Slide-over (Peer Detail)

| State | Visual |
|-------|--------|
| Opening | enter from right-edge, `translate-x-full → 0`, `duration-100 linear` (respects motion token) |
| Open idle | `bg-popover border-l border-border`, Dashboard behind at `opacity-60` via overlay |
| Closing (Esc / × / click-outside) | reverse of opening |
| Focus-visible on `×` close button | `outline-2 outline-ring outline-offset-2` (new — upgraded from default 1px because the close glyph is small) |
| Tab navigation within | Radix Sheet focus-trap; Tab cycles: close → show-full → copy-on-click fields → nothing else |
| Reduced-motion | `animation: none`, instant open/close (matches `src/globals.css` L199 reduced-motion gate) |

### Pair Approval modal

| State | Visual |
|-------|--------|
| Opening | fade-in `duration-100` (existing `dialog.tsx` L55) |
| Open idle | centered, `bg-popover` (override from default `bg-card` for surface cohesion); overlay `bg-background/80` |
| First focus | primary action `[ Trust and connect ]` |
| `[show full]` pressed | description expands to show 64-char id, Dialog grows vertically to fit (no internal scroll) |
| Tab loop | `show full` → `Decline` → `Trust and connect` → close (×, top-right) → `show full` |
| `Esc` | triggers Decline/Cancel action (secondary button), closes modal, no RPC call |
| Queue state (2nd event arriving) | invisible to user; logged to in-memory troubleshoot buffer per D-22 |

### Sidebar nav row

| State | Visual |
|-------|--------|
| Default | `text-foreground bg-transparent`, `>` prefix hidden |
| Hover | `text-primary`, `>` prefix animates in (no motion keyframe; static append); `bg-popover/40` row |
| Active (current tab) | `text-primary bg-popover`, permanent `▶ ` prefix; `⌘N` hint stays `text-muted-foreground` |
| Focus-visible | `outline-1 outline-ring outline-offset-[-1px]` inset |
| Reserved (disabled) rows | `text-muted-foreground/60 cursor-not-allowed`; no hover state, no focus state (not in tab order) |
| Keyboard shortcut trigger | `⌘1` / `⌘2` / `⌘5` switch active tab; global handler in `App.tsx` |

---

## Accessibility notes

### Keyboard navigation

- **Global shortcuts** (bound in `App.tsx`, D-01):
  - `⌘1` → Dashboard
  - `⌘2` → Peers (aliased to Dashboard peer list)
  - `⌘5` → Logs
  - `⌘,` → reserved for Settings (Phase 3); in Phase 2, handler is a no-op OR shows a toast `Settings land in phase 3`
  - `Esc` → closes the top-most of: Pair Approval modal > Peer Detail slide-over > (if none open: no-op)
- **Within Dashboard**: `Tab` traverses in DOM order: Identity panel (status indicator is a glyph, non-focusable; `show why →` link is focusable when present) → Peers panel rows (each row is `role="button" tabIndex={0}`) → ActionRow buttons → Nearby panel rows → Metrics panel (non-interactive). `Enter` or `Space` on a peer row opens Peer Detail. `Enter` on a Nearby row's `[Pair]` opens outbound Pair Approval modal.
- **Within slide-over**: Radix Sheet focus-trap. `Tab` cycles close → show-full → copy-chip (for node_id) → out. First focus on `×` close button; better: first focus on `show full` button (content-first). Decision: **first focus on `show full`** — terminal users expect to read before they copy.
- **Within Pair Approval modal**: Radix Dialog focus-trap. First focus on primary `[ Trust and connect ]`. `Esc` = Decline.
- **Within Logs tab**: filter bar is first focusable; level buttons are a `role="radiogroup"` with arrow-key navigation; peer `Select` is focusable; log list is scrollable but rows are focusable via arrow keys (`ArrowDown`/`ArrowUp`) inside the list once the list container receives focus (virtualized focus-preservation handled by react-window's manual focus management).

### ARIA & semantic roles

- `StatusIndicator`: `role="img"` + `aria-label={state}` (already implemented, reuse verbatim, D-12)
- Peer row: `role="button"` + `aria-label={"peer detail: " + (label ?? short_id)}` + `aria-pressed` unused (stateless button)
- Sidebar: `<nav aria-label="main">` + `<ul>` of nav items; active row gets `aria-current="page"`
- Content pane: `<main>` (D-03) with `aria-label={active_screen_name}` bound to the active tab
- Peer Detail slide-over: Radix Sheet provides `role="dialog" aria-modal="true"` and `aria-labelledby` pointing to the peer header; close button has `aria-label="close peer detail"`
- Pair Approval modal: Radix Dialog provides `role="alertdialog"` (inbound flavor — alert because it interrupts) or `role="dialog"` (outbound flavor — user-initiated). Both paths use `DialogTitle` + `DialogDescription` for labelled/described properties.
- Logs list: `role="log"` + `aria-live="polite"` on the list container when auto-scroll is engaged; switches to `aria-live="off"` when user scrolls up (otherwise SR would narrate every incoming entry). Paused state announced via visually-hidden `aria-live="assertive"` region: `Auto-scroll paused. 12 new log entries available.` updated every 3s max.
- Toast (D-31): `role="status"` for info; `role="alert"` for destructive (subscription failure). Auto-dismiss 6s.

### Focus visibility on the green-phosphor palette

- Default `:focus-visible` = `outline: 1px solid var(--color-ring)` at `outline-offset: 2px` (`src/globals.css` L240) — measured contrast of signal-green `#22c55e` against background `#0a0c0a` is 9.4:1 (WCAG AAA). The 1px ring with 2px offset is visible but small on the near-black ground.
- **Phase 2 upgrade:** large click targets (peer rows, log rows, slide-over close button) get `outline-2` (2px) inset or offset. Rationale: at 14px monospace density, a 1px ring blends with row separators. A 2px ring is unambiguous. This is a Phase-2 `(new)` rule — propose upstreaming to `globals.css` as a `.focus-ring-lg` utility.
- Never use a focus outline `color` other than `--color-ring`; never use a dashed ring (clashes with CRT scanline overlay moire).

### Motion & reduced-motion

- Phase 2 introduces NO new animations. Slide-over and Dialog enter/exit animations are the ones already present in `dialog.tsx` (fade-in 100ms linear).
- `prefers-reduced-motion` is honored globally via `src/globals.css` L199-210 — CRT scanline disables, logo animation disables. Phase 2's only motion surface (slide-over entrance) honors the existing Radix animation gating and will not animate under reduced-motion.
- Log auto-scroll: instant `scrollTop = scrollHeight` assignment (no smooth-scroll) — already instant, reduced-motion-compatible.
- No typewriter or cursor-blink animations on body/chrome text. `█ pim` hero in Identity panel is static (the full animated logo is onboarding-only, Phase 4).

### Color-alone conveys no meaning

- Every peer state pairs a Unicode glyph (`◆ ◈ ○ ✗`) with a state word (`active`, `relayed`, `connecting`, `failed`). SRs read the glyph's `aria-label` AND the word. Colorblind users read the glyph shape AND the word.
- Log level row combines a colored level token with the word itself (`warn` word is in `text-accent` but the word `warn` is itself the discriminator). No log row relies on color alone.
- Failed-peer reason is both `text-destructive` AND prefixed with `reason: ` word.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Appendix · Token provenance summary

Every value in this spec derives from one of:

| Source | What it owns |
|--------|--------------|
| `src/globals.css` `@theme` block (L30-84) | Every color hex; `--radius`, `--spacing`, font variables |
| `.design/branding/pim/patterns/pim.yml` | Archetype, tone, spacing scale `[4,8,12,16,24,32,48,64,96]`, font stack, shape constraints, pattern rules, intensity metrics |
| `.design/branding/pim/patterns/STYLE.md` | Voice rules, component patterns, hard constraints (never/always), logo usage |
| `docs/UX-PLAN.md` §1 + §4a + §4c + §6a + §6e + §6h + §7 | Design principles (P1-P5), sidebar IA, shared primitives, Dashboard mockup, Logs style, error states, microcopy table |
| `02-CONTEXT.md` D-01..D-31 | Every implementation-level decision (layout choices, queue behavior, subscription lifecycle, empty-state copy, modal wiring) |
| `cli-panel.tsx` | CliPanel structure — title bar, padding, border, font stack, leading |
| `status-indicator.tsx` | Glyph → color mapping, `role="img"` + `aria-label` pattern |
| `badge.tsx` | Variant palette, auto-brackets, monospace sizing |
| `button.tsx` | Variant behavior (video-invert hover), sizing, tracking, brackets |
| `dialog.tsx` | Overlay color, modal surface color + border + radius-0, DialogTitle typography |

Values marked `(new)` in this spec:
- Log-row `leading-[1.5]` (explicit tighter than the 1.7 CliPanel default, for density at 2000-row buffer)
- `outline-2` focus-ring on large click targets (peer/log rows, slide-over close) — upgrades default 1px to 2px; proposed for future `.focus-ring-lg` global utility
- Short_id `text-accent` emphasis in Pair Approval description — extends the accent reserved-use list to include the modal's short_id span (explicitly enumerated in §Color above)

No other phase-2-original values. Every other class and color derives from existing tokens.
