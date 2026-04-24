---
phase: 1
slug: rpc-bridge-daemon-lifecycle
status: draft
shadcn_initialized: true
preset: pim brand (inlined in src/globals.css)
created: 2026-04-24
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the RPC Bridge & Daemon Lifecycle phase.
> The dashboard already exists and renders mock data; this phase makes
> every pixel conditional on real daemon state. Honest surfacing is the
> whole point — no green dot while the daemon is dead, no "Connecting…"
> while we are actually offline.

Tokens, fonts, and interaction vocabulary are locked in
`src/globals.css` (synced from `.design/branding/pim/patterns/pim.yml`).
This document references those tokens by CSS variable name; **do not
introduce new values**.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (new-york style) — already initialized |
| Preset | pim brand tokens inlined in `src/globals.css` (synced from kernel `.design/branding/pim/patterns/pim.yml`) |
| Component library | Radix primitives via shadcn; brand overrides in `src/components/ui/*` and `src/components/brand/*` |
| Icon library | Unicode glyphs first (`◆ ◈ ○ ✗ █`); lucide only as fallback when no Unicode equivalent exists (never for status) |
| Font | Geist Mono (structural · buttons · labels · nav · headings) · Geist (prose only) · JetBrains Mono (CLI output, code blocks, status panel content) |

Locked constraints (carry from `STYLE.md` — non-negotiable):

- `border-radius: 0` everywhere. No rounded pills.
- No shadows, no gradients, no glassmorphism.
- No blue or purple anywhere. No pure `#fff` or `#000`.
- No exclamation marks in any copy.
- Box-drawing (`┌─── ───┐`) for panel headers; `1px solid var(--color-border)` for rules.
- Status via Unicode (`◆ ◈ ○ ✗`) or bracketed codes (`[OK] [WARN] [ERR] [...]`). Never a multi-color lucide icon.

---

## Spacing Scale

From `pim.yml → tokens.spacing.scale`. Tailwind v4 `--spacing: 0.25rem` base (4px).

| Token | Value | Usage in Phase 1 |
|-------|-------|------------------|
| 1 (`xs`) | 4px | Glyph ↔ label gap in status indicator; padding inside `[BADGE]` y-axis |
| 2 (`sm`) | 8px | Gap between key-value rows; button vertical padding; stacked CLI-panel lines |
| 3 | 12px | Declared exception — badge y-padding, inline chip gaps. Present in `pim.yml` scale, used sparingly. |
| 4 (`md`) | 16px | Default section gap; status panel inner vertical rhythm; banner padding |
| 6 (`lg`) | 24px | CliPanel internal padding (`px-5 py-4` current); section vertical breaks |
| 8 (`xl`) | 32px | Major block gaps between hero / panel / footer |
| 12 (`2xl`) | 48px | Top-level page rhythm (`space-y-12` in `dashboard.tsx`) |
| 16 (`3xl`) | 64px | Reserved for viewport-scale breathing room; not used in Phase 1 |

**Exceptions:**
- `12px` lives in the brand scale alongside 8/16 — not a violation, it is the canonical `spacing.scale` array. Used only for badge/chip y-padding. Every Phase 1 component MUST pick from the declared scale above; no `5px`, `10px`, `18px`, `20px`.
- TUN permission modal minimum touch target: 44px button height (use shadcn `size="lg"` → h-12 = 48px, which exceeds the touch target floor and stays on-grid).

---

## Typography

Base 14px, `line-height: 1.6`, Major Third scale (ratio 1.250). Only
**two weights** ship in Phase 1: `400` (regular, body) and `600`
(semibold, headings · wordmark · `[OK]` badges).

| Role | Size | Weight | Line Height | Font Family | Usage in Phase 1 |
|------|------|--------|-------------|-------------|------------------|
| Micro | 11px | 400 (regular — uppercase + `tracking-[0.12em]` carries visual distinction without a third weight) | 1.4 | Geist Mono, `uppercase tracking-[0.12em]` | Kicker over hero ("proximity internet mesh"), badge content |
| Body / CLI | 14px | 400 | 1.6 | JetBrains Mono (inside CliPanel) · Geist (prose outside) | Status values, peer rows, banner body copy, uptime counter |
| Label | 14px | 400 | 1.6 | Geist Mono | Key-value `dt` labels ("mesh ip", "interface", "uptime"), footer legend |
| Heading | 20px | 600 | 1.3 | Geist Mono | Limited-mode banner headline, modal titles |
| Display | 48–72px (hero only, responsive) | 600 | 1.0 | Geist Mono | Animated `█ pim` hero logo — existing `logo-hero` class |

