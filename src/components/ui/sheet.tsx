/**
 * <Sheet /> — shadcn Sheet primitive (new-york), PIM brand-overridden.
 *
 * Post-redesign: the SheetContent now ships with a built-in 48px chrome
 * row at the top that holds the close button and a divider. The chrome
 * pushes consumer content down from the macOS title-bar / traffic-light
 * area so right-edge slide-overs stop reading as cramped against the
 * window edge. The body of the sheet is its own `overflow-y-auto`
 * region so long content scrolls without fighting the chrome.
 *
 * Chrome anatomy:
 *
 *   ┌─────────────────────────────────────────┐
 *   │                                       × │   ← shrink-0, h-12, border-b
 *   ├─────────────────────────────────────────┤
 *   │                                         │   ← flex-1, overflow-y-auto
 *   │  consumer content                       │
 *   │                                         │
 *   └─────────────────────────────────────────┘
 *
 * Brand overrides:
 *   - SheetContent: bg-popover, no shadow, zero radius
 *   - SheetContent side="right": border-l border-border
 *   - SheetOverlay: solid bg-background/80 (no blur)
 *   - SheetTitle: font-mono uppercase tracking-wider, larger size
 *     (font-display tier rather than chrome)
 *   - SheetHeader: removes its own border — section dividers handle it
 *   - Close button: × glyph (U+00D7) inside the top chrome row, NOT
 *     absolute-positioned, so it can never collide with consumer content
 *
 * NO border-radius anywhere, NO shadows, NO backdrop-blur.
 */

"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-background/80",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col",
          "bg-popover text-foreground",
          "transition ease-in-out duration-100",
          "data-[state=closed]:animate-out data-[state=open]:animate-in",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        {/* Top chrome row — h-12 with the close button right-aligned and
            a 1px border below. Pushes consumer content below the macOS
            traffic-light region and gives the close affordance an
            unambiguous home. */}
        {showCloseButton === true && (
          <div className="shrink-0 flex items-center justify-end h-12 px-4 border-b border-border">
            <SheetPrimitive.Close
              aria-label="close"
              className={cn(
                "font-mono text-2xl leading-none",
                "text-muted-foreground hover:text-primary",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
                "disabled:pointer-events-none",
                "transition-colors duration-100 ease-linear",
                "h-8 w-8 flex items-center justify-center",
              )}
            >
              <span aria-hidden>×</span>
            </SheetPrimitive.Close>
          </div>
        )}
        {/* Body — scrollable, padded. Consumers should NOT pass their
            own p-* override on SheetContent; the body owns padding. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {children}
        </div>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 border-t border-border pt-4",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-mono text-xl leading-tight tracking-tight font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        "font-code text-sm text-text-secondary leading-[1.6]",
        className,
      )}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
