/**
 * <AlertDialog /> — shadcn AlertDialog primitive (new-york), PIM brand-overridden.
 *
 * Spec: .planning/phases/03-configuration-peer-management/03-UI-SPEC.md
 *        §Registry Safety §Brand overrides → alert-dialog
 *        + §S4 Remove Peer AlertDialog + §S5 Discard Unsaved Changes AlertDialog
 *
 * Brand overrides from upstream shadcn new-york:
 *   - Content: rounded-none, bg-popover, border border-border, p-6, max-w-md
 *     (replaces upstream rounded-lg + bg-background + shadow-lg)
 *   - Overlay: bg-background/80 (matches dialog.tsx L32; NO bg-black/50, NO blur)
 *   - Title: font-mono text-lg uppercase tracking-wider font-semibold (heading-lg)
 *   - Description: font-mono text-sm leading-[1.6] text-foreground (body)
 *   - Footer: font-mono text-xs uppercase tracking-widest button text grammar
 *     (button text inherits from <Button> already, but spacing/border match
 *      dialog.tsx)
 *   - Action (primary destructive): defaults to variant="destructive"
 *     because Phase 3's only AlertDialog uses are destructive prompts
 *     (Remove peer / Discard changes). Consumers can override via prop.
 *   - Cancel: defaults to variant="ghost" (replaces upstream "outline" —
 *     matches StopConfirmDialog pattern from Phase 1).
 *   - REMOVED AlertDialogMedia (the upstream media slot uses rounded-md
 *     bg-muted — brand violation; not used by any Phase 3 surface).
 *   - NO shadow-lg, NO rounded-md, NO rounded-lg anywhere.
 */

"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-background/80",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4",
          "bg-popover border border-border text-foreground",
          "rounded-none p-6",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "duration-100 ease-linear",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 border-b border-border pb-4", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-row justify-end gap-3 border-t border-border pt-4",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "font-mono text-lg font-semibold uppercase tracking-wider text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "font-mono text-sm leading-[1.6] text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "destructive",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Action
        data-slot="alert-dialog-action"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

function AlertDialogCancel({
  className,
  variant = "ghost",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Cancel
        data-slot="alert-dialog-cancel"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
