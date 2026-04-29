/**
 * <TopologyDiagram /> — single-line ASCII path showing how this node
 * reaches its egress (or remains local).
 *
 * Output examples:
 *   you ─→ relay-b ─→ gateway-c ─→ internet     (split-default routing)
 *   you ─→ gateway-c ─→ internet                (direct gateway hop)
 *   you · local                                  (no routing, no gateway)
 *
 * The diagram is rendered as a flex row of monospace tokens so the
 * arrow glyphs stay aligned with the labels regardless of label width.
 * Each hop label uses the short_id when available, falling back to the
 * peer label, and finally the bare node_id. The terminal "internet"
 * token is signal-green when routing is on, muted-foreground otherwise.
 *
 * This component is purely presentational — the parent passes the
 * resolved route. No daemon state is read directly here.
 */

import { cn } from "@/lib/utils";

export interface TopologyHop {
  /** Display label for the hop (short_id, name, or fallback). */
  label: string;
  /** Optional latency in milliseconds, rendered under the arrow. */
  latencyMs?: number | null;
}

export interface TopologyDiagramProps {
  /** Ordered hops between `you` and `internet`. May be empty for solo. */
  hops: readonly TopologyHop[];
  /** True when split-default routing is on AND a gateway is selected. */
  routing: boolean;
  className?: string;
}

const ARROW = "─→";

export function TopologyDiagram({
  hops,
  routing,
  className,
}: TopologyDiagramProps) {
  // Solo / no-gateway path: render a single muted line so the diagram
  // never collapses to nothing — the user always sees their own state.
  if (routing === false || hops.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 font-code text-sm",
          className,
        )}
        aria-label="topology"
      >
        <span className="text-primary">you</span>
        <span className="text-text-secondary">·</span>
        <span className="text-text-secondary">local</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 font-code text-sm",
        className,
      )}
      aria-label="topology"
    >
      <span className="text-primary phosphor">you</span>
      {hops.map((hop, i) => (
        <Arrow key={`${i}-${hop.label}`} latencyMs={hop.latencyMs}>
          <span
            className={
              i === hops.length - 1
                ? "text-foreground"
                : "text-text-secondary"
            }
          >
            {hop.label}
          </span>
        </Arrow>
      ))}
      <Arrow>
        <span className="text-primary uppercase tracking-wider">internet</span>
      </Arrow>
    </div>
  );
}

interface ArrowProps {
  children: React.ReactNode;
  latencyMs?: number | null;
}

function Arrow({ children, latencyMs }: ArrowProps) {
  const hasLatency =
    latencyMs === null || latencyMs === undefined ? false : true;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-text-secondary">{ARROW}</span>
        {children}
      </div>
      {hasLatency === true ? (
        <span className="font-code text-[10px] text-text-secondary leading-none">
          {latencyMs}ms
        </span>
      ) : null}
    </div>
  );
}
