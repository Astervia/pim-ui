/**
 * <Button /> — shadcn primitive overridden for the pim brand.
 *
 * Spec: .design/branding/pim/patterns/STYLE.md → Component patterns → Button
 * Spec: .design/branding/pim/patterns/components/token-mapping.md
 *
 * Rules:
 *   - Bracketed text in UPPERCASE, Geist Mono 500
 *   - radius: 0 (never rounded)
 *   - Hover: video-invert (primary becomes bg, text becomes primary)
 *   - Instant transition (100ms linear) — no easing curves
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap",
    "font-mono font-medium uppercase tracking-wider",
    "rounded-none transition-colors duration-100 ease-linear",
    "focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary hover:bg-background hover:text-primary",
        secondary:
          "bg-transparent text-foreground border border-border hover:border-primary hover:text-primary",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive hover:bg-background hover:text-destructive",
        ghost:
          "bg-transparent text-foreground hover:text-primary",
        link:
          "bg-transparent text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-10 px-5 py-2 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * Wraps children in `[ LABEL ]` brackets unless already wrapped.
 * Consumers can pass `<Button>[ CUSTOM ]</Button>` to opt out.
 */
function autoBracket(children: React.ReactNode): React.ReactNode {
  if (typeof children !== "string") return children;
  const trimmed = children.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return children;
  return `[ ${trimmed} ]`;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      >
        {asChild ? children : autoBracket(children)}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
