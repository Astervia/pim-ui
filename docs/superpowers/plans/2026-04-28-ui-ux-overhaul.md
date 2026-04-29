# pim-ui · UI/UX Overhaul Master Plan

> **For agentic workers:** This is a **multi-phase master plan**. Each phase is independently shippable and testable. Phase 1 is fully task-detailed; Phases 2–9 list goals, file targets, key tasks, and success criteria — they will be expanded into bite-sized tasks when picked up.

**Goal:** Take the existing functionally-correct pim-ui from "Good (14/20)" to "Excellent (≥18/20)" by raising visual hierarchy, motion vocabulary, flow polish, and responsive discipline — without compromising the terminal-native brand or honesty contracts.

**Architecture:** Phased refactor that preserves every functional contract (W1, locked copy, daemon-as-source-of-truth) while enriching the visual layer. Each phase commits independently and is reviewable as a single unit. No new RPC methods, no new daemon contracts, no new feature work — all changes live in the React layer.

**Tech Stack:** React 19, Tailwind v4 (`@theme` tokens), Tauri 2, shadcn/ui (new-york), Radix primitives, Sonner toasts, cmdk palette. Existing test runner (vitest) covers logic; visual changes verified via dev server + screenshot comparison.

**Brand absolutes (NEVER break):**
- `border-radius: 0` everywhere
- Geist Mono / Geist / JetBrains Mono only
- Tokens only — never literal palette colors (`text-green-*`, `bg-blue-*`, `#hex` in JSX)
- No shadows, no gradients, no glow except phosphor on signal-green text
- No exclamation marks in any user-visible string
- Voice rules from `.design/branding/pim/patterns/STYLE.md`
- W1: no new `listen(...)` calls outside `src/lib/rpc.ts` + `src/hooks/use-daemon-state.ts` (plus the documented `pim://open-add-peer` exception in `app-shell.tsx`)
- Locked copy: every user-visible string sourced from `src/lib/copy.ts`

---

## Audit reference (frozen 2026-04-28)

Baseline score: **14/20 — Good**. Phase ordering below is dependency-aware: foundational layout/motion primitives ship first because every later phase consumes them.

| # | Dimension | Baseline | Target after overhaul |
|---|-----------|----------|------------------------|
| 1 | Accessibility | 2/4 | 4/4 |
| 2 | Performance | 3/4 | 4/4 |
| 3 | Theming | 4/4 | 4/4 (preserve) |
| 4 | Responsive | 1/4 | 3/4 |
| 5 | Anti-Patterns | 4/4 | 4/4 (preserve) |

---

## Phase ordering & dependency graph

```
Phase 1 — Layout foundation (container system, panel rhythm, banner stack)
   ↓
Phase 2 — Motion vocabulary (type-reveal, video-invert, prompt-prefix utility)
   ↓
Phase 3 — Loading & empty states (uses Phase 2 motion primitives)
   ↓
Phase 4 — Sidebar dynamic state (daemon-state glyph, count badges)
   ↓
Phase 5 — Dashboard composition (panel weight, hero treatment, RouteToggle prominence)
   ↓
Phase 6 — Peer flow polish (touch targets, progressive disclosure, troubleshoot routing)
   ↓
Phase 7 — Settings density (search, summary refinement, section affordances)
   ↓
Phase 8 — Power-user discoverability (⌘K hint, keyboard cheat sheet)
   ↓
Phase 9 — A11y & responsive pass (contrast audit, container queries, touch targets)
```

Each phase is a standalone PR. Average phase: 1–3 days of focused work.

---

# Phase 1 — Layout foundation

**Goal:** Establish a single source of truth for screen container width and panel spacing rhythm. Consolidate banner mount points so `LimitedModeBanner` + `KillSwitchBanner` never compete.

**Why first:** Every subsequent phase modifies panels or screens. Without a fluid container primitive and a deterministic banner stack, visual drift compounds.

