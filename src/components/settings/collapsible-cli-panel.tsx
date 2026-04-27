/**
 * <CollapsibleCliPanel /> — brand-wrapped Radix Collapsible on top of the
 * CliPanel header shape. Phase 3 Plan 03-04 §Part A.
 *
 * Spec: 03-UI-SPEC §S1 Settings page + §S1a CollapsibleCliPanel anatomy +
 *        §Interaction states (CollapsibleCliPanel header).
 *
 * Anatomy:
 *   header (CollapsibleTrigger button)
 *     ┌─── TITLE ───┐                   summary…   pendingRestartToken?  ▸/▾
 *   body (CollapsibleContent)
 *     children (consumer renders the form / banner / save footer)
 *
 * Brand rules:
 *   - Zero radius (no rounded-*) — the box-drawing header IS the radius story.
 *   - bg-popover surface, border-border outline (mirrors CliPanel parent).
 *   - font-mono uppercase tracking-widest for the header title (chrome role).
 *   - Animation classes mirror the existing dialog.tsx / sheet.tsx patterns
 *     (data-[state=open]:animate-in, data-[state=closed]:animate-out, fade
 *     and slide). When the project's tailwind animation utilities aren't
 *     loaded the class names are no-ops at runtime — collapse still works
 *     correctly via Radix Collapsible's data-state attributes.
 *
 * Bang-free per project policy.
 */

import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface CollapsibleCliPanelProps {
  /** Section id — used for aria-controls + scroll anchor (e.g. "transport"). */
  id: string;
  /** Uppercase title rendered between box-drawing corners. */
  title: string;
  /** One-line summary rendered in the header right area (collapsed view). */
  summary: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional pending-restart token rendered after the summary. */
  pendingRestartToken?: ReactNode;
  /** Section body — rendered inside the CollapsibleContent. */
  children: ReactNode;
  className?: string;
}

export function CollapsibleCliPanel({
  id,
  title,
  summary,
  open,
  onOpenChange,
  pendingRestartToken,
  children,
  className,
}: CollapsibleCliPanelProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section
        id={`settings-section-${id}`}
        className={cn(
          "bg-popover border border-border text-foreground",
          "font-code text-sm leading-[1.7]",
          className,
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            id={`${id}-header`}
            aria-controls={`${id}-body`}
            aria-expanded={open}
            className={cn(
              "w-full flex items-center justify-between gap-4",
              "px-4 py-2 border-b border-border",
              "font-mono text-xs uppercase tracking-widest",
              "text-muted-foreground hover:text-primary",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]",
              "transition-colors duration-100 ease-linear",
            )}
          >
            <span>┌─── {title} ───┐</span>
            <span className="flex items-center gap-2 text-foreground normal-case tracking-normal">
              {summary}
              {pendingRestartToken}
              <span aria-hidden="true" className="text-muted-foreground">
                {open === true ? "▾" : "▸"}
              </span>
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent
          id={`${id}-body`}
          role="region"
          aria-labelledby={`${id}-header`}
          className={cn(
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-150 ease-out",
          )}
        >
          <div className="px-5 py-4">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
