/**
 * <Input /> — prompt-style input.
 *
 * Spec: .design/branding/pim/patterns/STYLE.md → Component patterns → Input
 *
 * Rules:
 *   - No box, no border, no ring
 *   - "> " prompt prefix before the field
 *   - Monospace always
 *   - Focus: blinking block cursor (we use caret-color + a trailing █)
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Prompt character. Defaults to "> ". */
  prompt?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, prompt = "> ", ...props }, ref) => (
    <div
      className={cn(
        "flex items-center font-code text-sm text-foreground",
        "bg-transparent border-none",
        className,
      )}
    >
      <span className="text-primary select-none">{prompt}</span>
      <input
        ref={ref}
        className={cn(
          "flex-1 bg-transparent outline-none border-none",
          "font-code text-foreground placeholder:text-muted-foreground",
          "caret-primary",
        )}
        {...props}
      />
    </div>
  ),
);
Input.displayName = "Input";
