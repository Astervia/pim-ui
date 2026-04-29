/**
 * <CollapsibleCliPanel /> — brand-wrapped Radix Collapsible on top of
 * the CliPanel header shape. Settings sections compose this primitive.
 *
 * Post-redesign — the header gets larger, the title leads with the
 * section name in title weight (rather than chrome-tier muted), and a
 * subtle hover highlight gives keyboard/mouse users a clear affordance
 * that the row is interactive. The `┌─── TITLE ───┐` ascii bracketing
 * stays — it's the brand's signature for box-drawn panels.
 *
 * Anatomy:
 *
 *   ┌─── IDENTITY ───┐  pepe · 9efa1720           ▾
 *   │
 *   │  body content (gap-5 stack)
 *   │
 *   │  ── footer rule ──
 *   │  [ DISCARD ]  [ SAVE ]
 *   └
 *
 * Brand absolutes preserved: zero radius, tokens only, no shadows.
 */

import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface CollapsibleCliPanelProps {
  /** Section id — used for aria-controls + scroll anchor. */
  id: string;
  /** Uppercase title rendered between box-drawing corners. */
  title: string;
  /** One-line summary rendered in the header right area when collapsed. */
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
          "data-[state=open]:border-l-2 data-[state=open]:border-l-primary",
          className,
        )}
        data-state={open === true ? "open" : "closed"}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            id={`${id}-header`}
            aria-controls={`${id}-body`}
            aria-expanded={open}
            className={cn(
              "w-full flex items-center justify-between gap-4",
              "px-5 py-3.5 border-b border-transparent",
              "data-[state=open]:border-b-border",
              "text-left",
              "hover:bg-card/40",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]",
              "transition-colors duration-100 ease-linear",
              "group/header",
            )}
            data-state={open === true ? "open" : "closed"}
          >
            {/* Title — leads with the section name at title weight so the
                section reads as a real heading rather than a chrome
                whisper. The `┌── ──┐` brackets stay as brand grammar. */}
            <span className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden
                className="font-mono text-xs text-text-secondary leading-none shrink-0"
              >
                ┌──
              </span>
              <span className="font-mono text-sm uppercase tracking-[0.18em] font-semibold text-foreground truncate">
                {title}
              </span>
              <span
                aria-hidden
                className="font-mono text-xs text-text-secondary leading-none shrink-0"
              >
                ──┐
              </span>
            </span>

            {/* Right cluster — summary, optional pending-restart token,
                and the open/close indicator. */}
            <span className="flex items-center gap-3 text-text-secondary shrink-0">
              <span className="font-code text-xs normal-case tracking-normal hidden sm:inline-flex items-center">
                {summary}
              </span>
              {pendingRestartToken}
              <span
                aria-hidden
                className={cn(
                  "font-mono text-base leading-none w-4 text-center",
                  "transition-colors duration-100 ease-linear",
                  open === true ? "text-primary" : "text-text-secondary",
                  "group-hover/header:text-primary",
                )}
              >
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
          <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
