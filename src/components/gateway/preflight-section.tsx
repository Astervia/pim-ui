/**
 * <PreflightSection /> — Linux pre-flight check list + [ Re-run ] +
 * D-09 failure banner.
 *
 * Renders the §2a ASCII mockup target verbatim (within Tailwind
 * realities — the box-drawing border comes from the parent CliPanel
 * wrapper, this component owns the rows + actions only).
 *
 * Distinctive strings present:
 *   - "pre-flight" (sub-section heading lowercase)
 *   - "all checks passed" (when all ok)
 *   - "Pre-flight failed — fix the items above and re-run." (D-09 verbatim)
 *
 * Brand discipline: tokens only, no rounded corners, no shadows.
 */

import type { GatewayPreflightResult } from "@/lib/rpc-types";
import { PreflightCheckRow } from "./preflight-check-row";
import { cn } from "@/lib/utils";

export interface PreflightSectionProps {
  result: GatewayPreflightResult;
  loading: boolean;
  onRerun: () => void;
}

export function PreflightSection({ result, loading, onRerun }: PreflightSectionProps) {
  const allOk = result.checks.every((c) => c.ok === true);
  const heading = allOk === true
    ? "pre-flight  · all checks passed"
    : "pre-flight";

  return (
    <section
      className={cn(
        "flex flex-col gap-2 mb-4",
        loading === true ? "opacity-60" : null,
      )}
      aria-busy={loading}
      aria-label="pre-flight checks"
    >
      <p className="font-code text-sm text-foreground">{heading}</p>

      <div className="flex flex-col gap-1">
        {result.checks.map((c) => (
          <PreflightCheckRow key={c.name} check={c} />
        ))}
      </div>

      <button
        type="button"
        onClick={onRerun}
        disabled={loading}
        className={cn(
          "self-start mt-3 px-3 py-1",
          "border border-border bg-transparent text-foreground",
          "hover:border-primary hover:text-primary",
          "font-mono text-xs uppercase tracking-wider",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
      >
        [ Re-run pre-flight ]
      </button>

      {allOk === false ? (
        <p className="font-code text-sm text-text-secondary mt-2">
          Pre-flight failed — fix the items above and re-run.
        </p>
      ) : null}
    </section>
  );
}
