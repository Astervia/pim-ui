---
phase: 3
slug: configuration-peer-management
status: draft
shadcn_initialized: true
preset: new-york (manual pim brand override via src/globals.css)
created: 2026-04-24
mode: auto
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for the Configuration & Peer Management phase.
> Authored by `gsd-ui-researcher` in AUTO mode from:
> `docs/UX-PLAN.md` §1 / §3f / §3j / §3k / §4a / §6f / §6h / §7 / §8,
> `.design/branding/pim/patterns/pim.yml`, `.design/branding/pim/patterns/STYLE.md`,
> `src/globals.css`, `03-CONTEXT.md` (D-01..D-32, locked 2026-04-24),
> `02-CONTEXT.md` (D-01..D-31 for the sidebar shell Phase 3 extends),
> `02-UI-SPEC.md` (visual vocabulary Phase 3 must remain coherent with),
> Phase 1 primitives in `src/components/brand/` + `src/components/ui/`,
> and the `ConfigGetParams / ConfigSaveParams / PeersAddStaticParams / PeersRemoveParams` types
> from `src/lib/rpc-types.ts`.

Phase 3 is **purely additive** over Phase 2 — the shell, color palette, typography, and
spacing scale from `02-UI-SPEC.md` are the substrate. Every new surface in Phase 3 is
built from tokens already in `src/globals.css`; one `(new)` spacing constant (the
raw-TOML gutter width) is declared and justified inline. No gradients. No border-radius.
No drop shadows beyond existing `CliPanel` convention. Zero new hex literals.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn (CLI v-next, new-york variant) | `components.json` |
| Preset | Manual pim override via `src/globals.css` `@theme` | `components.json` + `src/globals.css` L30-84 |
| Component library | Radix UI (via shadcn new-york) | existing `@radix-ui/react-dialog`, `@radix-ui/react-slot`; **added Phase 3**: `@radix-ui/react-switch`, `@radix-ui/react-radio-group`, `@radix-ui/react-collapsible`, `@radix-ui/react-alert-dialog` (shadcn transitive) |
| Icon library | **Unicode glyphs + box-drawing first; lucide-react only for non-semantic affordances** (chevron ▾/▸ in collapsible headers, `×` close in sheet). Status is ALWAYS Unicode (`◆ ◈ ○ ✗`). `⚠` for pending-restart and raw-TOML gutter markers. | `pim.yml` constraints.always, `STYLE.md` §Always |
| Fonts | **Geist Mono** (section titles, labels, buttons, chevrons, radio/switch labels, one-line summaries); **JetBrains Mono** via `var(--font-code)` (raw TOML textarea body + line-number gutter + TOML error gutter rows); **Geist** sans NOT used in Phase 3 | `src/globals.css` L32-35 |
| Base font size | `14px` on `html` | `src/globals.css` L94 |
| CRT scanline overlay | Applied globally at `body::before` — inherited, never per-component | `src/globals.css` L107-123 |
| Border-radius | `0` everywhere (`--radius: 0`) | `src/globals.css` L78 |
| Shadows / glows | No shadows. `.phosphor` reserved for signal-green active state only (status-panel-hero `●` + `█ pim` wordmark) — never on Settings chrome, never on Peers Sheet, never on raw TOML editor | `src/globals.css` L160-164 |
| Transitions | `duration-100 ease-linear` everywhere except collapsible expand/collapse — see Motion | `pim.yml` motion |

---

## Spacing Scale

Anchored to `pim.yml` `tokens.spacing` `[4, 8, 12, 16, 24, 32, 48, 64, 96]` and Tailwind
v4's `--spacing: 0.25rem`. Phase 3 uses the Phase 2 subset plus one new fixed
constant; no other step values appear in new code.

| Token | Tailwind class | Pixels | Usage in Phase 3 |
|-------|----------------|--------|------------------|
| `xs` | `gap-1` / `p-1` | `4px` | Chevron ↔ one-line-summary gap in section header; radio label glyph gap; dirty-dot glyph spacing |
| `sm` | `gap-2` / `p-2` | `8px` | Form label ↔ input gap; inter-field tight grouping (e.g. `static` radio row children); remove-button icon internals |
| `md-` | `p-3` / `gap-3` | `12px` | Collapsible body inner top/bottom padding (after the CliPanel body padding); Remove-AlertDialog internal separator gap |
| `md` | `p-4` / `gap-4` | `16px` | CliPanel body padding inherited (unchanged); Settings Save-row gap between Save + inline errors; Peers-tab action-row ↔ list gap |
| `lg` | `p-5` / `py-5` | `20px` | CliPanel body inner X-padding (inherited from Phase 2) |
| `lg+` | `gap-6` / `p-6` | `24px` | Vertical gap **between stacked collapsed settings sections**; Sheet outer padding; AlertDialog inner padding; raw-TOML container inner padding-around-textarea |
| `xl` | `gap-8` / `py-8` | `32px` | Settings column outer top/bottom padding; vertical gap **between** large logical section groups on the Settings page (none in Phase 3 — all sections share `lg+` gap) |

**Fixed-dimension constants (exceptions, documented inline):**

| Constant | Value | Justification |
|----------|-------|---------------|
| Sidebar width | `240px` (`w-60`) | Inherited verbatim from Phase 2 `02-UI-SPEC.md §Spacing`; Phase 3 only flips the `Settings` row from grayed to active and adds no new nav rows |
| Peers-Sheet (Add static peer) width | `480px` (`w-[480px]`) | Matches Phase 2 Peer Detail slide-over — same `Sheet` primitive, same right-edge position, single visual grammar for right-edge surfaces (D-16) |
| Settings content column max-width | `max-w-3xl` (≈ `768px`) | Narrower than Dashboard's `max-w-4xl` because (a) form rows read faster at ≤ 72 monospace chars and (b) leaves room for the raw-TOML editor to breathe horizontally without layout shift. Left-aligned inside the content pane. |
| Raw TOML textarea row height | `22px` line-height target (`leading-[22px]`) | Tight-but-readable monospace; aligns with the line-number gutter row grid so `⚠` markers sit on the baseline of the erroring line |
| **Raw TOML line-number gutter width** (`(new)`) | `48px` (`w-12`) | Tuned for 4-digit line numbers at `14px` Geist Mono width (~8.4px/char) + left/right breathing room. Declared new because no Phase 2 surface needed it. |
| AlertDialog max-width | `max-w-md` (existing `dialog.tsx` value) | Reused primitive; Remove-peer + Discard-unsaved-changes dialogs both fit under the default |
| Debug-snapshot toast position | `bottom-right offset 16px` | Inherited from `sonner` `<Toaster>` already mounted in `main.tsx` (`reconnect-toast.tsx` L17) |
| Pending-restart `⚠` glyph gap | `0.5ch` before the restart-summary text | Monospace-natural spacing, no Tailwind class needed |

Exceptions: listed above. No 6/10/14/18/22/26 px values anywhere.

---

## Typography

Monospace-first. **Two weights only — 400 + 600** — mirroring `pim.yml` verbatim and
matching Phase 2's contract. No sans-serif in Phase 3.

| Role | Tailwind class | Font | Size / line-height | Weight | Usage |
|------|----------------|------|---------------------|--------|-------|
| `body` (form field labels, radio/switch labels, Peers Sheet copy, Remove dialog body, About field values) | `font-mono text-sm leading-[1.6]` | Geist Mono | 14px / 1.6 | 400 | Every label and helper line in Settings + Peers Sheet + AlertDialogs |
| `body-dense` (raw TOML textarea content, line-number gutter, TOML error `col X: message` rows) | `font-code text-sm leading-[22px]` | JetBrains Mono | 14px / 22px | 400 | Raw-TOML editor — tighter leading than CliPanel body for dense source code readability |
| `label` (CliPanel title, `[STATUS]` badge, Save button, Cancel/Remove button, radio/switch group legend, one-line summary text in collapsed headers) | `font-mono text-xs uppercase tracking-widest` | Geist Mono | 12px / 1.6 | 400 | CliPanel header (inherited from `cli-panel.tsx` L35); section summary text; all bracketed action buttons |
| `heading` (Peers Sheet title `Add a static peer`, AlertDialog title `Remove {label}?`, raw-TOML banner heading) | `font-mono text-sm uppercase tracking-wider` | Geist Mono | 14px / 1.6 | 600 | Matches Phase 2 slide-over `heading` role verbatim — one visual grammar for modal/sheet titles |
| `heading-lg` (Remove-peer / Discard-changes `DialogTitle`) | `font-mono text-lg tracking-wider` | Geist Mono | 18px / 1.6 | 600 | Reuses `dialog.tsx` L84 primitive verbatim |

**Line-height policy:**
- Body + labels + form rows: `1.6` (html default, Phase 2 match)
- Raw TOML textarea + gutter + error rows: `22px` absolute — chosen so line-number gutter grid aligns 1:1 with textarea rows; measured against `14px` JetBrains Mono cap-height
- Section one-line summary: `1.6` (inherits label role)
- AlertDialog body: `1.6`

**No new heading sizes.** The Settings column has no heading beyond the `CliPanel` title
(`label` role) for each section. Page-level H1 is omitted: the sidebar's `▶ settings`
active row is the page indicator; the terminal aesthetic treats a redundant heading as
chrome noise (consistent with `UX-PLAN §1 P1` honest-over-polished and Phase 2 Dashboard
which also omits an H1).

