/**
 * <ScrollArea /> — shadcn ScrollArea primitive (new-york), PIM brand-overridden.
 *
 * Spec: .planning/phases/02-honest-dashboard-peer-surface/02-UI-SPEC.md
 *        §Registry Safety (scroll-area is new for Phase 2)
 * Style: globals.css L228 scrollbar rule — thumb in bg-muted, zero border radius.
 *
 * Brand overrides from upstream shadcn new-york:
 *   - Viewport: no border radius, no ring-on-focus (globals.css already
 *     provides :focus-visible), zero shadow
 *   - ScrollBar thumb: bg-muted (matches globals.css scrollbar rule) —
 *     generator default applies a fully-pilled thumb; we strip that so
 *     the scrollbar matches the terminal rectangle aesthetic
 *   - No rail shape on the scrollbar track
 */

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full outline-none focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 bg-muted"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
