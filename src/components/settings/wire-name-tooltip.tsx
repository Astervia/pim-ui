/**
 * <WireNameTooltip /> — `ⓘ` trigger that reveals the daemon TOML wire
 * name AND a human description on hover/focus.
 *
 * Post-redesign: the tooltip used to surface only the wire name. That
 * left users guessing what each setting actually did. The tooltip now
 * pulls a description from `src/lib/config/wire-docs.ts` (single
 * source of truth) and renders:
 *
 *   ┌──────────────────────────────────┐
 *   │ Find peers on the local network  │   ← description (prose)
 *   │ via UDP broadcasts. Limited to   │
 *   │ one broadcast domain.            │
 *   │ ─────────────                    │   ← rule
 *   │ discovery.enabled                │   ← wire name (code)
 *   │ default: true                    │   ← optional default
 *   └──────────────────────────────────┘
 *
 * Undocumented wire names render as before (just the wire name in
 * code) so the change is purely additive — every section's existing
 * <WireNameTooltip wireName="…" /> usage automatically gains a
 * description as soon as the wire-docs map covers it.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getWireDoc } from "@/lib/config/wire-docs";
import { cn } from "@/lib/utils";

export interface WireNameTooltipProps {
  /** Verbatim daemon TOML path, e.g. "transport.listen_port". */
  wireName: string;
}

export function WireNameTooltip({ wireName }: WireNameTooltipProps) {
  const doc = getWireDoc(wireName);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={`help: ${wireName}`}
        className="font-mono text-text-secondary hover:text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors duration-100 ease-linear"
      >
        ⓘ
      </TooltipTrigger>
      <TooltipContent
        className={cn(
          "max-w-[320px] flex flex-col gap-2 p-3",
          // Override the parent text-xs default so prose reads at a
          // comfortable size; the wire-name footer drops back to xs.
          "font-code text-[13px] text-foreground leading-[1.5]",
        )}
      >
        {doc === null ? (
          <code className="font-mono text-xs text-foreground">{wireName}</code>
        ) : (
          <>
            <p className="text-foreground">{doc.description}</p>
            <div className="border-t border-border pt-2 flex flex-col gap-1">
              <code className="font-mono text-[11px] text-primary">
                {wireName}
              </code>
              {doc.default !== undefined ? (
                <span className="font-mono text-[11px] text-text-secondary">
                  default: {doc.default}
                  {doc.unit !== undefined ? ` ${doc.unit}` : ""}
                </span>
              ) : doc.unit !== undefined ? (
                <span className="font-mono text-[11px] text-text-secondary">
                  unit: {doc.unit}
                </span>
              ) : null}
            </div>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