**Component-level weight override (documented, not a type role):** `button.tsx` primary
variant internally uses `font-weight: 500`. This is a primitive-level override inherited
from Phase 1, not a third weight in the role contract. The role contract remains
`{400, 600}`.

---

## Color

Anchored to `src/globals.css` `@theme`. Every color reference in Phase 3 code uses a
CSS variable via a Tailwind class — **no hex literals in new code**.

| Role | Token | Hex | Usage in Phase 3 |
|------|-------|-----|------------------|
| Dominant (60%) | `--color-background` | `#0a0c0a` | App shell background unchanged; Settings content pane background; Peers-tab background; raw-TOML gutter inner-panel background |
| Secondary (30%) | `--color-card` | `#121513` | Sidebar surface (unchanged); Peers Sheet outer body background matches Phase 2 slide-over grammar |
| Secondary (30%) | `--color-popover` | `#1a1e1b` | **Every Settings CliPanel body**; AlertDialog surface (overrides default `bg-card` for cohesion); raw-TOML textarea background — all match Phase 2 `CliPanel` surface |
| Secondary (30%) | `--color-muted` | `#2a2e2c` | Disabled-when-daemon-stopped input fills; Peers-tab Remove-button default border; raw-TOML line-number gutter background (faintly distinct from textarea body) |
| Accent (10%) — reserved | `--color-accent` | `#e8a84a` | **ONLY** — same reserved list as Phase 2, extended with exactly TWO Phase-3 surfaces: (a) the `⚠ Pending restart` glyph + text in a collapsed section summary (D-25); (b) the `⚠` gutter marker + the `col X: message` inline row in the raw-TOML editor when a daemon validation error targets a line (D-14). Nothing else. |
| Semantic — success | `--color-primary` | `#22c55e` | Save button background (primary); per-section dirty indicator dot (`·` rendered next to the section title when `isDirty === true`); `[SAVED]` transient badge on a section that just successfully saved (2s auto-revert to `[OK]`); AlertDialog primary action where non-destructive (does not apply to Remove — that uses destructive); focus ring `--color-ring` |
| Semantic — connecting / metadata | `--color-muted-foreground` | `#7a807c` | Disabled section body text; read-only field values (Identity `node_id`/`public_key`); section chevrons `▾/▸` in the default (non-hover) state; Peers Sheet placeholder text; Remove-dialog secondary body line |
| Destructive | `--color-destructive` | `#ff5555` | **Remove peer** primary action in AlertDialog (destructive variant); raw-TOML inline error-line text (`col X: message` in `text-destructive`, but the leading `⚠` gutter glyph is `text-accent` — see Raw TOML section for the two-tone rationale); daemon-reject toast left-edge stripe (reuses Phase 1 `reconnect-toast.tsx` convention); `peers.add_static` `-32011` / `-32012` inline error text beneath the Address field |
| Borders (neutral) | `--color-border` | `#2a2e2c` | Every CliPanel outer border (unchanged); Sheet left-edge divider; AlertDialog border; form field borders (`input.tsx` default); collapsible section body top-border when expanded; raw-TOML gutter right-edge divider |
| Border (active/hover) | `--color-border-active` | `#3a5a3e` | Collapsible section header hover border; Peers-Sheet `[ Add peer ]` hover; focused form field border (augments focus ring) |
| Phosphor glow | `.phosphor` utility | existing | Not used anywhere in Phase 3 (no brand-hero surfaces in this phase) |

### Accent reserved for (exhaustive list, enforced by checker)

Phase 2's existing four accent uses remain. Phase 3 adds exactly two:

1. (Phase 2) `<StatusIndicator state="relayed" />` — the `◈` glyph color
2. (Phase 2) `<Badge variant="warning">WARN</Badge>` in the Logs filter bar
3. (Phase 2) `warn`-level log-row label text
4. (Phase 2) Short_id emphasis span in the Pair Approval modal
5. **(Phase 3, new)** `⚠ Pending restart: {fields}` glyph + text inside a collapsed section's one-line summary, per D-25 step 4. Rendered as `text-accent font-mono` inline with the summary's other `·`-separated tokens.
6. **(Phase 3, new)** Raw-TOML gutter `⚠` glyph + the line-number in the gutter for an erroring row (`text-accent` on both). The inline `col X: message` row directly below the erroring textarea line stays `text-destructive` — the two-tone split intentionally distinguishes the *location marker* (accent — your attention lands here) from the *failure reason* (destructive — this is what the daemon rejected).

**Do NOT use accent for:** primary CTAs (all Save + Add peer + Restart buttons use `--color-primary`), dirty indicators, section active/focus states, peer remove confirmation, Sheet title or copy, About-section links, any hover state, any focus state, any button background.

### 60 / 30 / 10 split — verified

- **60% `--color-background` (`#0a0c0a`)**: shell + main pane + sidebar edge
- **30% `--color-popover` / `--color-card`**: Settings CliPanel bodies + Sheet + AlertDialog surfaces
- **10% `--color-primary` (`#22c55e`)**: Save buttons, dirty dots, `[OK]`/`[SAVED]` badges, focus rings
- **<1% `--color-accent` (`#e8a84a`)** and **<1% `--color-destructive` (`#ff5555`)**: pending-restart + raw-TOML error gutter; Remove-peer action + daemon-reject copy

---

## Copywriting Contract

All strings declarative. **Zero exclamation marks.** Daemon wire values (`tcp`,
`bluetooth`, `wifi_direct`, `allow_all`, `allow_list`, `TOFU`, `static`, `auto`,
`relayed`, `active`, `connecting`, `failed`, field paths like `transport.listen_port`)
are rendered **verbatim** inside code-formatted contexts (labels, raw-TOML editor,
error messages, tooltips) per `UX-PLAN §7` and `03-CONTEXT.md` `<specifics>`. Display
labels for non-technical users use Aria-copy from `UX-PLAN §7`. Source of truth:
`UX-PLAN §6f`, `§7`, `§8`, `03-CONTEXT.md` D-14 / D-15 / D-17 / D-18 / D-19 / D-25 /
D-32 / `<specifics>`.

### Primary CTAs (locked verbatim)

| Element | Copy |
|---------|------|
| Per-section save button (every settings section, idle + dirty) | `[ Save ]` |
| Per-section save button (in-flight) | `[ Saving… ]` |
| Per-section save button (post-save, 2s) | `[ Saved ]` |
| Restart toast primary action (D-25) | `[ Restart ]` |
| Peers tab action row | `[ + Add static peer ]` |
| Peers Sheet primary action | `[ Add peer ]` |
| Peers Sheet secondary action | `[ Cancel ]` |
| Remove-peer AlertDialog primary action | `[ Remove ]` |
| Remove-peer AlertDialog secondary action | `[ Cancel ]` |
| Unsaved-changes AlertDialog primary action (D-13) | `[ Discard ]` |
| Unsaved-changes AlertDialog secondary action (D-13) | `[ Stay ]` |
| Raw-is-source-of-truth banner action (D-15) | `[ Open Advanced ]` |
| Logs export | `[ Export debug snapshot ]` |
| Logs custom time-range submit | `[ Apply ]` |
| Logs custom time-range secondary | `[ Cancel ]` |
| About: Copy source path | `[ Copy path ]` |
| About: Open crash log | `[ Open crash log ]` |

### Shell chrome (Sidebar row Phase 3 flips live)

| Element | Copy |
|---------|------|
| Sidebar `settings` row label (now active, D-01) | `> settings` with `⌘6` hint right-aligned — active state replaces `>` with `▶ ` — Phase 2 shell convention preserved |
| Sidebar rows still grayed | `routing` (phase 4), `gateway` (phase 5) — unchanged from Phase 2 |

> Keyboard shortcut is `⌘6` per `UX-PLAN §4a` + `03-CONTEXT.md` D-01. This supersedes
> the `⌘,` placeholder Phase 2 reserved. `⌘,` remains a global alias for `settings`
> in `App.tsx` to satisfy the macOS Preferences idiom, but the visible sidebar hint is
> `⌘6` for consistency with the numeric row convention Phase 2 established.

### Settings page — the nine section titles (verbatim, fixed order)

Order locked by `UX-PLAN §6f` + ROADMAP criterion 1 + `CONF-01`. Rendered as the
`CliPanel` title in `label` typography (uppercase applied by the primitive).

1. `IDENTITY`
2. `TRANSPORT`
3. `DISCOVERY`
4. `TRUST`
5. `ROUTING`
6. `GATEWAY`
7. `NOTIFICATIONS`
8. `ADVANCED — RAW CONFIG`
9. `ABOUT`

### One-line summary format (collapsed state, D-05)

Locked shape: `{key}: {value} · {key}: {value} · {N} {thing}`. Separator is the
middle dot `·` (U+00B7), **never** a comma. Summary renders in `label` typography
to the right of the `┌─── TITLE ───┐` header, before the chevron.

Per-section summary templates (Phase 3 canonical):