Letter-spacing rules (from `globals.css`):
- `h1 { letter-spacing: -0.02em }` · `h2 { letter-spacing: -0.015em }` — tight mono tracking on display type only.
- `uppercase tracking-wider` on buttons, badges, and `[STATUS]` codes.
- Never apply phosphor glow (`.phosphor`) to body text — only to signal-green headlines, the `█` logo block, and active status glyphs (`◆`).

---

## Color

All values are locked CSS variables. Reference them only by name. The
60/30/10 split below is already respected by the existing dashboard.

| Role | Token | Hex | Usage in Phase 1 |
|------|-------|-----|------------------|
| Dominant (60%) | `--color-background` | `#0a0c0a` | Page ground, button-secondary ground, limited-mode banner ground |
| Secondary (30%) | `--color-card` / `--color-popover` | `#121513` / `#1a1e1b` | Card surfaces, CliPanel body, status indicator chip ground |
| Accent (10%) — signal green | `--color-primary` | `#22c55e` | Daemon status **running**, peer **active** glyph (`◆`), primary CTA (`[ START DAEMON ]`), focus ring, selection |
| Warn — amber | `--color-accent` | `#e8a84a` | Daemon status **starting** and **reconnecting**, "Limited mode" banner border + headline, `[WARN]` badge ground |
| Destructive — phosphor red | `--color-destructive` | `#ff5555` | Daemon status **error**, `[ERR]` badge, "Couldn't start daemon" copy, stop-confirmation accents |
| Muted | `--color-muted-foreground` | `#7a807c` | Key labels (`dt`), metadata ("via tcp", "4h 22m"), inactive footer legend |
| Foreground | `--color-foreground` | `#d4d8d4` | Body text, banner body copy, peer mesh_ip values |
| Border | `--color-border` / `--color-border-active` | `#2a2e2c` / `#3a5a3e` | All hairline rules; hover-brighten on cards |

**Accent (signal green) is reserved for exactly these Phase 1 elements:**

1. The `█` block in the hero wordmark (`.phosphor` glow applied).
2. The daemon-running status dot (`●` phosphor green) and its `[OK]` badge ground on `CliPanel` header.
3. The primary action button `[ START DAEMON ]` ground.
4. The `◆` Unicode glyph on peer rows whose `state === "active"` — inherited behavior from existing `StatusIndicator`.
5. The focus ring (`--color-ring`).
6. The version line in the About/footer ("pim-daemon/0.2.0") — semibold green to signal successful handshake, glow OFF (not hero-scale).

Never use signal green for:
- Hover-only affordances on non-action elements (use `--color-border-active` instead).
- The "reconnecting…" indicator — that is amber, not green. Green only turns on when the handshake completes.
- Decorative divider glyphs (`·`, `─`) — those stay in `--color-border` or `--color-muted-foreground`.

**Destructive color is reserved for:**
- Daemon status `error` / `crashed` state and its `[ERR]` badge.
- The `✗` glyph on peer rows whose `state === "failed"` (Phase 2 surface, listed here because existing `StatusIndicator` already ships this mapping).
- The Stop-confirmation modal headline when user clicks Stop while peers are connected (Phase 1 — see `Stop flow` below).

**Amber (accent) is reserved for:**
- Daemon status `starting` (transient, ≤ 3s) and `reconnecting` (transient, during socket re-appearance).
- The Limited-mode banner's left border and headline.
- The `◈` relayed glyph — existing mapping in `StatusIndicator` (Phase 2+).
- `[WARN]` badge (e.g., "DEGRADED", "DRY_RUN").

---

## Copywriting Contract

All copy respects UX-PLAN §7, STYLE voice rules, and PROJECT.md locked
decisions. Declarative, no exclamation marks, names the system state
(not the user). Crypto primitives named on first use in any new copy.

