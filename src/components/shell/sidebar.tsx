/**
 * <Sidebar /> — shell navigation (Phase 2 D-01/D-02 + Phase 3 03-01 D-01
 * + Phase 4 04-03 D-16 + Phase 5 05-01 D-01).
 *
 * 240px fixed-width <nav> with the pim wordmark at the top, six active
 * nav rows (dashboard / peers / routing / gateway / logs / settings), a
 * box-drawing separator, and zero reserved rows after Phase 5 lights up
 * the last grayed-out gateway row.
 *
 * Phase 3 (Plan 03-01) flipped settings from grayed-reserved to active.
 * Phase 4 (Plan 04-03) flipped routing to active (⌘3).
 * Phase 5 (Plan 05-01 D-01) flips gateway to active (⌘4) — every former
 * reserved row is now navigable.
 *
 * Copy is VERBATIM from 02-UI-SPEC.md §Copywriting Contract §Shell chrome
 * + 03-UI-SPEC.md §Shell chrome (Sidebar row Phase 3 flips live):
 *   app wordmark: "█ pim"  (U+2588 block, ASCII space, lowercase "pim")
 *   active row:   "▶ {label}" + "⌘N" hint right-aligned
 *   inactive row: "> {label}"
 *   separator:    "├──"
 *
 * Brand guards (enforced by grep in the PLAN acceptance checks):
 *   - NO border-radius classes anywhere (brand radius = 0)
 *   - NO literal palette colors (text-green-*, text-red-*) — tokens only
 *   - NO gradients
 *   - NO exclamation marks in any user-visible string
 *
 * Accessibility (02-UI-SPEC §ARIA & semantic roles):
 *   - <nav aria-label="main">
 *   - active row has aria-current="page"
 */

import { useEffect, type KeyboardEvent, type ReactNode } from "react";
import { useActiveScreen, type ActiveScreenId } from "@/hooks/use-active-screen";
// Plan 03-04 §Part H.3 (checker Blocker 1) — D-13 nav-away interception:
// Sidebar clicks route through `requestActive` so dirty Settings sections
// open the discard dialog before the tab change lands.
import { requestActive } from "@/hooks/use-gated-navigation";
// Simple ↔ advanced mode: the footer button in the sidebar flips the
// global atom. AppRoot remounts the shell when the atom changes.
import { useAppMode } from "@/hooks/use-app-mode";
import { cn } from "@/lib/utils";
// Phase 4 P1.5 — sidebar becomes a live status surface.
import { SidebarWordmark } from "@/components/shell/sidebar-wordmark";
import { SidebarRowBadge } from "@/components/shell/sidebar-row-badge";
// Phase 8 — discoverability footer hint mounts at the sidebar's bottom
// edge via mt-auto inside the existing flex column.
import { CmdKHint } from "@/components/shell/cmd-k-hint";
import {
  useFailedPeerCount,
  useGatewayActive,
  useNearbyCount,
} from "@/hooks/use-sidebar-counts";
import { useSidebarOpen } from "@/hooks/use-sidebar-open";

interface ActiveRow {
  readonly id: ActiveScreenId;
  readonly label: string;
  readonly shortcut: string;
}

// Phase 3 Plan 03-01 (D-01): "settings" appended to NAV with ⌘6 hint.
// Phase 4 Plan 04-03 (D-16): "routing" promoted to NAV with ⌘3 hint.
// Phase 5 Plan 05-01 (D-01): "gateway" promoted to NAV with ⌘4 hint,
// inserted between routing (⌘3) and logs (⌘5) so the cluster still
// reads in numerical-shortcut order. RESERVED is now empty — the
// reserved-row type + array were dropped together when the last
// reserved entry shipped.
// Peers tab removed — peer management is consolidated into the
// Dashboard's PeerListPanel (with `[ + add peer ]` and `[ Invite peer ]`
// actions inline). ⌘2 binding stays unused so existing muscle memory
// doesn't trip into a stale screen.
const NAV: readonly ActiveRow[] = [
  { id: "dashboard", label: "dashboard", shortcut: "⌘1" },
  { id: "messages", label: "messages", shortcut: "⌘2" },
  { id: "routing", label: "routing", shortcut: "⌘3" },
  { id: "gateway", label: "gateway", shortcut: "⌘4" },
  { id: "logs", label: "logs", shortcut: "⌘5" },
  { id: "settings", label: "settings", shortcut: "⌘6" },
  { id: "about", label: "about", shortcut: "⌘7" },
];

