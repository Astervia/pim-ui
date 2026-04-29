/**
 * <Badge /> — status code in brackets.
 *
 * Spec: .design/branding/pim/patterns/STYLE.md → Component patterns → Badge
 *
 * Usage: <Badge>OK</Badge>, <Badge variant="warning">WARN</Badge>, etc.
 * Auto-brackets the label. Monospace uppercase, no radius.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center",
    "rounded-none border font-mono font-medium",
    "uppercase tracking-wider",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-primary",
        warning: "bg-accent text-accent-foreground border-accent",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive",
        muted: "bg-muted text-muted-foreground border-muted",
        outline:
          "bg-transparent text-muted-foreground border-border",
      },
      size: {
        // Default — original spec from STYLE.md (16px line-height row).
        default: "text-[11px] px-2 py-0.5",
        // Phase 4 — sidebar nav rows, peer-row inline badges, density="compact"
        // CliPanel headers. Tighter rhythm so the badge nests cleanly inside
        // an existing 24-28px line without inflating its leading.
        sm: "text-[10px] px-1.5 py-0 leading-[1.4]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function autoBracket(children: React.ReactNode): React.ReactNode {
  if (typeof children !== "string") return children;
  const trimmed = children.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return children;
  return `[${trimmed}]`;
}

export function Badge({
  className,
  variant,
  size,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {autoBracket(children)}
    </span>
  );
}

export { badgeVariants };