| Element | Copy |
|---------|------|
| Primary CTA (daemon down) | `[ START DAEMON ]` |
| Primary CTA (daemon up) | `[ STOP DAEMON ]` (destructive variant) |
| Secondary CTA (limited-mode banner) | `[ VIEW LOGS ]` (ghost — links to Phase 2 Logs tab; in Phase 1 routes to placeholder) |
| Limited-mode banner headline | `Limited mode` |
| Limited-mode banner body | `pim daemon is stopped. Start it to join the mesh.` |
| Limited-mode banner — after external kill | `pim daemon is stopped. The daemon process exited. Start it to reconnect.` |
| Daemon status — stopped | `stopped` (muted foreground, `○` glyph) |
| Daemon status — starting | `starting…` (amber, `◐` glyph, blinking via `.cursor-blink`) |
| Daemon status — running | `running · {uptime}` (signal green, `●` glyph, phosphor glow) |
| Daemon status — reconnecting | `reconnecting…` (amber, `◐` glyph, blinking) |
| Daemon status — error | `error — {short reason}` (destructive red, `✗` glyph) |
| Uptime zero-state | `0s` — never hide the counter while running; always render from RPC `status.uptime_s` |
| TUN permission prompt headline | `Grant virtual network permission` |
| TUN permission prompt body | `pim needs permission to create a virtual network connection (TUN interface). This lets the mesh route traffic on your device without sending it through a third-party server. See docs/SECURITY.md §2.1.` |
| TUN permission actions | `[ GRANT PERMISSION ]` (primary) · `[ SKIP FOR NOW ]` (ghost — leaves daemon stopped, UI stays in limited mode) |
| Stop-confirmation headline (peers connected) | `Stop daemon` |
| Stop-confirmation body (peers connected) | `{N} connected peer{s} will disconnect. Routes will be torn down. You can start the daemon again at any time.` |
| Stop-confirmation body (solo) | `pim will stop listening on the mesh until you start it again.` |
| Stop-confirmation actions | `[ STOP DAEMON ]` (destructive) · `[ KEEP RUNNING ]` (ghost — names the system state we preserve, not a generic "cancel") |
| Empty-state heading (no data yet, handshake in flight) | `Reading daemon state…` |
| Empty-state body | `rpc.hello handshake in progress.` |
| Error — handshake version mismatch | `Incompatible daemon version. UI expects rpc_version 1; daemon reports rpc_version {N}. Update pim-daemon to continue. See docs/RPC.md §7.` |
| Error — daemon spawn failed | `Couldn't start pim-daemon. {platform reason}. See docs/TROUBLESHOOTING.md §daemon-spawn.` |
| Error — socket unreachable (daemon alive but not answering) | `Daemon process is up, but its socket at {path} did not accept a connection within 3s. Stop and restart it, or inspect logs.` |
| Error — RPC error from `rpc.hello` | `Daemon refused the handshake: {error.message}. Code: {error.code}.` |
| About / footer line (post-handshake) | `pim-daemon/{version} · rpc {rpc_version} · features: {feature_flags.join(", ")}` — mono, muted-foreground for labels, foreground for values, version string in signal green |
| About / footer line (no handshake yet) | `pim-daemon · not connected` (muted) |
| Reconnect toast (optional, bottom-right, auto-dismiss 3s) | `Daemon reconnected.` (signal green left border) |

Copy forbidden in Phase 1:
- "Connect" / "Disconnect" as the daemon-state verb — we are `start`/`stop`.
- "Online" / "Offline" — we are `running` / `stopped`.
- "Oops", "Uh oh", "Something went wrong" — name the failure.
- Any exclamation marks.
- "Please" (hedging).
- "TUN" without the parenthetical "virtual network" on first mention per session.

---

## Visual Surfaces — Component-Level Contract

Each surface below is bindable to a named React component (existing or
new). For new components, the filename is listed. Every prop that the
executor must wire is specified.

### Surface 1 — `<DaemonStatusIndicator />`

**New component:** `src/components/brand/daemon-status.tsx`

Big, honest status chip. Sits top-right of the main window header,
paired with the animated `█ pim` logo on the top-left. Visible from
every tab in every state except the splash.

**Props:**

```ts
type DaemonState =
  | "stopped"
  | "starting"
  | "running"
  | "reconnecting"
  | "error";

interface DaemonStatusIndicatorProps {
  state: DaemonState;
  uptimeSeconds?: number;      // only when state === "running"
  errorMessage?: string;       // only when state === "error"
  className?: string;
}
```

**Visual states** (Unicode glyph · label color · ground · animation):