| Section | Summary template |
|---------|------------------|
| Identity | `{node.name} · {short_id}` |
| Transport | `interface {iface} · mtu {mtu} · mesh_ip {mode} · port {listen_port}` |
| Discovery | `broadcast {on/off} · BLE {on/off} · wifi_direct {on/off} · {N} trusted peer{N≠1?s:}` |
| Trust | `policy: {allow_all \| allow_list \| TOFU}` (daemon raw values; no translation in summary) |
| Routing | `max_hops {n}` — Phase 3 knob set is minimal per D-19; may additionally render `· route_expiry {s}s` when that knob is schema-known |
| Gateway | `linux-only · disabled` (macOS/Windows) OR `linux · disabled` OR `linux · enabled via {iface}` (placeholder — full gateway control is Phase 5) |
| Notifications | `all-gateways-lost {on/off} · kill-switch {on/off}` |
| Advanced — raw config | `{n} lines · last saved {ts relative}` |
| About | `pim-ui {ui_version} · daemon {daemon_version} · {build_hash?}` |

**Pending-restart appended token (D-25 step 4):** when a section has a non-empty
pending-restart set, append ` · ⚠ pending restart: {fields.join(", ")}` to that
section's summary. Rendered in `text-accent`. The `⚠` glyph is reserved in `pim.yml`
`icon-set` for this state.

### Form field labels (Aria-copy per `UX-PLAN §7`; daemon wire names in `ⓘ` tooltip)

Every label renders above its control. Hover/focus on the label (or on a right-aligned
`ⓘ` icon) reveals a monospace tooltip that names the daemon field verbatim. Tooltip
rendering reuses shadcn `tooltip` primitive (installed per §Registry).

| Section | Label | Control | Tooltip (wire name + short description) |
|---------|-------|---------|-----------------------------------------|
| Identity | `Device name` | text input | `node.name · the human-readable name for this device on the mesh` |
| Identity | `Node ID` (read-only, full 64-char) | mono code block + `[ Copy ]` | `node_id · the cryptographic identity assigned by pim on first run` |
| Identity | `Short ID` (read-only, 8-char) | mono code block | `short_id · an 8-character fingerprint for quick visual match` |
| Identity | `Public key` (read-only) | mono code block + `[ Copy ]` | `public_key · the peer's Noise static public key — share this, not the node_id` |
| Transport | `Interface name` | text input | `transport.interface · e.g. pim0 on linux, utun4 on macos` |
| Transport | `MTU` | number input, min 576 max 9216, step 1 | `transport.mtu · maximum packet size on the mesh interface` |
| Transport | `Mesh address mode` | radio group `static / auto` | `transport.mesh_ip.mode · whether your address on the mesh is assigned (auto) or manually set (static)` |
| Transport | `Your address on the mesh` (shown only when mode=`static`) | text input | `transport.mesh_ip.value · the static IPv4/IPv6 for this node on the pim network` |
| Transport | `Listen port` | number input, min 1 max 65535 | `transport.listen_port · the UDP port pim listens on for peer connections` |
| Discovery | `Broadcast discovery` | switch | `discovery.broadcast · announce this node on the local link (UDP broadcast)` |
| Discovery | `Bluetooth discovery` | switch | `discovery.bluetooth · discover peers over bluetooth (platform-dependent)` |
| Discovery | `Wi-Fi Direct discovery` | switch | `discovery.wifi_direct · discover peers over wi-fi direct (platform-dependent)` |
| Discovery | `Auto-connect to discovered peers` | switch | `discovery.auto_connect · accept nearby peers automatically without approval` |
| Trust | `Authorization policy` | radio group `allow_all / allow_list / TOFU` | `security.authorization · how this node decides whom to trust on first contact` |
| Trust | `Trusted peers` (read-only table in Phase 3; editable list deferred per D-19) | mono list of `{short_id}  {label ?? "—"}` rows | `trust_store · peers this node has accepted; managed from the Peers tab` |
| Routing | `Maximum hops` | number input | `routing.max_hops · how far a packet may travel across peer hops before being dropped` |
| Gateway | *(single-line Linux-only message; no controls in Phase 3)* | — | — |
| Notifications | `All gateways lost` | switch | `notifications.all_gateways_lost · raise an alert when every known gateway becomes unreachable` |
| Notifications | `Kill-switch active` | switch | `notifications.kill_switch · raise an alert when route-internet-via-mesh blocks internet due to gateway loss` |
| Advanced — raw config | *(no labels; the textarea IS the control)* | textarea (monospace, gutter) | — |
| About | `UI version` / `Daemon version` / `Config file` / `Build` | read-only `key: value` rows; `[ Copy path ]` on Config file row; `[ Open crash log ]` action | — |

**Radio option labels (human-readable — `03-CONTEXT.md` `<specifics>` verbatim):**
- `allow_all` → `Allow all (trust-on-first-use disabled)`
- `allow_list` → `Allow list (only peers in trusted-peers)`
- `TOFU` → `Trust on first use (default for mesh discovery)`
- mesh_ip `static` → `Static — I set the address`
- mesh_ip `auto` → `Automatic — pim picks an address`
- Add-peer mechanism `tcp` → `tcp (internet / LAN)`
- Add-peer mechanism `bluetooth` → `bluetooth (nearby pairing)`
- Add-peer mechanism `wifi_direct` → `wi-fi direct (nearby pairing)`

### Raw-TOML section — locked copy (D-14, D-15)