**Files:**
- Create: `src/components/shell/screen-container.tsx`
- Create: `src/components/shell/banner-stack.tsx`
- Modify: `src/components/shell/app-shell.tsx`
- Modify: `src/screens/dashboard.tsx`
- Modify: `src/screens/peers.tsx`
- Modify: `src/screens/routing.tsx`
- Modify: `src/screens/gateway.tsx`
- Modify: `src/screens/logs.tsx`
- Modify: `src/screens/settings.tsx`
- Test: `src/components/shell/screen-container.test.tsx`

### Task 1.1 — ScreenContainer primitive

**Files:**
- Create: `src/components/shell/screen-container.tsx`
- Test: `src/components/shell/screen-container.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/shell/screen-container.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScreenContainer } from "./screen-container";

describe("ScreenContainer", () => {
  it("applies default content width and gap", () => {
    const { container } = render(
      <ScreenContainer>
        <div>x</div>
      </ScreenContainer>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("max-w-[72ch]");
    expect(el.className).toContain("gap-6");
  });

  it("supports a 'wide' density for log/gateway screens", () => {
    const { container } = render(
      <ScreenContainer density="wide">
        <div>x</div>
      </ScreenContainer>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("max-w-[96ch]");
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `pnpm vitest run src/components/shell/screen-container.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ScreenContainer**

```typescript
// src/components/shell/screen-container.tsx
/**
 * Single source of truth for screen content width and rhythm.
 * Replaces the ad-hoc max-w-3xl/4xl/5xl that varied per screen.
 *
 * - density="default" → 72ch — Dashboard / Peers / Routing / Settings
 * - density="wide"    → 96ch — Logs / Gateway (wider tables)
 *
 * Width is content-measured (ch) so it scales with the active monospace
 * font and stays readable at any viewport size. Pair with the parent
 * <main className="px-8 py-8"> in AppShell.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScreenContainerProps {
  density?: "default" | "wide";
  children: ReactNode;
  className?: string;
}

export function ScreenContainer({
  density = "default",
  children,
  className,
}: ScreenContainerProps) {
  return (
    <div
      className={cn(
        density === "wide" ? "max-w-[96ch]" : "max-w-[72ch]",
        "flex flex-col gap-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm vitest run src/components/shell/screen-container.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/screen-container.tsx src/components/shell/screen-container.test.tsx
git commit -m "feat(shell): introduce ScreenContainer primitive for unified screen width + rhythm"
```

### Task 1.2 — Adopt ScreenContainer in every screen

**Files:**
- Modify: `src/screens/dashboard.tsx:135`
- Modify: `src/screens/peers.tsx:65`
- Modify: `src/screens/routing.tsx:64`
- Modify: `src/screens/logs.tsx:71`
- Modify: `src/screens/gateway.tsx:66,79,92,129,145,158`
- Modify: `src/screens/settings.tsx:101`

- [ ] **Step 1: Replace Dashboard wrapper**

In `src/screens/dashboard.tsx`, replace `<div className="max-w-4xl flex flex-col gap-6">` with `<ScreenContainer>` and add the import `import { ScreenContainer } from "@/components/shell/screen-container";`.

- [ ] **Step 2: Replace Peers, Routing, Settings wrappers** with `<ScreenContainer>` (default density). All three currently use `max-w-4xl flex flex-col gap-6` or `max-w-3xl flex flex-col gap-6`.

- [ ] **Step 3: Replace Logs and Gateway wrappers** with `<ScreenContainer density="wide">`. Logs uses `max-w-5xl`, Gateway uses `max-w-5xl` across 6 branch returns — replace each.

- [ ] **Step 4: Run type check + existing tests**

Run: `pnpm typecheck && pnpm test`
Expected: Both pass; no test references removed `max-w-` classes.

- [ ] **Step 5: Visual verify in dev**

