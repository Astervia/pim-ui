/**
 * <StatusIndicator /> — Unicode status glyph.
 *
 * Unicode-first over icon components (see .design/branding/pim/identity/imagery-style.md).
 * ◆ active    (U+25C6)  signal green, phosphor glow
 * ◈ relayed   (U+25C8)  amber
 * ○ connecting(U+25CB)  text secondary
 * ✗ failed    (U+2717)  destructive red
 */

import { cn } from "@/lib/utils";
// Plan 01-01: PeerState lives in the hand-maintained docs/RPC.md mirror
// (`rpc-types.ts`); `rpc.ts` no longer re-exports it.
import type { PeerState } from "@/lib/rpc-types";

const indicators: Record<
  PeerState,
  { char: string; className: string; label: string }
> = {
  active: {
    char: "◆",
    className: "text-primary phosphor",
    label: "active",
  },
  relayed: {
    char: "◈",
    className: "text-accent",
    label: "relayed",
  },
  connecting: {
    char: "○",
    className: "text-muted-foreground",
    label: "connecting",
  },
  failed: {
    char: "✗",
    className: "text-destructive",
    label: "failed",
  },
};

export interface StatusIndicatorProps {
  state: PeerState;
  className?: string;
}

export function StatusIndicator({ state, className }: StatusIndicatorProps) {
  const ind = indicators[state];
  return (
    <span
      role="img"
      aria-label={ind.label}
      className={cn("font-mono", ind.className, className)}
    >
      {ind.char}
    </span>
  );
}
