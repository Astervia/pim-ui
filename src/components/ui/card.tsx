/**
 * <Card /> — shadcn primitive overridden for the pim brand.
 *
 * Spec: .design/branding/pim/patterns/STYLE.md → Component patterns → Card
 *
 * Rules:
 *   - radius: 0, shadow: none
 *   - border: 1px solid var(--color-border)
 *   - background: var(--color-card)
 *   - Optional ASCII header: ┌─── TITLE ───┐ (use <CardHeader asAscii />)
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-card text-card-foreground border border-border rounded-none",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render the title with ASCII box-drawing decoration. */
  asAscii?: boolean;
  title?: string;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, asAscii, title, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-4",
        "px-6 py-4 border-b border-border",
        "font-mono text-xs uppercase tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    >
      {asAscii && title ? <span>┌─── {title.toUpperCase()} ───┐</span> : children}
    </div>
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-mono text-sm font-medium text-foreground", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between gap-4 px-6 py-3 border-t border-border",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