| State | Glyph | Text token | Ground | Animation |
|-------|-------|------------|--------|-----------|
| stopped | `○` (U+25CB) | `--color-muted-foreground` | transparent | none |
| starting | `◐` (U+25D0) | `--color-accent` | transparent | `.cursor-blink` (1.1s step-end infinite) |
| running | `●` (U+25CF) | `--color-primary` + `.phosphor` glow | transparent | none — glow IS the signal |
| reconnecting | `◐` | `--color-accent` | transparent | `.cursor-blink` |
| error | `✗` (U+2717) | `--color-destructive` | transparent | none |

**Layout:**
- `inline-flex items-center gap-2`
- Glyph font: Geist Mono, 14px, matches label baseline
- Label font: Geist Mono 400, 14px, `lowercase` (not uppercase — matches UX-PLAN §6a "pim0 · up" style)
- Uptime suffix (running only): ` · {formatUptime(s)}` in `--color-muted-foreground`; ticks every 1s client-side from RPC baseline

**Interaction:**
- Hover: tooltip (Radix tooltip via shadcn) shows `{state} · last handshake {ts}` — no color change on the glyph itself
- Click: no action in Phase 1. (Reserved for Phase 2 drill-into logs.)
- Keyboard: `aria-live="polite"` on the label so state transitions announce to screen readers

**Accessibility:**
- Glyph wrapped in `<span role="img" aria-label={state}>`
- Label itself is real text, not a background image
- Color is never the sole state signal — glyph + text label always present
- Contrast: all color+ground pairs are ≥ AA Large. Signal green on background = AAA. Amber on background = AAA. Destructive on background = AAA.
- Reduced motion: `.cursor-blink` respects `prefers-reduced-motion` via existing globals.css rule; starting/reconnecting fall back to static glyph.

---

### Surface 2 — `<DaemonToggle />`

**New component:** `src/components/brand/daemon-toggle.tsx`

The single toggle that starts or stops the daemon. Never a switch — a
bracketed action button whose label flips based on state. Centered in
the Limited-mode banner when stopped, and inline in the CliPanel
header actions when running.

**Props:**

```ts
interface DaemonToggleProps {
  state: DaemonState;         // reuses type from DaemonStatusIndicator
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onConfirmStop?: () => void; // opens confirmation modal when peers > 0
  peerCount: number;          // used to gate the confirmation modal
}
```

**State → rendering:**

| State | Button label | Variant | Size | On click |
|-------|--------------|---------|------|----------|
| stopped | `[ START DAEMON ]` | `default` (primary green) | `lg` (h-12) | trigger TUN permission check → `onStart()` |
| starting | `[ STARTING… ]` | `default` | `lg` | disabled (opacity-40) |
| running (peers=0) | `[ STOP DAEMON ]` | `destructive` | `default` | `onStop()` directly |
| running (peers>0) | `[ STOP DAEMON ]` | `destructive` | `default` | opens confirmation dialog |
| reconnecting | `[ RECONNECTING… ]` | `secondary` | `default` | disabled |
| error | `[ RETRY START ]` | `default` | `lg` | `onStart()` |

**TUN permission flow (first start on this install):**

The first time `onStart` is called on this install and the OS requires
a privilege grant (macOS: TUN requires either root helper or
system-extension permission; Linux: CAP_NET_ADMIN), surface a modal
before the RPC call:

```
┌─── GRANT VIRTUAL NETWORK PERMISSION ───┐
│                                        │
│  pim needs permission to create a      │
│  virtual network connection (TUN       │
│  interface). This lets the mesh route  │
│  traffic on your device without        │
│  sending it through a third-party      │
│  server.                               │
│                                        │
│  See docs/SECURITY.md §2.1             │
│                                        │
│  [ GRANT PERMISSION ]  [ SKIP FOR NOW ]│
└────────────────────────────────────────┘
```

- Modal uses the existing Card primitive (`src/components/ui/card.tsx`).
- Backdrop: `bg-background/80` (no blur — blur would feel un-terminal).
- Close on ESC.
- `[ SKIP FOR NOW ]` leaves the daemon stopped; the Limited-mode banner body changes to: `pim daemon is stopped. Virtual network permission was skipped. Grant it to start.` with a `[ GRANT PERMISSION ]` button.

**Interaction:**
- All Button hover = video-invert (inherited from existing `Button` component).
- `starting` and `reconnecting` labels include the blinking cursor suffix `…` (three dots, no animation required — dots ARE the animation cue in terminals).
- Double-click prevention: `disabled` while the toggle is in a transient state.

