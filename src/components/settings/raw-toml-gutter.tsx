/**
 * <RawTomlGutter /> — left-gutter line-number column for the raw-TOML
 * editor. Phase 3 Plan 03-06 §Part B.
 *
 * Spec: 03-UI-SPEC §S1b Raw-TOML editor surface — fixed-width 48px
 * (`w-12`) gutter, `bg-muted/30` surface (slightly distinct from the
 * textarea's `bg-popover`), right-edge `border-r border-border`,
 * `font-code text-xs text-muted-foreground` text, `leading-[22px]`
 * rows aligning to the textarea row grid.
 *
 * Erroring rows render `⚠ {n}` in `text-accent` per UI-SPEC and become
 * clickable; clicking dispatches an `onErrorClick(line)` so the parent
 * editor can move the textarea cursor to `(line, column)` per D-14.
 *
 * Bang-free per project policy.
 */

import { cn } from "@/lib/utils";

export interface RawTomlGutterProps {
  /** 1-based count of textarea lines (buffer.split("\n").length). */
  lineCount: number;
  /** 1-based line numbers that have at least one daemon-reported error. */
  errorLines: Set<number>;
  /** Click handler for an erroring row — argument is the 1-based line number. */
  onErrorClick: (line: number) => void;
}

export function RawTomlGutter({
  lineCount,
  errorLines,
  onErrorClick,
}: RawTomlGutterProps) {
  return (
    <div
      className="w-12 bg-muted/30 border-r border-border text-right font-code text-xs text-muted-foreground select-none"
      aria-hidden="true"
    >
      {Array.from({ length: lineCount }, (_, i) => {
        const line = i + 1;
        const hasError = errorLines.has(line);
        return (
          <div
            key={line}
            className={cn(
              "leading-[22px] px-1",
              hasError === true && "text-accent cursor-pointer",
            )}
            onClick={hasError === true ? () => onErrorClick(line) : undefined}
            role={hasError === true ? "button" : undefined}
            aria-label={
              hasError === true ? `jump to error on line ${line}` : undefined
            }
          >
            {hasError === true ? `⚠ ${line}` : line}
          </div>
        );
      })}
    </div>
  );
}
