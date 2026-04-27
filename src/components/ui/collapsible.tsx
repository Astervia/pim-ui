/**
 * <Collapsible /> — shadcn Collapsible primitive (new-york), Radix wrapper.
 *
 * Spec: .planning/phases/03-configuration-peer-management/03-UI-SPEC.md
 *        §Registry Safety §Brand overrides → collapsible
 *
 * No visual chrome — this primitive is pure plumbing. The Phase-3 brand
 * `CollapsibleCliPanel` (Plan 03-04) wraps these and applies the box-drawing
 * header + ▸/▾ glyph swap. data-[state=open] / data-[state=closed] is
 * available on the Trigger/Content for consumer styling.
 */

"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