**Accessibility:**
- `aria-busy="true"` during `starting` / `reconnecting`.
- `aria-disabled` instead of DOM `disabled` when state is transient, so focus is retained.
- Confirmation modal: Radix Dialog via shadcn; `aria-describedby` points to the body copy; primary action auto-focuses after 300ms.

---

### Surface 3 — `<LimitedModeBanner />`

**New component:** `src/components/brand/limited-mode-banner.tsx`

Full-width banner that replaces the top of the main-window content pane
when `daemon.state !== "running"`. Not a toast, not dismissible — this
is system state, not a notification.

**Props:**

```ts
interface LimitedModeBannerProps {
  state: Exclude<DaemonState, "running">;
  errorMessage?: string;
  onStart: () => void;           // wired to DaemonToggle
  onOpenLogs?: () => void;       // placeholder in Phase 1
}
```

**Layout** (using box-drawing discipline):

```
┌──────────────────────────────────────────────────────────────┐
│ ◐ LIMITED MODE                                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   pim daemon is stopped. Start it to join the mesh.          │
│                                                              │
│   [ START DAEMON ]    [ VIEW LOGS ]                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Wrapper: `border border-accent bg-card p-6` (24px padding).
- Left border widened to 2px via a separate inline `border-l-2 border-l-accent` for emphasis — the only element in the UI where border-width deviates from 1px; this is an explicit call-out for system-critical status.
- Header row: Geist Mono 400, `uppercase tracking-widest`, 14px. Glyph `◐` in amber before the word `LIMITED MODE`.
- Divider: `border-t border-border` after the header.
- Body: Geist Mono 400, 14px, foreground color, max-width `60ch`.
- Actions row: `[ START DAEMON ]` primary + `[ VIEW LOGS ]` ghost, gap 16px.
- No icon beyond `◐`. No illustration. No dismiss button.

**State variants:**

| State | Headline glyph + label | Body copy |
|-------|------------------------|-----------|
| stopped (fresh) | `◐ LIMITED MODE` | `pim daemon is stopped. Start it to join the mesh.` |
| stopped (after external kill) | `✗ DAEMON STOPPED UNEXPECTEDLY` (destructive headline) | `The daemon process exited. Start it to reconnect. See docs/TROUBLESHOOTING.md §unexpected-stop.` |
| starting | `◐ STARTING DAEMON…` (amber, blinking) | `Waiting for rpc.hello handshake.` |
| reconnecting | `◐ RECONNECTING…` (amber, blinking) | `Daemon socket at {path} reappeared. Restoring subscriptions.` |
| error | `✗ DAEMON ERROR` (destructive) | `{errorMessage}` — shown verbatim from error payload; fallback to `pim-daemon reported an error. Start again, or inspect logs.` |

**Interaction:**
- `[ START DAEMON ]` delegates to `DaemonToggle.onStart`.
- `[ VIEW LOGS ]` navigates to the Logs tab (in Phase 1, route exists but tab content is a placeholder — Phase 2 scope).
- The CliPanel / status dashboard content remains rendered BELOW the banner, but dimmed to 50% opacity and pointer-events-none when `state !== "running"` — reveals the last-known state honestly without letting the user interact with stale data.
- When the daemon transitions back to `running`, the banner unmounts with `duration-100 linear` opacity fade (or instant, respecting reduced-motion) and the dashboard fades back to full opacity.

**Accessibility:**
- `role="status"` on the banner root so screen readers announce state changes.
- Headline glyph has `aria-hidden="true"`; the headline text itself carries the semantic state.
- `[ START DAEMON ]` is the first focusable element after mount.

---

### Surface 4 — `<UptimeCounter />`

**New component:** `src/components/brand/uptime-counter.tsx`

Ticks forward every second while the daemon is running. Source of
truth is `status.uptime_s` from the most recent `status` RPC (or
`status.event`). Client increments locally between server updates so
the UI doesn't stutter.

**Props:**

```ts
interface UptimeCounterProps {
  baselineSeconds: number;     // last value returned by `status` RPC
  baselineTimestamp: number;   // Date.now() at the moment we received baseline
  className?: string;
}
```

**Format:**
- < 60s: `{n}s` — e.g., `42s`
- < 1h: `{m}m {s}s` — e.g., `3m 07s`
- < 24h: `{h}h {m}m` — e.g., `4h 22m` (matches existing `formatUptime` in `dashboard.tsx`)
- ≥ 24h: `{d}d {h}h` — e.g., `2d 14h`

Font: JetBrains Mono, 14px, `tabular-nums` (via `font-variant-numeric:
tabular-nums`) so digits don't shift width when ticking. Color
`--color-foreground`.

**Tick strategy:**
- On mount, compute `delta = Math.floor((Date.now() - baselineTimestamp) / 1000)` and render `baselineSeconds + delta`.
- `setInterval(1000)` to re-render; cleared on unmount.
- When a new `status` RPC arrives, parent re-renders with new baseline — the counter resets its internal clock.
- Never persist to localStorage. The counter survives window close/reopen because `status.uptime_s` is read fresh from the daemon on reconnect (success criterion 6).

**Accessibility:**
- Wrapped in `<time dateTime={ISO-8601 started_at}>` when `started_at` is available, so assistive tech can announce the absolute start moment, not just the delta.
- `aria-live="off"` — ticking every second would flood screen readers. The counter is silent; state changes on the daemon status chip do the announcing.

---

### Surface 5 — `<AboutFooter />`

**New component:** `src/components/brand/about-footer.tsx`

Bottom of the main window. Exposes daemon version + feature flags from
`rpc.hello` (success criterion 5). Replaces the current static legend
in `dashboard.tsx` footer.

**Props:**

```ts
interface AboutFooterProps {
  daemon: {
    version: string;                  // e.g. "pim-daemon/0.2.0"
    rpcVersion: number;               // e.g. 1
    features: string[];               // from rpc.hello
  } | null;                           // null = no handshake yet
}
```

**Layout:**

```
───────────────────────────────────────────────────────────────
◆ active   ◈ relayed   ○ connecting   ✗ failed
pim-daemon/0.2.0 · rpc 1 · features: logs.stream, peers.discovered, gateway.preflight
```

- Two rows inside a `footer` element. Top row: existing peer-state
  legend (kept from `dashboard.tsx`). Bottom row: version string.
- Top border: `border-t border-border`, padding-top 24px.
- Version string: Geist Mono 400, 11px (micro size), `tracking-widest`
  `lowercase`. Version token (`pim-daemon/0.2.0`) in signal green (`--color-primary`), rest in `--color-muted-foreground`. Features
  comma-separated; if > 3 features, ellipsize and show full list on
  hover (Radix tooltip).

**Variants:**

| State | Bottom row copy |
|-------|-----------------|
| no handshake yet | `pim-daemon · not connected` (muted) |
| post-handshake | `{daemon.version} · rpc {daemon.rpcVersion} · features: {daemon.features.join(", ")}` |
| rpc_version mismatch | `pim-daemon/{version} · rpc {n} — incompatible (expected rpc 1)` in destructive red, no features |

**Accessibility:**
- Plain text, no interactive elements other than the feature-list tooltip.
- Tooltip trigger: `<button type="button">` with `aria-label="Show all feature flags"`.

---

### Surface 6 — Dashboard honesty overlay

**Modify existing:** `src/screens/dashboard.tsx`

Phase 1 does not redesign the dashboard — Phase 2 does. But it does
make the existing CliPanel conditional on daemon state.

**Rendering rules:**

| `daemon.state` | CliPanel | DaemonStatusIndicator | LimitedModeBanner |
|----------------|----------|-----------------------|-------------------|
| `stopped` | hidden | `○ stopped` | shown |
| `starting` | hidden (splash of pim logo only) | `◐ starting…` (blinking) | shown, variant=starting |
| `running` | rendered with live data from `status` RPC | `● running · {uptime}` | hidden |
| `reconnecting` | rendered, 50% opacity, pointer-events-none, last-known data | `◐ reconnecting…` | shown, variant=reconnecting |
| `error` | hidden | `✗ error` | shown, variant=error |

**CliPanel header badge:**
- While `running`: `[OK]` (primary ground) — existing.
- While `reconnecting`: `[...]` (muted ground) — new variant; add to `Badge` variants if not already present, keyed to `--color-muted` + `--color-muted-foreground`.
- Any other state: CliPanel is not rendered, so no badge.

**Hero section:**
- Animated `<Logo />` always renders regardless of daemon state — the
  brand identity is independent of connection state. The wordmark does
  not go grey when the daemon is down.
- The `Read the protocol` / `View on GitHub` buttons remain as they are.

---

### Surface 7 — Reconnect toast (optional Phase 1, required for success criterion 4 polish)

**New component:** `src/components/brand/reconnect-toast.tsx`
(If shadcn `toaster` is not already installed, add it via
`npx shadcn add sonner` or use a minimal hand-rolled variant.)

Fires exactly once when the daemon transitions `reconnecting → running`.
Not fired on initial successful start.

**Layout:**

```
┌────────────────────────────────┐
│ ◆ Daemon reconnected.          │
│ pim-daemon/0.2.0 · rpc 1       │
└────────────────────────────────┘
```

- Bottom-right, 16px inset from viewport edges.
- `border-l-2 border-l-primary bg-card p-4`.
- Headline: Geist Mono 400, 14px, signal green `◆` glyph + foreground
  text.
- Auto-dismiss after 3000ms; linear fade (100ms).
- Paused on hover (inherit Sonner default).

**Accessibility:**
- `role="status"`, `aria-live="polite"`.
- Focus not moved — this is passive info.

Phase 1 success criterion 4 requires detection + reconnect; the toast
is the user-visible confirmation that reconnection happened. If shadcn
Sonner is not yet installed, the minimum viable alternative is
re-using the `LimitedModeBanner` in a one-shot `variant="success"`
render for 3s before unmounting.

---

## Interaction State Matrix

| Daemon state | Banner | Status chip | Toggle | CliPanel | Toast |
|--------------|--------|-------------|--------|----------|-------|
| stopped (fresh install) | LIMITED MODE · amber | `○ stopped` muted | `[ START DAEMON ]` primary | hidden | — |
| stopped (TUN permission skipped) | LIMITED MODE · amber, perm-skipped body | `○ stopped` muted | `[ START DAEMON ]` primary (triggers perm modal again) | hidden | — |
| starting | STARTING DAEMON… · amber blinking | `◐ starting…` amber blinking | `[ STARTING… ]` disabled | hidden | — |
| running · peers=0 | hidden | `● running · {uptime}` phosphor | `[ STOP DAEMON ]` destructive | live | — |
| running · peers>0 | hidden | `● running · {uptime}` phosphor | `[ STOP DAEMON ]` destructive → confirm modal | live | — |
| reconnecting | RECONNECTING… · amber blinking | `◐ reconnecting…` amber blinking | `[ RECONNECTING… ]` disabled | dim 50%, last-known | — (fires on next running) |
| running after reconnect | hidden | `● running · {uptime}` phosphor | `[ STOP DAEMON ]` destructive | live | `◆ Daemon reconnected.` (3s) |
| stopped (after external kill) | DAEMON STOPPED UNEXPECTEDLY · destructive | `○ stopped` muted | `[ START DAEMON ]` primary | hidden | — |
| error | DAEMON ERROR · destructive | `✗ error` destructive | `[ RETRY START ]` primary | hidden | — |

---

## Motion

Inherits brand discipline: `duration-100 linear` for everything.

| Interaction | Duration | Easing | Respect reduced-motion |
|-------------|----------|--------|------------------------|
| Button hover video-invert | 100ms | linear | yes (inherit from `transition-colors` class) |
| Banner mount / unmount | 100ms opacity fade | linear | yes (fall back to instant) |
| Toast slide-in | 100ms | linear | yes (fall back to instant fade) |
| `.cursor-blink` on `◐` glyph | 1.1s step-end infinite | step-end | yes — existing rule in `globals.css` zeros the animation |
| `.logo-hero` type-reveal | existing | existing | existing |
| Dashboard dim on reconnect | 100ms opacity | linear | yes |

No cinematic easing, no spring physics. This is a terminal.

---

## Accessibility

- All Unicode status glyphs wrapped in `<span role="img" aria-label="…">` — existing pattern in `StatusIndicator`.
- All colors paired with a text label or glyph; color is never the sole state signal.
- Focus ring: 1px solid `--color-ring` with 2px offset — existing in `globals.css`. Never removed.
- TUN permission modal: traps focus within Dialog, restores focus to `[ START DAEMON ]` on close.
- Status transitions announced via `aria-live="polite"` on the DaemonStatusIndicator label.
- Banner carries `role="status"`; daemon errors carry `role="alert"` (the only `alert` role in Phase 1 — destructive state only).
- All buttons meet 44×44px touch target at `size="lg"` (48px) and `size="default"` (40px). Note: `default` size is h-10 = 40px, below iOS 44px guideline; for Phase 1 desktop-only surfaces this is acceptable. Flag for Phase 5 mobile adaptation.
- Contrast audit (AAA targets):
  - `--color-foreground` (`#d4d8d4`) on `--color-background` (`#0a0c0a`) → 13.5:1 AAA
  - `--color-primary` (`#22c55e`) on `--color-background` → 7.1:1 AAA (large), AA (body)
  - `--color-accent` (`#e8a84a`) on `--color-background` → 10.2:1 AAA
  - `--color-destructive` (`#ff5555`) on `--color-background` → 6.4:1 AA (body), AAA (large)
  - `--color-muted-foreground` (`#7a807c`) on `--color-background` → 4.5:1 AA large only — MUST NOT be used at body size (respect the globals.css comment). Used only for labels and metadata in Phase 1.

