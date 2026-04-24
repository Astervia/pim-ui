/**
 * <Sidebar /> — Phase-2 shell navigation (D-01, D-02).
 *
 * 240px fixed-width <nav> with the pim wordmark at the top, three active
 * nav rows (dashboard / peers / logs), a box-drawing separator, and three
 * grayed-out reserved rows (routing / gateway / settings) that will light
 * up in phases 4 / 5 / 3 respectively.
 *
 * Copy is VERBATIM from 02-UI-SPEC.md §Copywriting Contract §Shell chrome:
 *   app wordmark: "█ pim"  (U+2588 block, ASCII space, lowercase "pim")
 *   active row:   "▶ {label}" + "⌘N" hint right-aligned
 *   inactive row: "> {label}"
 *   reserved row: "{label}" + "(phase N)" hint
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
 *   - reserved rows use aria-disabled="true" + tabIndex={-1} — a <div>,
 *     not a <button>, so they are neither clickable nor in the tab order
 */

import type { KeyboardEvent } from "react";
import { useActiveScreen, type ActiveScreenId } from "@/hooks/use-active-screen";
import { cn } from "@/lib/utils";

interface ActiveRow {
  readonly id: ActiveScreenId;
  readonly label: string;
  readonly shortcut: string;
}

interface ReservedRow {
  // Reserved rows live OUTSIDE the ActiveScreenId union — they are not
  // navigable in Phase 2. Typed as string literals so the reserved-list
  // copy is checked at compile time.
  readonly id: "routing" | "gateway" | "settings";
  readonly label: string;
  readonly reservedFor: string;
}

const NAV: readonly ActiveRow[] = [
  { id: "dashboard", label: "dashboard", shortcut: "⌘1" },
  { id: "peers", label: "peers", shortcut: "⌘2" },
  { id: "logs", label: "logs", shortcut: "⌘5" },
];

// Phase-hint copy per 02-UI-SPEC §Shell chrome §Sidebar reserved rows:
//   routing  → (phase 4)  — ROUTE-* lives in Phase 4
//   gateway  → (phase 5)  — GATE-* lives in Phase 5
//   settings → (phase 3)  — CONF-* lives in Phase 3
// The ORDER below matches the UI-SPEC §S1 ASCII (routing, gateway, settings).
const RESERVED: readonly ReservedRow[] = [
  { id: "routing", label: "routing", reservedFor: "(phase 4)" },
  { id: "gateway", label: "gateway", reservedFor: "(phase 5)" },
  { id: "settings", label: "settings", reservedFor: "(phase 3)" },
];

export function Sidebar() {
  const { active, setActive } = useActiveScreen();

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
      if (next) setActive(next.id);
    }
  }

  return (
    <nav
      aria-label="main"
      className="w-60 bg-card border-r border-border font-mono flex flex-col shrink-0"
    >
      {/* Wordmark — the block glyph U+2588 gets the phosphor glow;
          the "pim" wordmark is also phosphor per UI-SPEC §Shell chrome. */}
      <div className="px-4 py-6 font-mono text-xl tracking-tight leading-[1.4]">
        <span className="phosphor">█ pim</span>
      </div>

      {/* First box-drawing separator — above the active nav group. */}
      <div
        aria-hidden="true"
        className="px-4 text-muted-foreground select-none"
      >
        ├──
      </div>

      {/* Active nav list — three rows, each a real <button>. */}
      <ul role="list" className="flex flex-col mt-2">
        {NAV.map((row) => {
          const isActive = active === row.id;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setActive(row.id)}
                onKeyDown={(e) => onRowKeyDown(e, row.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3",
                  "font-mono text-xs uppercase tracking-widest",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]",
                  isActive
                    ? "bg-popover text-primary"
                    : "text-foreground hover:text-primary hover:bg-popover/40",
                )}
              >
                <span>
                  {/* Active rows lead with ▶ (U+25B6); inactive with >.
                      Exact copy per UI-SPEC §Sidebar nav row. */}
                  {isActive ? "▶ " : "> "}
                  {row.label}
                </span>
                <span className="text-muted-foreground">{row.shortcut}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Second box-drawing separator — between active + reserved groups. */}
      <div
        aria-hidden="true"
        className="px-4 mt-2 text-muted-foreground select-none"
      >
        ├──
      </div>

      {/* Reserved rows — NOT buttons, NOT focusable, NOT clickable.
          aria-disabled + tabIndex={-1} + cursor-not-allowed + muted color
          carries the "reserved for a future phase" meaning at all three
          layers: a11y / keyboard / cursor / visual. */}
      <ul role="list" className="flex flex-col mt-2">
        {RESERVED.map((row) => (
          <li key={row.id}>
            <div
              aria-disabled="true"
              tabIndex={-1}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3",
                "font-mono text-xs uppercase tracking-widest",
                "text-muted-foreground/60 cursor-not-allowed",
              )}
            >
              <span>{row.label}</span>
              <span className="text-xs">{row.reservedFor}</span>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}
