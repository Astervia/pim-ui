/**
 * <RadioGroup /> — shadcn RadioGroup primitive (new-york), PIM brand-overridden.
 *
 * Spec: .planning/phases/03-configuration-peer-management/03-UI-SPEC.md
 *        §Registry Safety §Brand overrides → radio-group
 *
 * Brand overrides from upstream shadcn new-york:
 *   - Root: grid gap-2 (replaces upstream gap-3 — matches form-row md spacing)
 *   - Item: zero-radius square + border border-border (no circle indicators)
 *   - Item size: h-4 w-4
 *   - Indicator: a concentric `bg-primary h-2 w-2` SQUARE (NOT a CircleIcon
 *     dot from lucide-react — box-drawing aesthetic per UI-SPEC §radio-group)
 *   - focus-visible: outline-2 outline-ring outline-offset-2
 *   - NO lucide-react import (brand uses ASCII glyphs / typed characters)
 *   - NO shadow-xs (brand has no shadows)
 */

"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square h-4 w-4 shrink-0 rounded-none border border-border outline-none",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex h-full w-full items-center justify-center"
      >
        {/* Concentric square (NOT a dot) per 03-UI-SPEC §radio-group override.
            Box-drawing aesthetic forbids circle indicators. */}
        <span aria-hidden className="block h-2 w-2 bg-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
