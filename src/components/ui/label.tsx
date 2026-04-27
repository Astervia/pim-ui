/**
 * <Label /> — shadcn Label primitive (new-york), Radix wrapper.
 *
 * Pulled in transitively by `form.tsx` (FormLabel wraps Label). The brand
 * typography (font-mono, uppercase, tracking-widest, label role) is set
 * by FormLabel — this primitive remains unstyled accessibility plumbing
 * so it can be re-used in non-form contexts.
 */

"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 leading-none select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
