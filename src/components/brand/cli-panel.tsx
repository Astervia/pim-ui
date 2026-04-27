/**
 * <CliPanel /> — the terminal-output panel.
 *
 * First-class brand imagery (see .design/branding/pim/identity/imagery-style.md).
 * Box-drawing header with ASCII title bar. Monospace code content.
 * This is the visual hero of the pim UI — every status view should feel
 * like reading a well-designed CLI output, not a SaaS dashboard.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

export interface CliPanelProps {
  title: string;
  status?: { label: string; variant?: BadgeVariant };
  children: ReactNode;
  className?: string;
}

export function CliPanel({ title, status, children, className }: CliPanelProps) {
  return (
    <section
      className={cn(
        "bg-popover border border-border text-foreground",
        "font-code text-sm leading-[1.7]",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-4",
          "px-4 py-2 border-b border-border",
          "font-mono text-xs uppercase tracking-widest",
          "text-muted-foreground",
        )}
      >
        <span>┌─── {title.toUpperCase()} ───┐</span>
        {status && <Badge variant={status.variant ?? "default"}>[{status.label}]</Badge>}
      </header>
      <div className="px-5 py-4 overflow-x-auto">{children}</div>
    </section>
  );
}
