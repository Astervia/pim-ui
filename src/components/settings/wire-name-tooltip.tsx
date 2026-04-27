/**
 * <WireNameTooltip /> — `ⓘ` trigger that reveals the daemon TOML wire name
 * verbatim on hover/focus. Phase 3 Plan 03-04 §Part B.
 *
 * Spec: 03-UI-SPEC §Form field labels.
 * Copy contract: D-33 — labels render `<Label>{userCopy} <WireNameTooltip
 *   wireName="{daemon.path}" /></Label>` and the tooltip surfaces the
 *   verbatim daemon path (e.g. `node.name`, `transport.listen_port`) so
 *   users editing the form can correlate it to docs/RPC.md / pim.toml.
 *
 * Brand rules:
 *   - Zero radius (the underlying tooltip primitive enforces rounded-none).
 *   - font-mono throughout — the wire name is itself code, not prose.
 *   - No `!` prefix — focus/hover state classes use Tailwind variants only.
 *   - No native button-styling beyond the focus ring; the trigger is an
 *     inline `ⓘ` that adopts FormLabel's typography.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface WireNameTooltipProps {
  /** Verbatim daemon TOML path, e.g. "transport.listen_port". */
  wireName: string;
}

export function WireNameTooltip({ wireName }: WireNameTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={`wire name: ${wireName}`}
        className="font-mono text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        ⓘ
      </TooltipTrigger>
      <TooltipContent>
        <code className="font-mono text-xs">{wireName}</code>
      </TooltipContent>
    </Tooltip>
  );
}
