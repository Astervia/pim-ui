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

import type { KeyboardEvent, ReactNode } from "react";
import { useActiveScreen, type ActiveScreenId } from "@/hooks/use-active-screen";
// Plan 03-04 §Part H.3 (checker Blocker 1) — D-13 nav-away interception:
// Sidebar clicks route through `requestActive` so dirty Settings sections
// open the discard dialog before the tab change lands.
import { requestActive } from "@/hooks/use-gated-navigation";
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
const NAV: readonly ActiveRow[] = [
  { id: "dashboard", label: "dashboard", shortcut: "⌘1" },
  { id: "peers", label: "peers", shortcut: "⌘2" },
  { id: "routing", label: "routing", shortcut: "⌘3" },
  { id: "gateway", label: "gateway", shortcut: "⌘4" },
  { id: "logs", label: "logs", shortcut: "⌘5" },
  { id: "settings", label: "settings", shortcut: "⌘6" },
];

export function Sidebar() {
  const { active, setActive } = useActiveScreen();
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
  // `logs` is intentionally omitted — Phase 8 owns the error-backlog
  // counter; adding a stub here would lock in semantics the later phase
  // hasn't yet committed to.
  const rowBadge: Partial<Record<ActiveScreenId, ReactNode>> = {
    peers: peersBadge,
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
    <nav
      aria-label="main"
      // Sidebar pins to viewport: parent shell is now `h-screen
      // overflow-hidden`, so this `h-screen` sibling stays put while
      // <main> scrolls. Internal `overflow-y-auto` handles the (rare)
      // case where the sidebar itself overflows on very short windows.
      className="w-60 h-screen overflow-y-auto bg-card border-r border-border font-mono flex flex-col shrink-0"
    >
      {/* Phase 4 P1.5 — wordmark is now a live status surface. The block
          glyph re-tints with daemon.state (running → primary phosphor,
          starting/reconnecting → accent phosphor-pulse, error → destructive,
          stopped → muted). Implementation owns the rhythm + tokens; this
          file just mounts it. */}
      <SidebarWordmark />

      {/* Full-width box-drawing rule — endcaps removed per user feedback;
          a clean `─` run reads quieter and lets the wordmark above breathe
          without a visual frame trapping it. */}
      <div
        aria-hidden="true"
        className="px-5 pb-3 text-muted-foreground select-none font-mono text-xs leading-none tracking-tight"
      >
        ──────────────────
      </div>

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

      {/* Phase 8 — ⌘K discoverability hint. Self-hides via localStorage
          once dismissed or once the user has pressed ⌘K at least once.
          `mt-auto` inside this flex-col nav pushes the hint to the
          sidebar's bottom edge, leaving the rest of the chrome above. */}
      <CmdKHint />
    </nav>
  );
}
