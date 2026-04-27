/**
 * <TBDRouteToggle /> — TBD-PHASE-4-A placeholder.
 *
 * 05-CONTEXT D-19 row 3: Phase 4 ROUTE-01 replaces this with the real
 * <RouteInternetToggle /> wired to route.set_split_default. Until then,
 * we render a visible bracketed button labeled "(phase 4)" so users
 * see the affordance reserved + the click is a no-op.
 *
 * Brand discipline: rounded-none (inherits from button base reset),
 * monospace, no shadows, no gradients, no hex literals.
 */

import { cn } from "@/lib/utils";

export function TBDRouteToggle() {
  return (
    <button
      type="button"
      aria-disabled="true"
      tabIndex={-1}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2",
        "border border-border bg-transparent text-muted-foreground",
        "font-mono text-xs uppercase tracking-wider",
        "cursor-not-allowed",
      )}
    >
      <span>[ Route internet via mesh ]</span>
      <span className="text-xs">(phase 4)</span>
    </button>
  );
}
