/**
 * <Tooltip /> — shadcn Tooltip primitive (new-york), PIM brand-overridden.
 *
 * Spec: .planning/phases/03-configuration-peer-management/03-UI-SPEC.md
 *        §Registry Safety §Brand overrides → tooltip
 *
 * Brand overrides from upstream shadcn new-york:
 *   - Content: rounded-none, bg-popover, border border-border, p-2,
 *     font-mono text-xs (replaces upstream rounded-md bg-foreground
 *     text-background)
 *   - Arrow REMOVED — the box-drawing aesthetic doesn't host speech-bubble
 *     arrows (per 03-UI-SPEC §Registry Safety §tooltip override).
 *   - delayDuration default 200ms (Radix default; within pim.yml motion bounds)
 *   - NO rounded-md anywhere.
 */

"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit rounded-none border border-border bg-popover p-2",
          "font-mono text-xs text-foreground",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "duration-100 ease-linear",
          className,
        )}
        {...props}
      >
        {children}
        {/* Arrow intentionally omitted — box-drawing aesthetic */}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
