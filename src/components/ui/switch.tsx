/**
 * <Switch /> — shadcn Switch primitive (new-york), PIM brand-overridden.
 *
 * Spec: .planning/phases/03-configuration-peer-management/03-UI-SPEC.md
 *        §Registry Safety §Brand overrides required on the new primitives →
 *        switch
 *
 * Brand overrides from upstream shadcn new-york:
 *   - Root + thumb: rounded-none (NEVER rounded-full per brand radius=0)
 *   - data-[state=checked]: bg-primary; data-[state=unchecked]: bg-muted
 *   - thumb: bg-popover (off) / bg-primary-foreground (on); border border-border
 *   - focus-visible: outline-2 outline-ring outline-offset-2
 *     (NO focus-visible:ring-* — replaces shadcn's focus ring grammar)
 *   - size: h-5 w-9 root; h-4 w-4 thumb (terminal-proportional, not pill-shaped)
 *   - motion: transition-transform duration-100 ease-linear (matches Phase 1
 *     button motion grammar — instant + linear, no easing curves)
 *   - NO shadow-xs (brand has no shadows)
 */

"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-none border border-border outline-none",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-none border border-border",
          "data-[state=checked]:bg-primary-foreground data-[state=unchecked]:bg-popover",
          "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
          "transition-transform duration-100 ease-linear",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