---

## Component Inventory (Phase 1 deliverables)

| Component | Status | Path |
|-----------|--------|------|
| `<Logo />` animated | exists · reuse as-is | `src/components/brand/logo.tsx` |
| `<CliPanel />` | exists · reuse as-is | `src/components/brand/cli-panel.tsx` |
| `<StatusIndicator />` | exists · reuse for peer glyphs | `src/components/brand/status-indicator.tsx` |
| `<Button />` | exists · reuse (use `destructive` + `ghost` variants) | `src/components/ui/button.tsx` |
| `<Badge />` | exists · extend with `muted` variant for `[...]` | `src/components/ui/badge.tsx` |
| `<Card />` | exists · reuse inside TUN permission modal | `src/components/ui/card.tsx` |
| `<DaemonStatusIndicator />` | NEW | `src/components/brand/daemon-status.tsx` |
| `<DaemonToggle />` | NEW | `src/components/brand/daemon-toggle.tsx` |
| `<LimitedModeBanner />` | NEW | `src/components/brand/limited-mode-banner.tsx` |
| `<UptimeCounter />` | NEW | `src/components/brand/uptime-counter.tsx` |
| `<AboutFooter />` | NEW | `src/components/brand/about-footer.tsx` |
| `<TunPermissionModal />` | NEW | `src/components/brand/tun-permission-modal.tsx` |
| `<StopConfirmDialog />` | NEW | `src/components/brand/stop-confirm-dialog.tsx` |
| `<ReconnectToast />` | NEW (optional; Sonner via shadcn if not already installed) | `src/components/brand/reconnect-toast.tsx` |

