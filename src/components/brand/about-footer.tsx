/**
 * <AboutFooter /> — two-row footer at the bottom of the main window.
 *
 * Row 1: peer-state legend (reused from current dashboard footer).
 * Row 2: pim-daemon version + rpc_version + feature flags, from rpc.hello.
 *
 * Spec: 01-UI-SPEC.md §Surface 5.
 *
 * Version token is signal green (--color-primary), rest muted-foreground.
 * Handshake-absent / version-mismatch variants render honestly.
 */

import { cn } from "@/lib/utils";
import { StatusIndicator } from "@/components/brand/status-indicator";
import type { HelloResult } from "@/lib/rpc-types";

const EXPECTED_RPC_VERSION = 1;

export interface AboutFooterProps {
  daemon: HelloResult | null;
  className?: string;
}

export function AboutFooter({ daemon, className }: AboutFooterProps) {
  return (
    <footer
      className={cn(
        "font-mono text-xs text-muted-foreground pt-6 border-t border-border space-y-2",
        className,
      )}
    >
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <span className="flex items-center gap-2">
          <StatusIndicator state="active" /> active
        </span>
        <span className="flex items-center gap-2">
          <StatusIndicator state="relayed" /> relayed
        </span>
        <span className="flex items-center gap-2">
          <StatusIndicator state="connecting" /> connecting
        </span>
        <span className="flex items-center gap-2">
          <StatusIndicator state="failed" /> failed
        </span>
      </div>
      <div className="lowercase tracking-widest">
        <VersionLine daemon={daemon} />
      </div>
    </footer>
  );
}

function VersionLine({ daemon }: { daemon: HelloResult | null }) {
  if (!daemon) {
    return (
      <span className="text-muted-foreground">pim-daemon · not connected</span>
    );
  }
  const mismatch = daemon.rpc_version !== EXPECTED_RPC_VERSION;
  if (mismatch) {
    return (
      <span className="text-destructive">
        {daemon.daemon} · rpc {daemon.rpc_version} — incompatible (expected rpc{" "}
        {EXPECTED_RPC_VERSION})
      </span>
    );
  }
  const features = daemon.features.join(", ");
  return (
    <span>
      <span className="text-primary font-semibold">{daemon.daemon}</span>
      <span className="text-muted-foreground">
        {" "}
        · rpc {daemon.rpc_version} · features: {features || "—"}
      </span>
    </span>
  );
}