Run: `pnpm tauri dev` (or `pnpm dev` for browser)
Open every screen (⌘1–⌘6). Confirm content width is consistent on Dashboard / Peers / Routing / Settings, and wider on Logs / Gateway. No horizontal scroll at 1280×800.

- [ ] **Step 6: Commit**

```bash
git add src/screens
git commit -m "refactor(screens): adopt ScreenContainer; unify screen widths"
```

### Task 1.3 — BannerStack component

**Files:**
- Create: `src/components/shell/banner-stack.tsx`
- Modify: `src/components/shell/app-shell.tsx:227-240`
- Modify: `src/screens/dashboard.tsx` (remove inline LimitedModeBanner)

- [ ] **Step 1: Implement BannerStack**

```typescript
// src/components/shell/banner-stack.tsx
/**
 * Single mount point for system-state banners. Stack order is fixed:
 * KillSwitchBanner (most critical) above LimitedModeBanner. Each banner
 * self-derives its visibility from useDaemonState / useKillSwitch and
 * renders nothing when its condition is false — the stack is therefore
 * a pure ordering decision, not a state machine.
 *
 * Mount once in AppShell above ActiveScreen. Removes the previous split
 * where Dashboard rendered LimitedModeBanner inline (causing duplicate
 * banners during transitions on screens that also rendered their own).
 */
import { KillSwitchBanner } from "@/components/brand/kill-switch-banner";
import { LimitedModeBanner } from "@/components/brand/limited-mode-banner";

export function BannerStack() {
  return (
    <div className="flex flex-col gap-3">
      <KillSwitchBanner />
      <LimitedModeBanner />
    </div>
  );
}
```

- [ ] **Step 2: Mount BannerStack in AppShell, remove the bare KillSwitchBanner**

In `src/components/shell/app-shell.tsx`, replace `<KillSwitchBanner />` with `<BannerStack />` and import `BannerStack` from `./banner-stack`. Drop the now-unused `KillSwitchBanner` import.

- [ ] **Step 3: Remove the inline LimitedModeBanner from Dashboard**

In `src/screens/dashboard.tsx`, delete the `{showLimitedBanner === true ? <LimitedModeBanner /> : null}` line and the `showLimitedBanner` const declaration. The shell-level BannerStack now owns banner display for every screen.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: PASS. If a Dashboard test expected the inline banner, update it to assert the AppShell-level mount instead.

- [ ] **Step 5: Visual verify**

Stop the daemon (`pim-daemon stop` or via toggle). Navigate every screen. Confirm exactly one LimitedModeBanner is visible at the top of every screen. Toggle route_on with no gateway (kill-switch condition) — KillSwitch banner appears above LimitedMode if both are active.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/banner-stack.tsx src/components/shell/app-shell.tsx src/screens/dashboard.tsx
git commit -m "refactor(shell): consolidate banners into BannerStack; remove duplicate Dashboard mount"
```

### Task 1.4 — Spacing rhythm in CliPanel

**Files:**
- Modify: `src/components/brand/cli-panel.tsx`

Goal: introduce optional `density` prop on CliPanel so different panel types can use different vertical rhythm without per-call padding tweaks.

- [ ] **Step 1: Extend CliPanelProps with density**

```typescript
// src/components/brand/cli-panel.tsx (modify CliPanelProps + body padding)
export interface CliPanelProps {
  title: string;
  status?: { label: string; variant?: BadgeVariant };
  children: ReactNode;
  className?: string;
  /**
   * "default" — 16px header padding, 20px body padding (current behavior).
   * "compact" — 12px header padding, 12px body padding (metrics, single-line panels).
   * "spacious" — 16px header padding, 32px body padding (hero panels like Identity).
   */
  density?: "default" | "compact" | "spacious";
}

