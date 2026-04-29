/**
 * <PopoverHeader /> — status dot + node name + mesh IP rows per
 * 05-CONTEXT D-19 rows 1 and 2 + the mockup's separator.
 *
 * Reuses the Phase 2 <StatusIndicator /> primitive (no new icon work).
 * Pulls live data from the popover window's own useDaemonState (D-21
 * per-window listener — main window is unaffected).
 */

import { useStatus } from "@/hooks/use-status";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { StatusIndicator } from "@/components/brand/status-indicator";

export function PopoverHeader() {
  const status = useStatus();
  const { snapshot } = useDaemonState();

  const nodeName = status?.node ?? "—";
  const meshIp = status?.mesh_ip ?? "—";

  // Status dot semantics: running -> active, error -> failed, else
  // connecting. Phase 4 may refine to incorporate role + peer state
  // per D-19 row 1; for v1 the simple mapping is honest.
  const dotState =
    snapshot.state === "running"
      ? "active"
      : snapshot.state === "error"
        ? "failed"
        : "connecting";

  return (
    <header className="flex flex-col gap-1 px-3 pt-3 font-code text-sm">
      <div className="flex items-baseline gap-2">
        <StatusIndicator state={dotState} />
        <span className="text-foreground">{`pim · ${nodeName}`}</span>
      </div>
      <p className="text-text-secondary">{`mesh: ${meshIp}`}</p>
    </header>
  );
}
