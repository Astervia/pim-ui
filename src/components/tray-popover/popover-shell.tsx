/**
 * <PopoverShell /> — popover layout per 05-CONTEXT D-19.
 *
 * Top-down structure:
 *   PopoverHeader             (status dot + node + mesh IP)
 *   ├── separator
 *   <TBDRouteToggle />        (TBD-PHASE-4-A — Phase 4 swaps in real toggle)
 *   useRouteStatusLine() text (TBD-PHASE-4-B — egress fallback today)
 *   ├── separator
 *   PopoverActions            (Add peer nearby, Open pim, Quit pim)
 */

import { PopoverHeader } from "./popover-header";
import { TBDRouteToggle } from "./tbd-route-toggle";
import { useRouteStatusLine } from "./use-route-status-line";
import { PopoverActions } from "./popover-actions";

function Separator() {
  return (
    <div
      aria-hidden="true"
      className="px-3 text-muted-foreground select-none font-mono text-xs"
    >
      ├──
    </div>
  );
}

export function PopoverShell() {
  const routeStatus = useRouteStatusLine();
  return (
    <section
      className="flex flex-col bg-popover text-foreground border border-border h-full"
      aria-label="pim tray popover"
    >
      <PopoverHeader />
      <Separator />
      <div className="flex flex-col gap-1 px-3 py-2">
        <TBDRouteToggle />
        <p className="font-code text-xs text-muted-foreground">{routeStatus}</p>
      </div>
      <Separator />
      <PopoverActions />
    </section>
  );
}
