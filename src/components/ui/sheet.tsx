/**
 * <Sheet /> — shadcn Sheet primitive (new-york), PIM brand-overridden.
 *
 * Spec: .planning/phases/02-honest-dashboard-peer-surface/02-UI-SPEC.md
 *        §S3 Peer Detail slide-over, §Registry Safety (sheet is new for Phase 2)
 * Style: STYLE.md — radius-0, no shadow, bg-popover, border-border,
 *        font-mono on SheetTitle.
 *
 * Brand overrides from upstream shadcn new-york:
 *   - SheetContent: bg-popover (NOT bg-background), no shadow, zero radius
 *   - SheetContent side="right": border-l border-border (brand divider token)
 *   - SheetOverlay: bg-background/80 (solid tint, no blur — matches dialog.tsx)
 *   - SheetTitle: font-mono uppercase tracking-wider font-semibold
 *   - SheetHeader: border-b border-border pb-4 mb-4
 *   - Close button: uses the literal × glyph (U+00D7) not lucide XIcon;
 *     zero-radius; aria-label="close peer detail" (UI-SPEC §Peer Detail
 *     slide-over close affordance)
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
          "fixed z-50 flex flex-col gap-4",
          "bg-popover text-foreground",
          "transition ease-in-out duration-100",
          "data-[state=closed]:animate-out data-[state=open]:animate-in",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton === true && (
          <SheetPrimitive.Close
            aria-label="close peer detail"
            className={cn(
              "absolute top-4 right-4",
              "font-mono text-lg leading-none",
              "text-muted-foreground hover:text-primary",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
              "disabled:pointer-events-none",
              "transition-colors duration-100 ease-linear",
            )}
          >
            {/* × glyph (U+00D7) per UI-SPEC §Peer Detail slide-over close */}
            <span aria-hidden>×</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-2 border-b border-border pb-4 mb-4",
        className,
      )}
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
        "font-mono text-sm uppercase tracking-wider font-semibold text-foreground",
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
        "font-code text-sm text-muted-foreground leading-[1.6]",
        className,
      )}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