Shadcn blocks to add (if not already installed):
- `dialog` (Radix Dialog wrapper) — for TUN permission + stop-confirm modals
- `tooltip` (Radix Tooltip wrapper) — for status chip hover + feature-list overflow
- `sonner` (Toast) — for reconnect toast (optional; LimitedModeBanner variant-swap is the fallback)

Install command (if shadcn dialog/tooltip/sonner not yet present):
```bash
npx shadcn add dialog tooltip sonner
```
The executor MUST verify each is absent before running this command; do not re-install existing primitives.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | button (existing), badge (existing), card (existing), input (existing), dialog (new — if needed), tooltip (new — if needed), sonner (new — if needed) | not required |
| — | — | no third-party registries declared for Phase 1 |

No third-party registry blocks are declared for Phase 1. Registry
vetting gate: not applicable.

---

## Source Mapping (traceability)

Each surface above implements specific requirements and success criteria.

| Surface | Requirements | Success Criteria |
|---------|--------------|------------------|
| `<DaemonStatusIndicator />` | DAEMON-03, DAEMON-04 | #1 (stopped→starting→running visible), #6 (uptime visible) |
| `<DaemonToggle />` | DAEMON-01, DAEMON-02 | #1 (single toggle), #2 (stop cleanly) |
| `<LimitedModeBanner />` | RPC-03, RPC-04, DAEMON-03 | #3 (limited mode copy + Start action), #4 (external kill detected) |
| `<UptimeCounter />` | DAEMON-04 | #6 (ticks forward, survives close/reopen) |
| `<AboutFooter />` | RPC-02, RPC-05 | #5 (daemon version + feature flags from rpc.hello) |
| Dashboard honesty overlay | RPC-01, RPC-03, STAT-01..04 (partial — Phase 2 completes) | #3 (not a blank screen), #4 (last-known state during reconnect) |
| `<ReconnectToast />` | RPC-04 | #4 (auto-reconnect confirmed visibly) |
| TUN permission modal | DAEMON-01 | #1 (first-start permission flow) |
| Stop-confirm dialog | DAEMON-02 | #2 (stop cleanly, acknowledge connected peers) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
