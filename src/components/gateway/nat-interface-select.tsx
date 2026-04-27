/**
 * <NatInterfaceSelect /> — NAT-interface picker + Turn-on action.
 *
 * Per D-07: trigger renders ( {iface} ▾ ) using the Phase 2 brand
 * <Select>. Per D-06: rendered ONLY when every pre-flight check passes
 * (the parent screen gates this).
 *
 * Submits callDaemon("gateway.enable", { nat_interface }) on click.
 * D-44: on reject, render inline destructive error AND fire a sonner
 * toast as redundancy belt for slow enables where the user navigated
 * away mid-call.
 */

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callDaemon } from "@/lib/rpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { RpcError } from "@/lib/rpc-types";

export interface NatInterfaceSelectProps {
  suggestedInterfaces: readonly string[];
  /** Refresh hook in parent — Plan 05-03 swaps in active panel via refetch. */
  onEnabled?: () => void;
}

export function NatInterfaceSelect({ suggestedInterfaces, onEnabled }: NatInterfaceSelectProps) {
  const fallback = suggestedInterfaces[0] ?? "";
  const [selected, setSelected] = useState<string>(fallback);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnable() {
    if (selected === "") return;
    setSubmitting(true);
    setError(null);
    try {
      await callDaemon("gateway.enable", { nat_interface: selected });
      if (onEnabled === undefined) return;
      onEnabled();
    } catch (e) {
      const err = e as RpcError;
      const msg = err.message ?? "Gateway enable failed";
      setError(msg);
      // D-44 redundancy belt: toast for users who navigated away
      toast.error(`Gateway enable failed: ${msg}`, { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 mt-2" aria-label="enable gateway">
      <p className="font-code text-sm text-foreground">nat interface</p>

      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="font-mono text-sm w-fit min-w-[180px]">
          <SelectValue placeholder="select interface" />
        </SelectTrigger>
        <SelectContent>
          {suggestedInterfaces.map((iface) => (
            <SelectItem key={iface} value={iface}>
              {iface}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={handleEnable}
        disabled={selected === "" || submitting === true}
        className={cn(
          "self-start mt-1 px-3 py-1",
          "bg-primary text-primary-foreground border border-primary",
          "hover:bg-background hover:text-primary",
          "font-mono text-xs uppercase tracking-wider",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
      >
        [ Turn on gateway mode ]
      </button>

      {error === null ? null : (
        <p className="font-code text-sm text-destructive">{error}</p>
      )}
    </section>
  );
}