| Element | Copy |
|---------|------|
| Raw-wins banner (on any form section whose TOML AST has keys the form can't represent) — verbatim per `ROADMAP §4` + `CONF-07` | `Raw is source of truth — form view shows a subset` |
| Raw-wins banner secondary action | `[ Open Advanced ]` |
| Raw-TOML section body heading (above the textarea) | `source: {config.get.source_path}` · `last modified {ISO}` — both right-aligned in `text-muted-foreground` |
| Raw-TOML gutter error row | `col {column}: {daemon message}` — single line, non-collapsing, `text-destructive` |
| Raw-TOML cannot-parse banner (Claude's discretion fallback) | `Couldn't parse TOML returned by daemon. [Show raw →]` |
| Raw-TOML save button | `[ Save ]` (same label as form sections — saves the verbatim textarea buffer via `dry_run` first, then the real write, per D-12) |

### Peer add / remove — locked copy (`03-CONTEXT.md` `<specifics>`, D-17, D-18, D-19)

| Element | Copy |
|---------|------|
| Peers-tab action row button | `[ + Add static peer ]` |
| Peers Sheet title (verbatim per `<specifics>`) | `Add a static peer` |
| Peers Sheet field — address label (verbatim per `<specifics>`) | `Peer address` |
| Peers Sheet field — mechanism label (verbatim per `<specifics>`) | `How to reach it` |
| Peers Sheet field — label label (verbatim per `<specifics>`) | `Nickname (optional)` |
| Peers Sheet field — address placeholder, mechanism=tcp | `192.168.1.5:9000` |
| Peers Sheet field — address placeholder, mechanism=bluetooth | `AA:BB:CC:DD:EE:FF` |
| Peers Sheet field — address placeholder, mechanism=wifi_direct | `AA:BB:CC:DD:EE:FF` |
| Peers Sheet field — nickname placeholder | `gateway-kitchen` (a short nickname the user would recognize) |
| Sheet inline error — `-32011` already exists (D-18 verbatim) | `That peer is already configured.` |
| Sheet inline error — `-32012` address format (D-18 verbatim) | `Address format not recognized by the daemon.` |
| Sheet inline error — `-32602` params | toast via sonner + append to troubleshoot buffer (no inline row) |
| Remove-peer AlertDialog title (verbatim per `<specifics>` + D-19) | `Remove {label ?? short_id}?` |
| Remove-peer AlertDialog body (verbatim per D-19) | `This peer will be removed from pim.toml and disconnected. Nearby discovery can re-pair it later.` |
| Remove-peer race error | toast `Peer was already removed.` (D-19) |

### Logs tab completion copy (D-21, D-22, D-23)

| Element | Copy |
|---------|------|
| Text-search input placeholder | `search messages, sources, peers…` |
| Time-range select label prefix | `time:` (matching `level:` and `peer:` prefix convention from Phase 2 filter bar) |
| Time-range preset options | `Last 5 min`, `Last 15 min`, `Last 1 hour`, `All session`, `Custom…` |
| Custom time-range Dialog title | `Filter by time range` |
| Custom time-range from/to field labels | `From` / `To` |
| Debug-snapshot toast on-success body | `Snapshot saved as {filename}` — auto-dismiss 4s |
| Debug-snapshot toast on-failure body | `Couldn't generate snapshot. [Show in Logs →]` — routes to Logs tab with `source: "config"` per D-32 |

### Unsaved changes — locked copy (D-13)

| Element | Copy |
|---------|------|
| AlertDialog title | `Discard unsaved changes in {section name}?` |
| AlertDialog body | `{N} field{N≠1?s:} in {section name} haven't been saved. If you leave, your edits disappear.` |
| AlertDialog primary action | `[ Discard ]` (destructive variant) |
| AlertDialog secondary action | `[ Stay ]` |

### Restart-required copy (D-25)

| Element | Copy |
|---------|------|
| Save-success toast when `requires_restart` is empty | `Saved.` — auto-dismiss 3s |
| Save-success toast when `requires_restart` is non-empty | `Saved. Restart pim to apply: {requires_restart.join(", ")}` — auto-dismiss 8s; includes `[ Restart ]` action |
| Restart confirmation in-toast (not a separate dialog — Claude's discretion says no extra confirm) | — |
| Pending-restart summary token (collapsed section, D-25 step 4) | `⚠ pending restart: {fields.join(", ")}` in `text-accent` |

### Daemon-stopped / limited-mode copy (D-32, `03-CONTEXT.md` `<specifics>`)

When `LimitedModeBanner` is active (Phase 1 surface, renders above content pane):

| Element | Copy |
|---------|------|
| Per-section inline hint above Save (disabled state) | `Daemon stopped — reconnect to save.` (`<specifics>` verbatim) |
| Form control state | inputs rendered `opacity-60 pointer-events-none`; values read from the last-known `config.get` cached snapshot |
| Save button state | disabled (`pointer-events-none opacity-40`), label remains `[ Save ]` |
| Peers Sheet when limited | `[ Add peer ]` disabled + inline hint under the Sheet footer: `Reconnect to add peers.` |
| Remove-peer AlertDialog when limited | primary action disabled + hint under body: `Reconnect to remove peers.` |

### Daemon-reject surface (D-11 step 4, D-32)

| Element | Copy |
|---------|------|
| Toast on dry-run reject | `Daemon rejected settings: {first error.message} [Show in Logs →]` — border `border-destructive`, left-edge 4px stripe `bg-destructive`, auto-dismiss 8s, routes to Logs tab filtered `source: "config"` on click |
| Per-field inline error (mapped via `errors[].path` → form field) | `{daemon message}` in `text-destructive`, rendered beneath the erroring input |
| Section-level fallback banner (when `errors[].path` cannot be mapped to any field) | `Daemon rejected this section: {error.message}` rendered at the top of the section body in `text-destructive` |

### About section content (D-27)

| Element | Copy |
|---------|------|
| UI version row | `pim-ui {import.meta.env.VITE_APP_VERSION}` |
| Daemon version row | `pim-daemon {helloResult.daemon_version}` — from cached `rpc.hello` response |
| Kernel repo link | `github.com/Astervia/proximity-internet-mesh ↗` — opens via Tauri `shell.open`, never `window.open` |
| Config file row | `source: {source_path}` + `[ Copy path ]` right-aligned |
| Build hash | `build: {VITE_APP_COMMIT.slice(0,7)}` — rendered only when defined; otherwise this row is omitted (silent, not a "not available" string) |
| Crash log action | `[ Open crash log ]` — navigates to Logs tab with preset filter `level: error`, `time_range: All session` |

### Empty states (`UX-PLAN §1 P5` — solo mode first-class; never infantilize)

| Surface | Empty-state copy |
|---------|------------------|
| Peers tab — no static peers configured | `no static peers · discovered peers appear above` (one line, `text-muted-foreground`, below the action row) — mirrors Phase 2's `no peers connected · discovery is active` grammar |
| Peers tab — no connected peers and no nearby | falls through to Phase 2's connected-peers empty state (`no peers connected · discovery is active`) and Phase 2's Nearby empty state (`no devices discovered yet · discovery is active`) — Phase 3 does not alter either |
| Settings — Trust section, no trusted peers | `no trusted peers yet · trust policy is {policy}` in `text-muted-foreground`, inside the read-only list area |
| Logs — filter produces zero rows | **existing Phase 2 virtualization renders an empty list; Phase 3 adds** a single centered `label`-typography line inside the list container: `no log rows match these filters` (`text-muted-foreground`). No illustration, no "try clearing filters" hand-holding. |

### Destructive actions summary

| Action | Confirmation approach |
|--------|-----------------------|
| Remove static peer | `AlertDialog` with destructive variant primary `[ Remove ]` + secondary `[ Cancel ]`; body per D-19; `Esc` = Cancel |
| Discard unsaved section changes | `AlertDialog` with destructive variant primary `[ Discard ]` + secondary `[ Stay ]`; triggered by nav-away or daemon-stop path (D-13); `Esc` = Stay |
| Restart daemon via toast `[ Restart ]` action | **No separate confirm** — user already committed by clicking Restart (Claude's discretion says no extra confirm, per `03-CONTEXT.md` `<decisions>` discretion block). Toast shows `[ Restarting… ]` transient while `daemon.stop()` → `daemon.start()` runs. |
| Raw-TOML save | implicit confirmation via `dry_run` gate; no dialog — if daemon rejects, the textarea buffer is preserved and errors render inline (D-12) |

---

## Registry Safety

All primitives are either (a) already installed in `src/components/ui/` from Phase 1
or (b) come from the **official shadcn new-york registry**. **No third-party registries.**
The registry-vetting gate is not engaged.

| Registry | Blocks used | Installation status | Safety Gate |
|----------|-------------|---------------------|-------------|
| shadcn official (new-york) — already installed | `badge`, `button`, `card`, `dialog`, `input` | present from Phase 1 | not required |
| shadcn official (new-york) — installed during Phase 2 execution (already landed in this phase's codebase) | `sheet`, `select`, `scroll-area`, `sonner` (toast) | reused by Phase 3 Peers Sheet, Logs filter bar, Logs virtualized list, toast surface | not required |
| **shadcn official (new-york) — new for Phase 3** | `switch` (discovery + notifications toggles — D-09), `radio-group` (trust policy + mesh_ip mode + Add-peer mechanism — D-09), `collapsible` (collapsible section chrome — D-04), `alert-dialog` (remove-peer + discard-unsaved-changes — D-13 + D-19), `form` (react-hook-form integration — D-07), `tooltip` (wire-name `ⓘ` on labels — microcopy contract) | install via `npx shadcn@latest add {block}` during Phase 3 execution | not required — official registry |
| Third-party registries | — | — | **N/A — none declared; safety vetting gate not engaged** |

**New npm dependencies declared in Phase 3 (not shadcn registry but first-party npm):**

| Package | Version | Reason | Safety note |
|---------|---------|--------|-------------|
| `react-hook-form` | `^7` | Per-section dirty tracking, form state orchestration (D-07) | Maintained, >4M weekly downloads, 0 runtime deps beyond React |
| `@iarna/toml` | `^2.2.5` | TOML parse + stringify for raw↔form sync and `requires_restart` detection (D-31) | Pure JS, 0 deps, ~30 KB; already pinned in `03-CONTEXT.md` |

**Primitives explicitly NOT pulled:**
- `codemirror`, `monaco-editor`, `prism` — raw TOML editor is a **plain `<textarea>`** per D-14 (bundle-size + brand-aesthetic rejection)
- `command` — command palette is Phase 5 (UX-07)
- `dropdown-menu` — existing `select` primitive covers every menu surface in Phase 3
- `popover` — tooltips from shadcn `tooltip` are sufficient; no popover-hosted menus in Phase 3
- `checkbox` — the only binary toggles are `switch` (discovery, notifications); no checkbox fields in Phase 3
- `slider` — no continuous-range knobs (MTU and listen port are number inputs, not sliders)
- `date-picker` — Custom time-range Dialog uses two plain time-of-day inputs (`<input type="time">`) per D-22; a full date-picker is over-scoped for a session-bounded log buffer
- `separator` — box-drawing `├──` inside CliPanel is the brand separator; new dividers reuse `border-t border-border` classes

**Brand overrides required on the new primitives (Phase 3 execution responsibility):**

- `switch`
  - override: `rounded-none` root + `rounded-none` thumb
  - `data-[state=checked]`: `bg-primary`; `data-[state=unchecked]`: `bg-muted`
  - thumb: `bg-popover` (off) / `bg-primary-foreground` (on); `border border-border`
  - focus-visible: `outline-2 outline-ring outline-offset-2` (upgrade parity with Phase 2 large targets)
  - size: `h-5 w-9` thumb `h-4 w-4` — tight, terminal-proportional; NO motion beyond `transition-transform duration-100 ease-linear`
  - accompanying label: `font-mono text-sm` to the right of the switch, clickable to toggle

- `radio-group`
  - override: each radio indicator is `rounded-none` + `border border-border`; checked state adds inner `bg-primary` `h-2 w-2` square (NOT a dot); root has `gap-2` between items
  - label text `font-mono text-sm` lowercase — EXCEPT the three Trust-policy labels which include their technical name (rendered verbatim) per `<specifics>`
  - focus-visible: `outline-2 outline-ring outline-offset-2`
  - keyboard: arrow keys navigate within group (Radix default), `Space` selects

- `collapsible`
  - override: no visible root styling — it only structures `header + body`; the `CliPanel` primitive is the visual chrome
  - `data-[state=open]` / `data-[state=closed]` drive chevron rotation (swap `▸` ↔ `▾` in JSX based on `open`; no CSS transform — box-drawing glyphs are swapped, not rotated)
  - expand/collapse motion: **`animate-in/slide-in-from-top-1 duration-150 ease-out` on open; `animate-out/slide-out-to-top-1 duration-120 ease-out` on close** — Claude's-discretion choice within the 150–250 ms range the context allows. Heights are Radix defaults (measured via `ResizeObserver`); `prefers-reduced-motion: reduce` disables animation and snaps to final state
  - keyboard: `Tab` to header, `Enter`/`Space` to toggle (D-06)

- `alert-dialog`
  - override: `rounded-none`, `bg-popover`, `border border-border`, `p-6` inner padding
  - overlay `bg-background/80` matching `dialog.tsx` L32
  - title uses `heading-lg` role; description `body`; footer buttons use `font-mono text-xs uppercase tracking-widest` (label role — matches `dialog.tsx` button convention)
  - primary-destructive variant (Remove peer + Discard changes) uses `bg-destructive text-destructive-foreground hover:bg-background hover:text-destructive border border-destructive` — video-invert on hover, same grammar as Phase 1's stop-daemon button
  - focus: Radix traps; first focus lands on secondary (safe) action for destructive prompts — this is a deliberate inversion of Phase 2's dialog convention because the destructive path needs a deliberate step to reach (matches `stop-confirm-dialog.tsx` first-focus-on-[KEEP RUNNING])

- `form`
  - override: the shadcn `Form` wrapper + `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`/`FormDescription` components. All text inside them uses `font-mono`; `FormLabel` uses `label` role typography; `FormDescription` uses `body` in `text-muted-foreground`; `FormMessage` (error surface) uses `body` in `text-destructive`
  - spacing: `FormItem` stacks with `gap-2`; consecutive `FormItem`s have `gap-4` between them (form-row grammar matches the `md` spacing token)

- `tooltip`
  - override: content panel `bg-popover border border-border rounded-none p-2`; text `font-mono text-xs`; arrow omitted (the box-drawing aesthetic doesn't host speech-bubble arrows); delay duration `200ms` (Radix default) which is within `pim.yml` motion bounds

- `sheet` (re-using Phase 2's override, applied to Peers Sheet)
  - override confirmed: `rounded-none`, no shadow, `bg-popover` (not `bg-background`), right-edge `border-l border-border`, SheetTitle uses `heading` role (matches the Peers Sheet title `Add a static peer` typography contract above)

---

## Screen-level specs

### S1 · Settings screen (new, `⌘6` tab)

```
╔══════════════════════════════════════════════════════════════════╗
║ ┌─── IDENTITY ──────────────────────────────┐ client-a-macbook · 9a2cbd1e    [▸] ║
║ └───────────────────────────────────────────┘                                     ║
║                                                                                    ║
║ ┌─── TRANSPORT ─────────────────────────────┐ interface pim0 · mtu 1400 · mesh_ip auto · port 9000 · ⚠ pending restart: transport.listen_port  [▾] ║
║ │                                                                                 │ ║
║ │   Interface name                                                                │ ║
║ │   ▸ [ pim0_____________________ ]  ⓘ                                            │ ║
║ │                                                                                 │ ║
║ │   MTU                                                                           │ ║
║ │   ▸ [ 1400____ ]  ⓘ                                                             │ ║
║ │                                                                                 │ ║
║ │   Mesh address mode                                                             │ ║
║ │   ( ) Static — I set the address                                                │ ║
║ │   (•) Automatic — pim picks an address                                          │ ║
║ │                                                                                 │ ║
║ │   Listen port                                                                   │ ║
║ │   ▸ [ 9000____ ]  ⓘ                                                             │ ║
║ │                                                                                 │ ║
║ │                                                      • [ Save ]                 │ ║
║ └─────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                    ║
║ ┌─── DISCOVERY ─────────────────────────────┐ broadcast on · BLE off · wifi_direct off · 3 trusted peers [▸] ║
║ └───────────────────────────────────────────┘                                     ║
║                                                                                    ║
║ ┌─── TRUST ─────────────────────────────────┐ policy: TOFU [▸]                    ║
║ └───────────────────────────────────────────┘                                     ║
║                                                                                    ║
║ ┌─── ROUTING ───────────────────────────────┐ max_hops 8 [▸]                      ║
║ └───────────────────────────────────────────┘                                     ║
║                                                                                    ║
║ ┌─── GATEWAY ───────────────────────────────┐ linux-only · disabled [▸]           ║
║ └───────────────────────────────────────────┘                                     ║
║                                                                                    ║
║ ┌─── NOTIFICATIONS ─────────────────────────┐ all-gateways-lost on · kill-switch on [▸] ║
║ └───────────────────────────────────────────┘                                     ║
║                                                                                    ║
║ ┌─── ADVANCED — RAW CONFIG ─────────────────┐ 148 lines · last saved 3m ago [▸]   ║
║ └───────────────────────────────────────────┘                                     ║
║                                                                                    ║
║ ┌─── ABOUT ─────────────────────────────────┐ pim-ui 0.3.0 · daemon 0.6.1 · a3f2e1c [▸] ║
║ └───────────────────────────────────────────┘                                     ║
╚══════════════════════════════════════════════════════════════════╝
```

- Container: `<main aria-label="settings" class="flex-1 overflow-y-auto px-8 py-8">`
- Inner column: `max-w-3xl mx-0 flex flex-col gap-6` (single scrollable column, left-aligned)
- Section order: **fixed** — reordering is a contract violation (checker-enforced)
- Each section is a `<CollapsibleCliPanel>` — the new primitive (see S1a)
- Visible-collapsed summary is the authoritative-at-a-glance line (`UX-PLAN §1 P1`)
- Dirty dot `·` in `--color-primary` renders immediately left of the `[ Save ]` button footer (not in the header — the header summary should stay stable so the user can confirm value changes without the title jittering)
- Keyboard: `⌘6` focuses first section header; `Tab` cycles between section headers; `Enter` / `Space` toggles; `⌘↑` collapses all; `⌘↓` expands all (D-06)

#### S1a · `CollapsibleCliPanel` anatomy (new primitive)

```
┌─── IDENTITY ───────────────────────┐ client-a-macbook · 9a2cbd1e [▸]   ← collapsed header
└────────────────────────────────────┘
                                       ↓ expand
┌─── IDENTITY ───────────────────────┐ [▾]
│                                    │
│  Device name                       │
│  ▸ [ client-a-macbook ]  ⓘ         │
│                                    │
│  Node ID                           │
│  9a2cbd1e1f3f…a3c2bd1e  [ Copy ]   │
│                                    │
│  Short ID                          │
│  9a2cbd1e                          │
│                                    │
│  Public key                        │
│  base64:…  [ Copy ]                │
│                                    │
│                         [ Save ]   │
└────────────────────────────────────┘
```

- Header: `<button>` element wrapping the title + summary + chevron; reuses `CliPanel`'s existing header shape (`px-4 py-2 border-b border-border font-mono text-xs uppercase tracking-widest`). Chevron is a box-drawing glyph on the right (`▸` collapsed, `▾` expanded) in `text-muted-foreground`; on hover, glyph gains `text-primary`.
- Header focus-visible: `outline-2 outline-ring outline-offset-[-2px]` inset (parity with Phase 2 large targets)
- Header active state (current section being edited): no distinct visual — the dirty dot + expanded chevron are the affordance
- Body: `<div class="px-5 py-4">` matches `cli-panel.tsx` L41 verbatim
- Body top-border: when expanded, a single `border-t border-border` separates header from body (provided by `CliPanel`'s own `border-b` on the header)
- Body entry/exit animation: `animate-in/slide-in-from-top-1 duration-150 ease-out` on open; symmetric on close; `prefers-reduced-motion` snaps
- Save-row: `<footer class="mt-6 flex items-center justify-end gap-4">` with the inline dirty-dot + `[ Save ]` button; inline field errors render ABOVE the save row, attached to their respective fields (via `FormMessage`)

### S1b · Raw-TOML editor surface (ADVANCED — RAW CONFIG section body)

```
┌─── ADVANCED — RAW CONFIG ──────────┐ 148 lines · last saved 3m ago [▾]
│  source: /etc/pim/pim.toml        last modified 2026-04-24T19:31:12Z │
│                                                                       │
│ ┌───┬─────────────────────────────────────────────────────────────┐   │
│ │  1│ # pim daemon configuration                                  │   │
│ │  2│                                                             │   │
│ │  3│ [node]                                                      │   │
│ │  4│ name = "client-a-macbook"                                   │   │
│ │  5│                                                             │   │
│ │  6│ [transport]                                                 │   │
│ │  7│ interface = "pim0"                                          │   │
│ │  8│ mtu = 1400                                                  │   │
│ │⚠ 9│ listen_port = "9000"   ← daemon rejects: must be integer    │   │
│ │   │   col 16: invalid type: expected integer, found string      │   │
│ │ 10│                                                             │   │
│ │ 11│ [discovery]                                                 │   │
│ │ 12│ broadcast = true                                            │   │
│ │ 13│ bluetooth = false                                           │   │
│ │ ...                                                             │   │
│ └───┴─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│                                                        [ Save ]       │
└───────────────────────────────────────────────────────────────────────┘
```

- Outer container: `<div class="px-5 py-4">` — standard CliPanel body
- Meta row: `<div class="flex items-center justify-between text-xs text-muted-foreground mb-3 font-mono">` — source path on left, ISO timestamp on right
- Editor frame: `<div class="border border-border bg-popover flex">` — two-column grid: gutter + textarea
- Line-number gutter: fixed-width `w-12` (48px, see Spacing), `bg-muted/30` (slightly distinct from the textarea's `bg-popover`), right-edge `border-r border-border`, text `font-code text-xs text-muted-foreground`, each line-number row is `leading-[22px]` aligning to textarea row
- Gutter erroring-row rendering: replace the plain line-number with `⚠ {n}` — glyph in `text-accent`, number in `text-accent`, total width still 48px (the `⚠` + 3-digit line number fits; 4-digit limits are file-realistic at v1 line counts)
- Textarea: `font-code text-sm leading-[22px] bg-popover text-foreground p-3 resize-none w-full min-h-[400px]` — plain `<textarea>`, NOT `contenteditable`, NOT a rich editor (D-14)
- Textarea spellcheck: `spellcheck="false"` (TOML is not natural language)
- Textarea wrap: `wrap="off"` (horizontal scroll within the frame — TOML keys can be long)
- Inline error row (below erroring textarea line — visually overlaid in the line-grid): `font-code text-xs text-destructive leading-[22px] pl-12` (indented past the gutter to align with textarea column 1)
- Click a gutter `⚠` marker → sets textarea `selectionStart = selectionEnd = offsetOf(line, column)` and focuses the textarea (keeps the daemon's `col` mapping honest — click = cursor-to-error, D-14)
- Save button footer: same grammar as form sections (`[ Save ]` + dirty dot; dirty tracked by `value !== lastSavedValue`)
- Unparseable-TOML fallback: render a banner above the editor frame: `Couldn't parse TOML returned by daemon. [Show raw →]` — the button scrolls to the textarea

### S2 · Peers tab (dedicated screen, extends Phase 2's Dashboard peer list)

```
╔══════════════════════════════════════════════════════════════════╗
║ ┌─── PEERS ────────────────────────────────┐ [3 CONNECTED]       ║
║ │ [ + Add static peer ]                                          │ ║
║ │                                                                │ ║
║ │ gateway-c  —       10.77.0.1   via tcp   ◆ active  12ms 0s    │ ║
║ │ relay-b    —       10.77.0.22  via tcp   ◆ active  18ms 1s [Remove]│ ║
║ │ client-c   —       10.77.0.105 via relay ◈ relayed 47ms 3s    │ ║
║ └────────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║ ┌─── NEARBY — NOT PAIRED ──────────────────┐ [2 NEARBY]          ║
║ │ anonymous   (no id)    via bluetooth   first seen 4s ago       │ ║
║ │ desk-lamp   9a2c…bd1e  via wifi_direct first seen 14s ago [Pair]│ ║
║ └────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════╝
```

- The `CliPanel` container and row template are identical to Phase 2's Dashboard peer list — Phase 3 adds the action row and the per-row `[ Remove ]` affordance on static peers only
- Action row `[ + Add static peer ]`: `Button variant="default"` (primary green), `size="default"`; renders ABOVE the peer list inside the CliPanel body (not outside), separated by `border-b border-border pb-3 mb-3`
- Per-row `[ Remove ]`: visible only on rows with `static: true` (rows paired via discovery do not get this affordance in Phase 3 per D-20); right-aligned, `Button variant="ghost" size="sm"` with `border border-border` so it reads as an inline button, not an ornament
- `[ Remove ]` hover: `border-destructive text-destructive bg-transparent` — NOT a full destructive fill (would overwhelm the row); confirmation dialog is the actual commit moment
- Clicking the row (outside the `[ Remove ]` button) still opens the Peer Detail slide-over from Phase 2 — `e.stopPropagation()` on the Remove button
- Nearby section: unchanged from Phase 2 verbatim

### S3 · Peers Sheet (Add a static peer — right-edge `Sheet`)

```
                                    │── Add a static peer ──×─│
                                    │                          │
                                    │ Peer address             │
                                    │ ▸ [ 192.168.1.5:9000  ] ⓘ│
                                    │                          │
                                    │ How to reach it          │
                                    │ (•) tcp (internet / LAN) │
                                    │ ( ) bluetooth (nearby…)  │
                                    │ ( ) wi-fi direct (nearby)│
                                    │                          │
                                    │ Nickname (optional)      │
                                    │ ▸ [ gateway-kitchen    ] │
                                    │                          │
                                    │ ─────────────────────────│
                                    │                          │
                                    │ [ Cancel ]  [ Add peer ] │
                                    └──────────────────────────┘
                                      480 px, right-edge
```

- Sheet container: `bg-popover border-l border-border w-[480px]` (matches Phase 2 slide-over width)
- Overlay: `bg-background/80` (matches `dialog.tsx` L32 convention; no blur)
- Inner padding: `p-6 gap-6` (the `lg+` spacing token)
- Title: `SheetTitle` uses `heading` role (14px, 600, uppercase, tracking-wider)
- Close `×`: top-right, `aria-label="close add peer sheet"`, outline-2 focus-visible
- Form: single column, `gap-4` between `FormItem`s, `gap-2` within each item (label + control + message)
- Address field: `<Input>` (existing), placeholder changes reactively when mechanism radio changes (no re-layout — placeholder text only)
- Mechanism field: `<RadioGroup>` with three radio buttons stacked `gap-2`; default `tcp` (D-17)
- Label field: `<Input>` with `maxLength={64}` and `spellcheck="false"` (mono display)
- Footer: `<SheetFooter>` rendered as a flex row `justify-end gap-4`, with a `border-t border-border pt-4` divider above
- Primary `[ Add peer ]`: `Button variant="default"`, disabled when address is empty OR when a request is in flight; disabled-style = `pointer-events-none opacity-40`
- Secondary `[ Cancel ]`: `Button variant="ghost"`, closes the Sheet without calling any RPC
- On submit: `peers.add_static({ address, mechanism, label })`; see Interaction States for all error paths
- Entry/exit: Radix Sheet's default `duration-100 linear` translate-from-right; `prefers-reduced-motion` snaps

### S4 · Remove Peer AlertDialog

```
┌──────────────────────────────────────────────┐
│                                              │
│ REMOVE RELAY-B?                              │
│                                              │
│ This peer will be removed from pim.toml and  │
│ disconnected. Nearby discovery can re-pair   │
│ it later.                                    │
│                                              │
│ ──────────────────────────────────────       │
│                                              │
│ [ Cancel ]                        [ Remove ] │
└──────────────────────────────────────────────┘
```

- Reuses `alert-dialog` primitive installed in Phase 3; overlay `bg-background/80`, content `bg-popover border border-border p-6 max-w-md`
- Title: `heading-lg` role; body: `body` role in `text-foreground` (not muted — this is the primary contract statement)
- Primary `[ Remove ]`: destructive variant — video-invert on hover; `aria-describedby` bound to the body
- Secondary `[ Cancel ]`: ghost variant
- First focus: **Cancel** (safe side) — matches `stop-confirm-dialog.tsx` pattern (first-focus-on-[KEEP RUNNING])
- `Esc` closes via Cancel path (no RPC call)
- On confirm: `peers.remove({ config_entry_id })`; on success, close + let Phase 2's `peers.event { kind: "disconnected" }` reflow the list; on `-32010`, close + sonner toast `Peer was already removed.`

### S5 · Discard Unsaved Changes AlertDialog

```
┌──────────────────────────────────────────────┐
│                                              │
│ DISCARD UNSAVED CHANGES IN TRANSPORT?        │
│                                              │
│ 2 fields in Transport haven't been saved.    │
│ If you leave, your edits disappear.          │
│                                              │
│ ──────────────────────────────────────       │
│                                              │
│ [ Stay ]                        [ Discard ]  │
└──────────────────────────────────────────────┘
```

- Same primitive + overlay + typography as S4
- Triggered by: sidebar nav to a different tab, clicking `[ + Add static peer ]` on Peers tab while a Settings section is dirty (rare but possible), daemon stop path (D-13 gates Phase 1's `StopConfirmDialog`)
- Primary `[ Discard ]`: destructive variant (the action itself destroys user edits)
- First focus: **Stay** (safe side)
- On discard: `reset()` the react-hook-form instance for the section, then perform the pending nav
- On stay: cancel the nav; section stays expanded

### S6 · Logs tab filter bar (extended — adds text search + time range + export)

```
┌─── LOGS ────────────────────────────────────────────────────┐ [STREAMING]
│ level: [ trace ] [ debug ] [ info* ] [ warn ] [ error ]     │
│ search: ▸ [ search messages, sources, peers…        ]       │
│ peer:  ( all ▾ )    time: ( Last 15 min ▾ )   [ Export debug snapshot ] │
├─────────────────────────────────────────────────────────────┤
│ 21:14:07  info   transport  relay-b    connecting to…       │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

- Filter bar now occupies **three** rows to accommodate the new controls without squeezing into a single 80-char wide row (the existing Phase 2 row is preserved; Phase 3 adds one row above it for search, and one row below it combining peer + time + export):
  - Row 1 (existing Phase 2): `level:` prefix + 5 segmented buttons
  - Row 2 (**new**): `search:` prefix + text input (`w-full max-w-xl`) with placeholder `search messages, sources, peers…`; debounced 300 ms (D-21)
  - Row 3 (existing peer + **new** time + **new** export): `peer:` select + `time:` select + right-aligned `[ Export debug snapshot ]`
- The filter bar as a whole keeps `border-b border-border pb-3 mb-3` below Row 3
- Search input: `<Input>` primitive with `font-code text-sm` (code font for text that will contain grep-style patterns)
- Time-range `<Select>`: uses existing shadcn primitive; options are the exact preset list in the copy contract above; `Custom…` opens the Dialog below
- Export button: right-aligned in Row 3, `Button variant="default"`; on click, synchronously builds the JSON blob and triggers the download (D-23). Label flips to `[ Preparing… ]` for < 100 ms while the blob is assembled (barely perceptible; included for the honesty of the label)
- Empty-results state: the virtualized list renders a single centered `no log rows match these filters` line (`text-muted-foreground label` role) when all filters combined produce zero rows

### S7 · Custom Time-Range Dialog (opens from `Custom…` option)

```
┌──────────────────────────────────────────────┐
│                                              │
│ FILTER BY TIME RANGE                         │
│                                              │
│ From                                         │
│ ▸ [ 20:14  ]                                 │
│                                              │
│ To                                           │
│ ▸ [ 21:47  ]                                 │
│                                              │
│ ──────────────────────────────────────       │
│                                              │
│ [ Cancel ]                        [ Apply ]  │
└──────────────────────────────────────────────┘
```

- Reuses `dialog.tsx` (Radix Dialog, not AlertDialog — this is a non-destructive filter choice)
- `<input type="time">` for From + To; defaults populated from oldest / newest entries in the in-memory ring buffer (D-22)
- Primary `[ Apply ]` commits; Secondary `[ Cancel ]` reverts the time-range select to its previous value
- On apply: the outer Logs filter bar's time-range select displays `Custom (20:14 – 21:47)` in its trigger

### S8 · Debug snapshot toast (sonner)

- Uses the existing `<Toaster>` mounted in `main.tsx` (bottom-right, 16px offset, 3s default duration)
- Success body: `Snapshot saved as pim-debug-snapshot-2026-04-24T19-31-12Z.json` — left-edge 4px `bg-primary` stripe, border `border-border`, auto-dismiss 4s
- Failure body: `Couldn't generate snapshot. [Show in Logs →]` — left-edge 4px `bg-destructive` stripe, auto-dismiss 8s, routes to Logs tab with `source: "config"` preset filter on click

---

## Interaction states

Every state below has an explicit visual rule. `--color-ring` (`#22c55e`) has measured
contrast of 9.4:1 against `--color-background` (`#0a0c0a`) — WCAG AAA.

### CollapsibleCliPanel header (new primitive — D-04, D-05, D-06)

| State | Visual |
|-------|--------|
| Default collapsed | `bg-popover text-muted-foreground` header text; box-drawing title `text-muted-foreground`; summary line `text-foreground` (so the value text is readable at a glance); chevron `▸` in `text-muted-foreground` |
| Hover | header `text-primary` on box-drawing + chevron; summary stays foreground; `border-border-active` border on the whole CliPanel |
| Focus-visible | `outline-2 outline-ring outline-offset-[-2px]` inset ring on the header button |
| Active / pressed (click in progress) | `translate-y-[1px]` on the header (instant, matches `pim.yml` effects.active) |
| Expanded | chevron `▾` replaces `▸`, summary line remains visible (does NOT get replaced — consistency of the at-a-glance affordance); body slides in |
| Dirty (any field in this section has unsaved changes) | no header-level change (summary stays stable); dirty signal is the dot before `[ Save ]` inside the expanded body, plus the enabled `[ Save ]` button |
| Pending-restart (D-25 step 4) | summary appends ` · ⚠ pending restart: {fields}` in `text-accent`; header itself does not change color (keeping focus state legible) |

### Per-section `[ Save ]` button

| State | Visual |
|-------|--------|
| Idle (no dirty fields) | disabled; `pointer-events-none opacity-40`; label `[ Save ]` |
| Dirty (one or more fields changed) | enabled; primary variant; label `[ Save ]`; dirty-dot `·` in `--color-primary` renders 8px to its left |
| In-flight (dry-run + real save running) | disabled; label `[ Saving… ]`; `aria-busy="true"`; cursor `wait` on the button; the dot stays visible |
| Success (< 2s after successful save) | disabled; label `[ Saved ]`; dot hidden; after 2s label reverts to idle `[ Save ]` + disabled |
| Dry-run reject | returns to dirty state; toast fires per Daemon-reject copy; inline field errors attached to each errorred field; button label back to `[ Save ]` (enabled); dot still shown |
| Daemon-stopped (LimitedModeBanner active) | disabled; opacity-40; label `[ Save ]`; the inline hint `Daemon stopped — reconnect to save.` renders as a `FormDescription`-styled row above the button |
| Restart-required (post-success, `requires_restart.length > 0`) | returns to Idle state on THIS button; the section summary gains the `⚠ pending restart` token; the toast carries the `[ Restart ]` action |

### Form input (`Input` from Phase 1, reused)

| State | Visual |
|-------|--------|
| Default | `bg-transparent border border-border text-foreground font-mono text-sm px-3 py-2` (existing primitive) |
| Focus-visible | `border-border-active` + `outline-2 outline-ring outline-offset-[-1px]` — inset because the border is 1px |
| Dirty (value !== serverValue) | no background change (avoid visual noise); the `FormItem` sibling dirty-dot in the save footer is the signal |
| Error (daemon-mapped via `errors[].path`) | `border-destructive`; the `FormMessage` below renders `{daemon message}` in `text-destructive` body role |
| Disabled (daemon stopped) | `bg-muted/30 text-muted-foreground cursor-not-allowed opacity-60`; `title` attribute `Daemon stopped — reconnect to save.` |

### `Switch` (new primitive)

| State | Visual |
|-------|--------|
| Off | root `bg-muted` + thumb left (`translate-x-0`) `bg-popover border border-border` |
| On | root `bg-primary` + thumb right (`translate-x-4`) `bg-primary-foreground` |
| Hover | root `border border-border-active` (adds a border to what was a filled bar) |
| Focus-visible | `outline-2 outline-ring outline-offset-2` around root |
| Disabled | `opacity-40 pointer-events-none` |
| Transitioning | thumb slides `duration-100 ease-linear` (reduced-motion snaps) |

### `RadioGroup` (new primitive)

| State | Visual |
|-------|--------|
| Unchecked | indicator `border border-border bg-transparent` `rounded-none` `h-4 w-4` |
| Checked | indicator adds an inner `bg-primary rounded-none h-2 w-2` square (concentric square, NOT a dot — matches box-drawing aesthetic) |
| Hover | indicator border becomes `border-border-active` |
| Focus-visible | `outline-2 outline-ring outline-offset-2` around the indicator |
| Disabled | whole row `opacity-40 pointer-events-none` |

### `[ + Add static peer ]` action row button (Peers tab)

| State | Visual |
|-------|--------|
| Default (daemon running) | primary variant (inherits from `button.tsx` L31 video-invert) |
| Hover | existing `bg-background text-primary border-primary` video-invert |
| Disabled (daemon stopped) | `pointer-events-none opacity-40`; `title` attribute `Reconnect to add peers.` |
| Click-in-flight (Sheet opening) | instant (100 ms); no loading state — the Sheet is a local surface, no RPC fires until submit |

### Peers Sheet `[ Add peer ]` button

| State | Visual |
|-------|--------|
| Default (address field empty) | disabled; `opacity-40 pointer-events-none` |
| Default (address has content) | primary variant enabled |
| In-flight | disabled; label `[ Adding… ]`; `aria-busy="true"` |
| Success | Sheet closes (no explicit success UI — the peer appearing in the list via `peers.event` is the confirmation) |
| Error `-32011` | Sheet stays open; address field gets `border-destructive`; `FormMessage` below address reads `That peer is already configured.`; submit button returns to enabled |
| Error `-32012` | same pattern; message `Address format not recognized by the daemon.` |
| Error `-32602` | Sheet stays open; sonner toast fires `Daemon rejected parameters. [Show in Logs →]`; no inline message (the daemon couldn't map to a field); button returns to enabled |
| Daemon disconnected during submit | button returns to enabled; inline hint under the Sheet footer: `Reconnect to add peers.` |

### Raw-TOML textarea

| State | Visual |
|-------|--------|
| Default | `font-code text-sm leading-[22px] bg-popover text-foreground` |
| Focused (cursor inside) | no border change on textarea; the outer editor frame gets `border-border-active` |
| Scrolled horizontally (long line) | horizontal scrollbar appears inside the editor frame; gutter stays pinned left |
| Error marker clicked (gutter `⚠`) | textarea gets focus; `selectionStart = selectionEnd = offsetOf(line, column)`; smooth-scroll disabled — instant cursor jump |
| Save in-flight | textarea stays fully interactive; only the `[ Save ]` button reflects in-flight |
| Save reject (dry-run) | textarea unchanged; gutter `⚠` markers re-render for each `errors[].line`; inline `col X: message` rows appear under each erroring line; the edit buffer is preserved verbatim (D-12) |

### AlertDialog (Remove peer + Discard unsaved changes)

| State | Visual |
|-------|--------|
| Opening | overlay fade-in 100 ms; content fade + scale-in 100 ms (Radix default) |
| Open idle | centered, `bg-popover`, `border border-border`, `p-6` |
| First focus | **secondary (safe) action** (Cancel / Stay) — inverts the Phase 2 dialog convention for destructive paths |
| `Esc` | triggers Cancel / Stay (secondary) path |
| Primary action click | `Button variant="destructive"` video-invert on hover; on click, dispatches the destructive action and closes the dialog (no in-dialog spinner — for Remove, the list updates via `peers.event`; for Discard, the form resets synchronously) |
| Error path (Remove only) | dialog closes regardless; error surfaces via toast (race case `-32010` toast: `Peer was already removed.`) |

### Collapsible body expand / collapse motion

| Direction | Timing | Easing | Notes |
|-----------|--------|--------|-------|
| Open | `150 ms` | `ease-out` | Radix `Collapsible` measures height via ResizeObserver; Phase-3 Claude's-discretion choice within the CONTEXT-allowed 150–250 ms range (Radix default ≈ 200ms — Phase 3 chose 150ms for snappier "terminal" feel) |
| Close | `120 ms` | `ease-out` | Slightly faster than open; the user's attention has already left the section |
| Reduced motion | `0 ms` | — | Snaps to final state; no `animate-in`/`animate-out` classes |

### Sidebar `settings` row (newly active)

| State | Visual |
|-------|--------|
| Default (user on another tab) | `text-foreground` with hover `text-primary`; `>` prefix animates in (inherited from Phase 2 convention); `⌘6` hint right-aligned |
| Active (current tab = settings) | `text-primary bg-popover`; permanent `▶ ` prefix; `⌘6` hint stays `text-muted-foreground` |
| Focus-visible | `outline-1 outline-ring outline-offset-[-1px]` inset |
| Dirty settings (any section is dirty) | the row gains a `·` dot in `--color-primary` between `settings` and the `⌘6` hint — so the user can tell they have unsaved work even when they're on another tab (mirrors the IDE "unsaved dot" pattern; non-blocking) |

---

## Accessibility notes

### Keyboard navigation

- **Global shortcuts** (bound in `App.tsx`):
  - `⌘1` → Dashboard (Phase 2)
  - `⌘2` → Peers (Phase 3 dedicated screen — no longer aliased to Dashboard)
  - `⌘5` → Logs
  - `⌘6` → Settings (NEW; Phase 2's `⌘,` alias preserved as a secondary bind)
  - `⌘,` → Settings (macOS idiom alias for `⌘6`)
  - `⌘↑` / `⌘↓` → collapse-all / expand-all in Settings (D-06; no-op on other tabs)
  - `Esc` closes in order: Sheet > AlertDialog > Dialog > Peer Detail slide-over (D-13 discard-dialog has priority over the nav it was gating)
- **Within Settings**:
  - `Tab` cycles between section headers (collapsible toggles), then — when a section is expanded — through its form controls in DOM order, then its `[ Save ]` button, then on to the next section header
  - `Enter` / `Space` on a section header toggles expansion (D-06)
  - `Arrow keys` inside a `RadioGroup` move selection (Radix default)
  - `Enter` inside a form input submits the section's `[ Save ]` (standard form convention via `react-hook-form`'s `handleSubmit`)
  - The `ⓘ` tooltip trigger is focusable; `Enter` or hover opens it; focus returns to previous control on `Esc`
- **Within Peers tab**:
  - `Tab` goes first to `[ + Add static peer ]`, then to each peer row (existing Phase 2 pattern), then within a row to `[ Remove ]` if present
  - `Enter` / `Space` on a row opens Peer Detail (Phase 2); on `[ Remove ]` opens AlertDialog
  - Inside the Add Peer Sheet: first focus on the Address input; `Tab` cycles address → mechanism radios (arrow-keys to switch) → label → Cancel → Add peer; `Esc` closes (via Cancel path)
- **Within Logs tab**:
  - `Tab` goes: level buttons (`role="radiogroup"`, arrow-keys within) → search input → peer select → time-range select → export button → log list (focusable for arrow-key row nav)
  - Custom time-range Dialog: first focus on From input; `Tab` cycles to To, Cancel, Apply

### ARIA & semantic roles

- `CollapsibleCliPanel` header: `<button role="button" aria-expanded={open} aria-controls={bodyId}>` per Radix Collapsible; body gets `role="region" aria-labelledby={headerId}`
- Dirty dot rendering: `<span aria-label="unsaved changes" role="img">·</span>` — screen readers announce "unsaved changes" when the dot is present
- Pending-restart token: `<span aria-label="pending restart">⚠ pending restart: {fields}</span>` — SR announces the state independently of the glyph
- Form rows: shadcn `Form` primitive provides `aria-describedby` + `aria-invalid` automatically on inputs; `FormLabel` gets `htmlFor`; `FormMessage` gets `role="alert"` when invalid
- Peers Sheet: Radix Sheet provides `role="dialog" aria-modal="true" aria-labelledby` pointing to "Add a static peer"
- Remove AlertDialog: Radix provides `role="alertdialog" aria-labelledby aria-describedby`
- Discard AlertDialog: same
- Raw-TOML textarea: `<textarea aria-label="raw pim.toml configuration" aria-describedby={errorListId}>`; when errors exist, `errorListId` points to a visually-hidden live region enumerating each `line/col/message` triplet so a screen-reader user gets the full list without scrolling the textarea
- Debug snapshot toast: `role="status"` for success, `role="alert"` for failure (sonner defaults)
- Switch: Radix Switch provides `role="switch" aria-checked`
- RadioGroup: Radix RadioGroup provides `role="radiogroup"`; each item `role="radio" aria-checked`
- Tooltip: Radix Tooltip provides `role="tooltip"` + keyboard focusability on the trigger

### Focus visibility on the green-phosphor palette

- Phase 2's `outline-2` upgrade for large click targets continues: CollapsibleCliPanel header, peer rows, Remove button, Sheet close `×` button all use `outline-2 outline-ring`
- Section form inputs use default `outline-2` inset via the `border-border-active` border swap
- Never use a dashed ring (clashes with CRT scanline moire)
- Never a non-`--color-ring` focus color

### Motion & reduced-motion

- Collapsible expand/collapse: `150 ms ease-out` open, `120 ms ease-out` close. `prefers-reduced-motion` disables and snaps to the final height immediately.
- Sheet entry: `100 ms linear` translate from right (Radix default; inherited from Phase 2)
- AlertDialog entry: `100 ms linear` fade + scale (existing `dialog.tsx`)
- Toast: `sonner` defaults; `prefers-reduced-motion` disables enter/exit animations
- No new animations beyond the above. No typewriter effects, no progress bars on Save (instant-or-toast feedback).

### Color-alone conveys no meaning

- Dirty state: paired with the dot glyph `·` and the `aria-label="unsaved changes"` SR text, not color-only
- Pending-restart: paired with the `⚠` glyph, the literal word "restart", and `aria-label="pending restart"`, not color-only
- Raw-TOML gutter error: paired with the `⚠` glyph, the numeric line number, and the SR live region enumerating `line X col Y: message` — color is redundant reinforcement
- Save button state: label changes (`[ Save ]` / `[ Saving… ]` / `[ Saved ]`) are the discriminator, not color
- Remove vs Cancel in AlertDialog: label words are the discriminator; the destructive color is redundant; focus order (safe-first) is the keyboard-user safety

---

## Token provenance summary

Every value in this spec derives from one of:

| Source | What it owns |
|--------|--------------|
| `src/globals.css` `@theme` block (L30-84) | Every color hex; `--radius`, `--spacing`, font variables |
| `.design/branding/pim/patterns/pim.yml` | Archetype, tone, spacing scale, font stack, shape constraints, pattern rules, motion bounds |
| `.design/branding/pim/patterns/STYLE.md` | Voice rules, component patterns, hard constraints (never/always), logo usage |
| `docs/UX-PLAN.md` §1 + §4a + §6f + §6h + §7 + §8 | Design principles, sidebar IA, Settings spec, error states, microcopy, progressive disclosure |
| `03-CONTEXT.md` D-01..D-32 | Every implementation-level decision locked this phase |
| `02-CONTEXT.md` D-01..D-31 | Sidebar shell, CliPanel grammar, Peer Detail slide-over surface Phase 3 extends |
| `02-UI-SPEC.md` | Visual vocabulary (spacing tokens, typography roles, color split) Phase 3 inherits verbatim |
| `cli-panel.tsx` | CliPanel structure — title bar, padding, border, font stack, leading |
| `status-indicator.tsx` | Glyph → color mapping; reused unchanged in Peers tab + Remove dialog context |
| `dialog.tsx` | Overlay color, modal surface, DialogTitle typography — reused for Custom time-range Dialog |
| `stop-confirm-dialog.tsx` | Pattern-copy for Remove-peer + Discard-changes AlertDialogs (first-focus-on-safe convention) |
| `daemon-toggle.tsx` | Pattern-copy for Restart toast action (stop → start sequence) |
| `reconnect-toast.tsx` (sonner Toaster already mounted) | Toast surface for Save success, Restart-required, Debug snapshot, daemon-reject |
| `rpc-types.ts` | `ConfigGetParams / ConfigSaveParams / ConfigValidationError / PeersAddStaticParams / PeersRemoveParams / RpcErrorCode` typed surfaces |

Values marked `(new)` in this spec:
- **Raw-TOML line-number gutter width `48px`** — Phase-3-original, justified by 4-digit line numbers at 14px JetBrains Mono width; proposed for future `.raw-gutter` utility
- **Accent use #5** — `⚠ pending restart` inline token in collapsed section summary (D-25 step 4)
- **Accent use #6** — raw-TOML gutter `⚠` marker + line-number for an erroring row (D-14) (destructive `col X: message` row stays on destructive — two-tone split is intentional)
- **Collapsible open motion 150 ms / close 120 ms** — Phase-3-discretion choice within the CONTEXT-allowed 150–250 ms range; Radix defaults are acceptable but 150/120 is the opinionated pick
- **AlertDialog first-focus-on-safe convention for destructive paths** — Phase-3 documented inversion of Phase 2's default-first-focus-on-primary; matches `stop-confirm-dialog.tsx` precedent from Phase 1

No other phase-3-original values. Every other class and color derives from existing
tokens. The Typography weight contract remains `{400, 600}` verbatim; the spacing scale
stays within the `pim.yml` canonical steps; the color split remains 60/30/10 with
accent + destructive reserved-use enumerated to six and four surfaces respectively.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
