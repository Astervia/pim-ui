/**
 * <KvRow /> — two-column key-value row in monospace for the Peer Detail
 * slide-over (02-UI-SPEC §Peer Detail §KeyValueTable row).
 *
 * Shape:
 *   {label (muted, 12ch fixed)}  {value (foreground)}
 *
 * When `copyable` is true and `value` is a string, clicking the value
 * writes it to the clipboard and shows a hover hint (UI-SPEC §Peer
 * Detail §Identity: "click to copy" for node_id).
 *
 * NO border-radius, NO gradients, NO literal palette colors.
 */

import type * as React from "react";
import { cn } from "@/lib/utils";

export interface KvRowProps {
  label: string;
  value: string | React.ReactNode;
  /** When true AND value is a string, click-to-copy is wired. */
  copyable?: boolean;
  /** Additional classes applied to the value span. */
  valueClassName?: string;
}

export function KvRow({ label, value, copyable, valueClassName }: KvRowProps) {
  const canCopy = copyable === true && typeof value === "string";
  const handleCopy = () => {
    if (canCopy === false) return;
    // Narrowed by canCopy guard above.
    navigator.clipboard.writeText(value as string).catch(() => {});
  };
  return (
    <div className="grid grid-cols-[12ch_1fr] gap-x-3 font-code text-sm leading-[1.7]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          valueClassName,
          canCopy === true &&
            "cursor-pointer hover:text-primary transition-colors duration-100 ease-linear",
        )}
        onClick={canCopy === true ? handleCopy : undefined}
        title={canCopy === true ? "click to copy" : undefined}
      >
        {value}
      </span>
    </div>
  );
}
