/**
 * ScreenRefresh — terminal-style `[ refresh ]` button rendered above
 * a screen's panel stack. Calls `onRefresh` on click and dims itself
 * via `aria-busy`/`aria-disabled` while a refetch is in flight.
 *
 * Each screen wires its own refetch composition (e.g. Dashboard reseeds
 * the daemon snapshot; Routing also refetches the route table). The
 * component itself is purely presentational.
 *
 * Brand: matches the existing `[ refresh ]` button on RouteTablePanel
 * (`ROUTE_TABLE_REFRESH` from copy.ts) so visual treatment is uniform
 * across screens.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScreenRefreshProps {
  /** Async refetch invoked on click. The button renders busy until it resolves. */
  onRefresh: () => Promise<void> | void;
  /** Optional aria-label override. Defaults to "refresh this screen". */
  ariaLabel?: string;
  /** Optional className for the wrapper (alignment / spacing tweaks). */
  className?: string;
}

export function ScreenRefresh({
  onRefresh,
  ariaLabel = "refresh this screen",
  className,
}: ScreenRefreshProps) {
  const [busy, setBusy] = useState<boolean>(false);

  const handleClick = async () => {
    if (busy === true) return;
    setBusy(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex justify-end", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void handleClick();
        }}
        aria-disabled={busy === true ? true : undefined}
        aria-busy={busy === true ? true : undefined}
        aria-label={ariaLabel}
      >
        {busy === true ? "[ refreshing… ]" : "[ refresh ]"}
      </Button>
    </div>
  );
}