export function CliPanel({ title, status, children, className, density = "default" }: CliPanelProps) {
  const bodyPadding =
    density === "compact" ? "px-4 py-3" :
    density === "spacious" ? "px-5 py-6" :
    "px-5 py-4";
  return (
    <section className={cn("bg-popover border border-border text-foreground", "font-code text-sm leading-[1.7]", className)}>
      <header className={cn("flex items-center justify-between gap-4", "px-4 py-2 border-b border-border", "font-mono text-xs uppercase tracking-widest", "text-muted-foreground")}>
        <span>┌─── {title.toUpperCase()} ───┐</span>
        {status && <Badge variant={status.variant ?? "default"}>[{status.label}]</Badge>}
      </header>
      <div className={cn(bodyPadding, "overflow-x-auto")}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Apply density="spacious" to IdentityPanel**

In `src/components/identity/identity-panel.tsx`, pass `density="spacious"` to both CliPanel calls (loading branch + main branch). Identity is the visual hero — it earns the extra breathing room.

- [ ] **Step 3: Apply density="compact" to MetricsPanel**

In `src/components/metrics/metrics-panel.tsx`, pass `density="compact"` to both CliPanel calls. Metrics is a single line; spacious padding wastes vertical space.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: PASS. CliPanel rendering tests still pass — `density` defaults to current behavior.

- [ ] **Step 5: Visual verify**

Open Dashboard with daemon running. Confirm:
- IdentityPanel has noticeably more breathing room than before
- MetricsPanel sits tight at the bottom (≈40% less vertical space)
- All other panels render unchanged

- [ ] **Step 6: Commit**

```bash
git add src/components/brand/cli-panel.tsx src/components/identity/identity-panel.tsx src/components/metrics/metrics-panel.tsx
git commit -m "feat(cli-panel): add density prop; spacious for hero, compact for one-liners"
```

### Phase 1 success criteria

- [ ] Every screen renders through `<ScreenContainer>` — `grep -r "max-w-3xl\|max-w-4xl\|max-w-5xl" src/screens` returns zero results.
- [ ] Banners only mount once at shell level — no `<LimitedModeBanner />` or `<KillSwitchBanner />` import remains in any `src/screens/` file.
- [ ] `pnpm test` passes with no skipped tests.
- [ ] `pnpm typecheck` passes.
- [ ] Manual: Dashboard panels show clear hierarchy (Identity > Peers > others > Metrics) by visual weight.

---

# Phase 2 — Motion vocabulary

**Goal:** Implement the four motion primitives declared in `pim.yml` that aren't live yet: `video-invert`, `prompt-prefix`, `type-reveal` (beyond the splash), and a panel-level CRT-on transition. Surface them through reusable utility classes + tiny React hooks.

**Why second:** Phase 3 (loading/empty states) and Phase 5 (dashboard composition) both consume these primitives. Building them in isolation prevents copy-paste motion code across screens.

**Files:**
- Modify: `src/globals.css` (add `.type-reveal`, `.video-invert-hover`, `.crt-on` keyframes/utilities)
- Create: `src/hooks/use-type-reveal.ts`
- Create: `src/components/brand/cli-panel-mount.tsx` (variant of CliPanel that fades in with CRT-on effect)
- Test: `src/hooks/use-type-reveal.test.ts`

**Key tasks (to be detailed when picked up):**

1. Add `.type-reveal` CSS utility — generic version of the `.logo-typed` pattern that any text node can opt into via `data-reveal`. Driven by `steps()` so it stays terminal-native.
2. Add `.crt-on` keyframe — a 200ms phosphor-tinted brightness ramp + scanline density bump that fires on first mount of CliPanel content. `prefers-reduced-motion` short-circuits.
3. Wire `.video-invert-hover` as a Tailwind plugin or CSS utility — applies the brand's signature button hover (bg ↔ text swap) to any element. Replace ad-hoc hover classes in PeerRow + sidebar nav rows.
4. `useTypeReveal()` hook — returns ref + replay function for type-reveal animations on dynamic strings (e.g., "Routing enabled via gateway-c").
5. Apply `.crt-on` to first-paint of every CliPanel; ensure subsequent re-renders don't re-trigger.

**Success criteria:**
- Daemon transition (stopped → running) plays a coordinated `.crt-on` sweep across the panel stack, staggered by 60ms per panel.
- Hovering bracketed buttons no longer needs ad-hoc Tailwind hover classes — `.video-invert-hover` utility owns the rule.
- Reduced-motion preference disables every effect; static render verified in dev tools.

---

# Phase 3 — Loading & empty states

**Goal:** Replace plain "Loading status…" / "no peers connected" text with brand-correct loading scans and teaching empty states.

**Files:**
- Modify: `src/components/identity/identity-panel.tsx` (loading branch)
- Modify: `src/components/metrics/metrics-panel.tsx` (loading branch)
- Modify: `src/components/peers/peer-list-panel.tsx` (empty state)
- Modify: `src/components/peers/peers-panel.tsx` (empty state)
- Modify: `src/components/peers/nearby-panel.tsx` (empty state)
- Modify: `src/components/routing/route-table-panel.tsx` (empty state)
- Modify: `src/components/routing/known-gateways-panel.tsx` (empty state)
- Create: `src/components/brand/scan-loader.tsx` — reusable ASCII scan-line loader (`[████······]`)
- Create: `src/components/brand/teaching-empty-state.tsx` — empty state with optional teaching microcopy line + suggested next action

**Key tasks:**

1. `<ScanLoader />` component: `[████······]` progress glyph that animates left-to-right via `steps(10, end)` over 1.6s, infinite. Shown alongside "loading {what}…" in muted tone.
2. `<TeachingEmptyState />` component: keeps the locked verbatim copy as the headline, but adds an optional teaching `next` prop ("⌘K to search · or [ Add peer nearby ]") and animated discovery indicator (cycles through `udp · ble · wfd` every 2s when relevant).
3. Replace each loading branch in IdentityPanel / MetricsPanel with `<ScanLoader />` + the existing copy.
4. Replace each empty state with `<TeachingEmptyState />`. Locked-copy contract preserved — only the optional `next` line is new and itself sourced from `lib/copy.ts`.
5. Add new entries to `src/lib/copy.ts` (audit-locked): `EMPTY_PEERS_NEXT`, `EMPTY_NEARBY_NEXT`, `EMPTY_ROUTES_NEXT`, `EMPTY_GATEWAYS_NEXT`. Update `pnpm audit:copy` if it pins exhaustive constants.

**Success criteria:**
- Every loading state uses `<ScanLoader />` — `grep "Loading.*…" src/components` finds no orphan plain-text loaders.
- Every empty state uses `<TeachingEmptyState />` — at minimum the existing verbatim line, but the panel teaches the user what to do next.
- Discovery indicator visibly cycles in NearbyPanel empty state.
- All locked-copy tests pass (`pnpm test src/lib/copy.test.ts`).

---

# Phase 4 — Sidebar dynamic state

**Goal:** Make the sidebar a live status surface, not just navigation. Wordmark reflects daemon state; nav rows show counts when relevant.

**Files:**
- Modify: `src/components/shell/sidebar.tsx`
- Create: `src/components/shell/sidebar-wordmark.tsx`
- Create: `src/components/shell/sidebar-row-badge.tsx`
- Modify: `src/hooks/use-daemon-state.ts` (no contract change — selector additions only)

**Key tasks:**

1. `<SidebarWordmark />`: replaces the static `█ pim` div. The block glyph color reflects daemon state — primary (running), accent (starting/reconnecting), destructive (error), muted (stopped). Phosphor glow only when `running`. Keep the existing `.logo-hero` class for the cursor-blink.
2. Selector hooks: `useNearbyCount()`, `useFailedPeerCount()`, `useLogErrorBacklog()` — derived from existing snapshot fields, no new RPC.
3. Each nav row gets an optional `<SidebarRowBadge>` rendered between label and shortcut:
   - `peers` → `[N nearby]` if `nearbyCount > 0`
   - `logs`  → `[N err]` if errors > 0 in current session
   - `gateway` → `[ACTIVE]` if running as gateway
4. Brand discipline: badges use the existing `<Badge>` primitive with `size="sm"` (extend Badge with `size` if needed; current Badge has fixed `text-[11px]`).

**Success criteria:**
- Stopping the daemon turns the sidebar block muted within 200ms.
- Discovering a peer makes `[1 nearby]` appear next to "peers" without page refresh.
- Sidebar nav-row keyboard nav (↑/↓ arrows) still works unchanged.

---

# Phase 5 — Dashboard composition

**Goal:** Re-balance the Dashboard so Identity is unmistakably the hero, RouteToggle is the primary action, and metrics are the periphery.

**Files:**
- Modify: `src/screens/dashboard.tsx`
- Modify: `src/components/identity/identity-panel.tsx`
- Modify: `src/components/routing/route-toggle-panel.tsx`
- Modify: `src/components/peers/peer-list-panel.tsx`
- Modify: `src/components/brand/daemon-toggle.tsx`

**Key tasks:**

1. Re-order Dashboard panel stack:
   ```
   Identity (hero, density="spacious")
   RouteToggle (primary action — emphasise via 2px primary left border instead of standard border)
   PeerList (compact rows, see Phase 6)
   Nearby (only when non-empty)
   Metrics (density="compact", at the bottom)
   ```
2. Move DaemonToggle out of the dashboard header into IdentityPanel itself — bottom-right action of the identity hero. The current header strip with `ScreenRefresh` left + `DaemonToggle` right competes for attention with IdentityPanel.
3. Make `ScreenRefresh` smaller (`size="sm"` already, but reduce visual weight further with `variant="ghost"` and lower-case `[ refresh ]` glyph). Or move it to a keyboard-only ⌘R action and remove the visible button entirely on Dashboard (still accessible on Logs/Gateway/Routing where data isn't streamed).
4. RouteTogglePanel emphasis: when state is `[ON]`, give the panel a 2px left border in primary (matches the kill-switch banner emphasis pattern). Visually outranks neighbouring panels.
5. Spacing rhythm — vary gap between panels: tighten Identity ↔ RouteToggle (`gap-3`), generous separation before PeerList (`gap-8`), generous before Metrics (`gap-8`), tight inside ActionRow children. Pass through `<ScreenContainer>` density or accept a `gap` override.

**Success criteria:**
- Squint test: Identity reads as 1st, RouteToggle as 2nd, Peers as 3rd, Metrics as 5th by visual weight alone.
- DaemonToggle no longer floats in a header strip — it lives inside IdentityPanel.
- Visual hierarchy is testable: a Playwright screenshot snapshot at 1280×800 matches a fixture frame.

---

# Phase 6 — Peer flow polish

**Goal:** Lift peer rows to ≥44px touch targets, add hover progressive disclosure, and route the `show why →` affordance with proper log filter pre-application.

**Files:**
- Modify: `src/components/peers/peer-row.tsx`
- Modify: `src/components/peers/nearby-row.tsx`
- Modify: `src/components/peers/peer-list-panel.tsx` (column header padding)
- Modify: `src/components/peers/peers-panel.tsx`
- Modify: `src/components/identity/identity-panel.tsx` (show-why link)
- Modify: `src/hooks/use-log-filters.ts` (or add a setter that pre-applies a source filter)
- Modify: `src/screens/logs.tsx` (consume pre-applied filter on mount)

**Key tasks:**

1. Peer row padding: `px-4 py-1` → `px-4 py-3` (≈44px target row). Adjust grid `items-center gap-x-2` to keep alignment.
2. Hover progressive disclosure: on row hover, reveal a secondary line below the primary row showing transport detail (e.g., `tcp://10.77.0.1:7747 · last handshake 12s ago`). Use `grid-template-rows` collapsed-to-expanded transition (per brand motion rule for height changes).
3. Pre-applied log filter: extend `useLogFilters` with a `setSource(source)` action and a one-shot `pendingFilter` URL-state-like atom. IdentityPanel `show why →` calls `setActive("logs")` AND `setPendingFilter({ source: "transport" })`. LogsScreen drains `pendingFilter` once on mount.
4. NearbyRow gets the same touch target lift + hover disclosure.

**Success criteria:**
- Tab through Peer rows — focus ring visible, ≥44px hit area.
- Click a failed peer → land on Logs with `source: transport` already filtered. Mira's request from `docs/UX-PLAN.md §Flow 6` is now met.
- Manual on small viewport (1024×600) — no horizontal scroll on Peers screen.

---

# Phase 7 — Settings density

**Goal:** Make 13 collapsible sections discoverable. Add a section search and refine summary lines.

**Files:**
- Create: `src/components/settings/settings-search.tsx`
- Modify: `src/screens/settings.tsx`
- Modify: every `src/components/settings/sections/*.tsx` (summary refinement only)

**Key tasks:**

1. `<SettingsSearch />`: prompt-style input (`> filter sections…`) at top of Settings page. Filters by section title OR by tomlKey synonyms (each section already declares `tomlKeys` in `src/lib/config/section-schemas.ts`). Live-filter as the user types — non-matching sections collapse + dim, matching sections expand.
2. Summary refinement: every section's collapsed summary should answer "what's set?" in ≤8 monospace tokens. Audit each — IdentitySection currently shows `{name} · {short_id}` ✓; DiscoverySection should show `udp on · ble off · wfd off` not "discovery: enabled". Update each section's summary builder.
3. ⌘F binding — focuses the search input when on Settings. Adds to the AppShell keyboard handler with the existing meta-key gate.
4. Optional: add a "what's recently changed" indicator — sections with `dirty === true` get a `[UNSAVED]` muted badge in the summary right-align.

**Success criteria:**
- Type "ble" in the search — only Bluetooth section remains visible.
- Every section summary ≤8 tokens, scannable in one glance.
- Discard-on-tab-away still works (existing dirty-section gate unchanged).

---

# Phase 8 — Power-user discoverability

**Goal:** Surface ⌘K (command palette) and the keyboard cheat sheet without violating P2 ("never label a section Advanced") or polluting Layer 1.

**Files:**
- Modify: `src/components/shell/sidebar.tsx` (footer hint)
- Modify: `src/components/settings/sections/about-section.tsx` (keyboard shortcuts list)
- Create: `src/components/shell/cmd-k-hint.tsx`

**Key tasks:**

1. `<CmdKHint />` — small footer in sidebar: `⌘K · search anything`. Static, low-weight. Only renders if user hasn't dismissed it (localStorage flag `pim-ui.hints.cmdk-seen`).
2. About section gains a `keyboard shortcuts` subsection listing every ⌘N binding from `app-shell.tsx`. Source from a single `KEYBOARD_SHORTCUTS` constant in `src/lib/copy.ts` so the help can't drift from the bindings.
3. Optional: first-time tooltip on the sidebar wordmark on initial Dashboard load (after onboarding flag set), pointing to `⌘K`. Auto-dismiss after 5s or on first ⌘K press.

**Success criteria:**
- A returning user who never opened Settings can still discover ⌘K via the sidebar footer.
- The keyboard shortcut help in About is sourced from one constant, not duplicated.
- Hint dismissal persists across reloads (localStorage flag honored).

---

# Phase 9 — A11y & responsive pass

**Goal:** Final sweep. Fix the `text-muted-foreground`-on-body misuse, audit contrast on every component, add container queries for fluid panels, and harden touch targets globally.

**Files:**
- Modify: every component that uses `text-muted-foreground` for body-size text (≈196 locations — scope precisely with grep)
- Modify: `src/globals.css` (add `--color-text-secondary` token AA-compliant at body size)
- Modify: `src/components/brand/cli-panel.tsx` (add `@container` query for narrow viewports)
- Add: Playwright a11y assertions if the project doesn't have them yet

**Key tasks:**

1. Add a `--color-text-secondary` token (≈`#9aa09c` — verify AA on `--color-card`). Reserve `--color-muted-foreground` for AA-large only per STYLE.md — actually enforce the spec.
2. Replace `text-muted-foreground` with `text-text-secondary` for body-text usage (separators, label text in metrics, hops/latency on peer rows). Keep `text-muted-foreground` for column headers, tracking-widest labels, glyph-only tokens.
3. Contrast verification: pin `axe-core` checks to a Playwright run — `pnpm test:a11y` opens every screen and reports violations. Block PR on any violation.
4. Container queries: CliPanel becomes a `@container` so child panels (peer-list with 8-column grid) can collapse to a stacked layout below ≈48ch container width. Required for Phase 5 mobile work and current 1024×600 desktop windows.
5. Final touch-target audit — every clickable element ≥44×44 (peer rows ✓ from Phase 6, action rows, copy buttons, sheet close buttons, tooltip triggers).

**Success criteria:**
- Audit Health Score recomputed: A11y 4/4, Responsive 3/4, others preserved at 4/4.
- `pnpm test:a11y` (new script) reports zero violations across all screens.
- No body-text element uses `text-muted-foreground`.
- Resizing the Tauri window from 1280→768→480 produces a fluid layout with no horizontal scroll, no clipped panels.

---

## Self-review (frozen 2026-04-28)

**Spec coverage:** Every audit P0/P1/P2/P3 item maps to a phase:
- P1.1 (flat hierarchy) → Phase 5
- P1.2 (CliPanel half-box) → Phase 1 Task 1.4 + Phase 2
- P1.3 (motion vocabulary) → Phase 2
- P1.4 (joyless empty states) → Phase 3
- P1.5 (inert sidebar) → Phase 4
- P1.6 (banner stacking) → Phase 1 Task 1.3
- P1.7 (Welcome dual-primary) → Phase 5 (DaemonToggle relocation requires updating Welcome variant pattern)
- P1.8 (touch targets) → Phase 6 + Phase 9
- P1.9 (max-w drift) → Phase 1 Task 1.1–1.2
- P2.10 (loading text) → Phase 3
- P2.11 (no Settings search) → Phase 7
- P2.12 (DaemonToggle vs ScreenRefresh) → Phase 5
- P2.13 (show why → no filter) → Phase 6
- P2.14 (no peer hover preview) → Phase 6
- P2.15 (⌘K invisible) → Phase 8
- P3.16 (status indicator color-only) → Phase 2 (motion glyph) + Phase 9 (contrast)
- P3.17 (uppercase inconsistency) → Phase 1 Task 1.4 follow-up; trivial
- P3.18 (scrollbar) → Phase 9 polish

**Placeholder scan:** No "TBD", no "implement later", no "similar to Task N" without code. Phases 2–9 list scoped tasks rather than checkbox steps — they are intentionally not yet bite-sized. Each phase will be expanded to Phase-1-style detail when picked up. This trade-off is documented in the header.

**Type consistency:** Component names referenced across phases match: `ScreenContainer`, `BannerStack`, `ScanLoader`, `TeachingEmptyState`, `SidebarWordmark`, `SidebarRowBadge`, `SettingsSearch`, `CmdKHint`. No drift.

---

## Rollout & verification per phase

- Each phase commits a single PR.
- Manual visual verification: `pnpm tauri dev` and walk every flow — first-run, welcome, dashboard, peers, routing, gateway, logs, settings, peer-detail sheet, command palette.
- Unit tests: `pnpm test` must pass. Locked-copy audit (`pnpm audit:copy`) must pass.
- Re-run /audit after Phase 9 — target Audit Health Score ≥18/20.

---

*Living document. Update phase tasks with concrete checkboxes as each phase is picked up.*