export function Sidebar() {
  const { active, setActive } = useActiveScreen();
  const { open: drawerOpen, close: closeDrawer } = useSidebarOpen();
  const { setMode } = useAppMode();

  // Auto-close the mobile drawer whenever the active route changes.
  // On md+ viewports the drawer is always-visible (the close is a
  // no-op there because the open flag is mobile-only chrome).
  useEffect(() => {
    if (drawerOpen === true) closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Esc closes the drawer on mobile.
  useEffect(() => {
    if (drawerOpen === false) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handler as never);
    return () => window.removeEventListener("keydown", handler as never);
  }, [drawerOpen, closeDrawer]);
  // Phase 4 P1.5 — derive optional row-badge content from existing
  // daemon-state selectors. Each hook is a thin reducer over the snapshot;
  // no new RPC and no new Tauri listener. Failure outranks nearby on the
  // peers row, so we resolve the badge here rather than per render branch.
  const nearbyCount = useNearbyCount();
  const failedPeerCount = useFailedPeerCount();
  const gatewayActive = useGatewayActive();

  const peersBadge: ReactNode = (() => {
    if (failedPeerCount > 0) {
      return <SidebarRowBadge tone="warn">{`${failedPeerCount} err`}</SidebarRowBadge>;
    }
    if (nearbyCount > 0) {
      return (
        <SidebarRowBadge tone="info">{`${nearbyCount} nearby`}</SidebarRowBadge>
      );
    }
    return null;
  })();

  const gatewayBadge: ReactNode =
    gatewayActive === true ? (
      <SidebarRowBadge tone="on">active</SidebarRowBadge>
    ) : null;

  // Map nav-row id → optional badge. Missing entries render no badge.
  // The peers tab is gone (peer management lives on the Dashboard now)
  // so the failed/nearby badges that used to live on the peers row
  // surface on the Dashboard row instead — same signal, fewer clicks.
  const rowBadge: Partial<Record<ActiveScreenId, ReactNode>> = {
    dashboard: peersBadge,
    gateway: gatewayBadge,
  };

  function onRowKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    id: ActiveScreenId,
  ) {
    // Native <button> already handles Enter + Space; we only intercept
    // Arrow keys so keyboard users can walk the nav list without Tab.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const index = NAV.findIndex((r) => r.id === id);
      const next = NAV[(index + delta + NAV.length) % NAV.length];
      // D-13: gate keyboard nav through requestActive so dirty Settings
      // sections open the discard dialog before the tab change.
      if (next) requestActive(next.id, setActive);
    }
  }

  return (
    <>
      {/* Mobile backdrop — only visible when the drawer is open AND
          the viewport is below the md breakpoint. Tapping the backdrop
          dismisses the drawer. */}
      {drawerOpen === true ? (
        <button
          type="button"
          aria-label="close navigation"
          onClick={closeDrawer}
          className="md:hidden fixed inset-0 z-40 bg-background/80 transition-opacity duration-100 ease-linear"
        />
      ) : null}
      <nav
        aria-label="main"
        // Layout strategy:
        //   - md+ (≥768px): sidebar is a static flex sibling 240px wide.
        //   - mobile: sidebar is a fixed left-edge drawer that slides in
        //     when `drawerOpen === true`. Translates fully off-screen
        //     when closed so it doesn't intercept pointer events.
        // Internal scroll is preserved so very tall NAV groups still
        // scroll inside the sidebar rather than the whole window.
        className={cn(
          "w-60 h-screen overflow-y-auto bg-card border-r border-border font-mono flex flex-col shrink-0",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-150 ease-out",
          drawerOpen === true ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0 md:transition-none",
        )}
      >
      {/* Phase 4 P1.5 — wordmark is now a live status surface. The block
          glyph re-tints with daemon.state (running → primary phosphor,
          starting/reconnecting → accent phosphor-pulse, error → destructive,
          stopped → muted). Implementation owns the rhythm + tokens; this
          file just mounts it. */}
      <SidebarWordmark />

      {/* Plain CSS border instead of a `─` glyph run — at small sizes
          the box-drawing character's end-caps in Geist Mono render as
          standalone dots flanking the line, which read as visual noise.
          A 1px border-t in the brand `border` token is the same visual
          weight without font-rendering artefacts. */}
      <div
        aria-hidden="true"
        className="mx-5 mb-3 border-t border-border"
      />

      {/* Active nav list — six rows, each a real <button>. */}
      <ul role="list" className="flex flex-col mt-2 px-1">
        {NAV.map((row) => {
          const isActive = active === row.id;
          const badge = rowBadge[row.id] ?? null;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => requestActive(row.id, setActive)}
                onKeyDown={(e) => onRowKeyDown(e, row.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-4 py-3",
                  "font-mono text-xs uppercase tracking-widest",
                  "border-l-2 border-transparent",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]",
                  "transition-colors duration-100 ease-linear",
                  isActive
                    ? "bg-popover text-primary border-l-primary"
                    : "text-foreground hover:text-primary hover:bg-popover/40 hover:border-l-border-active",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {/* Active rows lead with ▶ (U+25B6); inactive with >.
                      Exact copy per UI-SPEC §Sidebar nav row. */}
                  <span className="truncate">
                    {isActive ? "▶ " : "> "}
                    {row.label}
                  </span>
                  {/* Phase 4 P1.5 — optional live count/state badge. Sits
                      between the label and the keyboard hint so it never
                      collides with the right-aligned shortcut. */}
                  {badge}
                </span>
                <span className="text-muted-foreground">{row.shortcut}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Phase 5 Plan 05-01 (D-01): RESERVED group removed — gateway was the
          last reserved row; lighting it up empties the group, so the second
          separator + reserved <ul> are dropped together to keep the chrome
          clean (an empty separator would dangle below settings). If a future
          phase adds a new reserved entry, restore the separator + ul block. */}

      {/* "Simple mode" button — anchored above CmdKHint via mt-auto.
          Flips the useAppMode atom → AppRoot remounts SimpleShell.
          ⌘\ is the keyboard counterpart. Quiet style: no border, just
          small text + chevron, so it doesn't compete with tab nav. */}
      <button
        type="button"
        onClick={() => setMode("simple")}
        title={"switch to simple mode (⌘\\)"}
        className="mt-auto mx-3 mb-2 px-3 py-2 flex items-center justify-between gap-2 font-mono text-xs uppercase tracking-widest text-text-secondary hover:text-accent transition-colors duration-100 ease-linear focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]"
      >
        <span>← simple mode</span>
        <span className="text-muted-foreground">{"⌘\\"}</span>
      </button>

      {/* Phase 8 — ⌘K discoverability hint. Self-hides via localStorage
          once dismissed or once the user has pressed ⌘K at least once.
          `mt-auto` inside this flex-col nav pushes the hint to the
          sidebar's bottom edge, leaving the rest of the chrome above. */}
      <CmdKHint />
      </nav>
    </>
  );
}
