/**
 * <PreflightCheckRow /> — one row in the pre-flight check list per
 * 05-CONTEXT D-04 + RESEARCH §10a.
 *
 * Renders:
 *   ◆ {humanized name}                                    (when ok)
 *   ✗ {humanized name}   detail: {check.detail}           (when fail)
 *                          · {recoveryHint}                 (if hint exists)
 *
 * StatusIndicator is REUSED from Phase 2 (no new icon work). The check
 * detail is rendered in text-muted-foreground (secondary); the recovery
 * hint also in text-muted-foreground but on a new visual line via the
 * leading box-drawing dot separator (which CliPanel's font-code styling
 * carries).
 */

import type { GatewayPreflightCheck } from "@/lib/rpc-types";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { humanizeCheckName } from "@/lib/gateway/check-names";
import { recoveryHint } from "@/lib/gateway/recovery-hints";

export interface PreflightCheckRowProps {
  check: GatewayPreflightCheck;
}

export function PreflightCheckRow({ check }: PreflightCheckRowProps) {
  const hint = check.ok === false ? recoveryHint(check.name) : null;
  const detailText =
    check.ok === false ? `   detail: ${check.detail}` : null;

  return (
    <div className="flex flex-wrap gap-x-2 items-baseline font-code text-sm leading-[1.7]">
      <StatusIndicator state={check.ok === true ? "active" : "failed"} />
      <span className="text-foreground">{humanizeCheckName(check.name)}</span>
      {detailText === null ? null : (
        <span className="text-muted-foreground">{detailText}</span>
      )}
      {hint === null ? null : (
        <span className="text-muted-foreground">{` · ${hint}`}</span>
      )}
    </div>
  );
}
