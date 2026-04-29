/**
 * <Input /> — bordered prompt-style input.
 *
 * Post-redesign: the previous implementation rendered a borderless
 * `> ` prompt with no visible field boundary, which read as "raw text"
 * inside long settings forms — the user couldn't tell where a field
 * started or ended. The redesign adds a real terminal field box
 * (popover bg + 1px border) that lights up to primary on focus, so
 * the field is unmistakable while the brand prompt-prefix grammar
 * is preserved.
 *
 * Anatomy:
 *
 *   ┌────────────────────────────────────────┐
 *   │ > 192.168.0.137:9100                   │   default — border-border
 *   └────────────────────────────────────────┘
 *
 *   ┌────────────────────────────────────────┐
 *   │ > █                                    │   focused — border-primary
 *   └────────────────────────────────────────┘   prompt re-tints primary
 *
 *   ┌────────────────────────────────────────┐
 *   │ > 192.168.0.137:9100                   │   error — border-destructive
 *   └────────────────────────────────────────┘   (driven by aria-invalid)
 *
 * The field stays zero-radius, monospace, no shadow / glow — the
 * border IS the field; everything else is text.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Prompt character. Defaults to "> ". Pass "" to suppress. */
  prompt?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, prompt = "> ", "aria-invalid": ariaInvalid, ...props }, ref) => {
    const invalid = ariaInvalid === true || ariaInvalid === "true";
    return (
      <div
        data-invalid={invalid === true ? true : undefined}
        className={cn(
          "group flex items-center gap-2",
          "bg-popover text-foreground",
          "border border-border",
          "focus-within:border-primary",
          "data-[invalid=true]:border-destructive",
          "px-3 py-2",
          "transition-colors duration-100 ease-linear",
          props.disabled === true && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        {prompt === "" ? null : (
          <span
            aria-hidden
            className={cn(
              "font-code text-text-secondary leading-none select-none",
              "group-focus-within:text-primary",
              "transition-colors duration-100 ease-linear",
            )}
          >
            {prompt.trim()}
          </span>
        )}
        <input
          ref={ref}
          aria-invalid={ariaInvalid}
          className={cn(
            "flex-1 min-w-0 bg-transparent outline-none border-none",
            "font-code text-sm leading-tight text-foreground",
            "placeholder:text-muted-foreground",
            "caret-primary",
            "disabled:cursor-not-allowed",
            // Suppress the global :focus-visible outline (declared in
            // globals.css). The wrapper already lights up via
            // focus-within:border-primary; without this rule the inner
            // input would draw a second 1px ring offset 2px → reads as
            // a double-border on any focused field.
            "focus-visible:outline-none",
          )}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";
