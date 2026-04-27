/**
 * Phase 4 D-21 / D-22: <KillSwitchBanner /> — full-width, non-dismissible,
 * non-modal banner that fires when the kill-switch derived condition
 * (route_on===true && selected_gateway===null) holds.
 *
 * Pattern mirrors LimitedModeBanner: 1px border + 2px destructive-left
 * border, <section role="alert" aria-live="polite">, bg-card, NO border
 * radius. KillSwitchBanner is a SEPARATE component, NOT a LimitedModeBanner
 * variant — both can coexist during transitions; the kill-switch surface
 * outranks limited-mode by sitting above it in the DOM order at AppShell.
 *
 * Visibility: derived from useKillSwitch() (Phase 4 D-30). Renders nothing
 * when false. Banner unmounts cleanly when route_on flips false (the
 * route_off status.event handler in useDaemonState already merges that
 * into the snapshot). NOT a banner-state machine — purely derived from
 * the snapshot.
 *
 * Action: [ TURN OFF KILL-SWITCH ] calls route.set_split_default({on:false}).
 * Pending state shows [...] cursor-blink. On RPC error, toast + re-enable.
 *
 * NOT dismissible by design (D-22): the user MUST act (turn off routing)
 * or the daemon must recover (a peer reconnects, daemon re-selects). A
 * dismiss button would let the user hide the truth, which the brand
 * contract forbids (UX-PLAN §1 P1 Honest over polished). NOT a modal —
 * Mira workflows (read logs, read routing table to debug) must remain
 * accessible while the banner is up.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKillSwitch } from "@/hooks/use-routing";
import { callDaemon } from "@/lib/rpc";
import {
  KILL_SWITCH_HEADLINE,
  KILL_SWITCH_BODY,
  KILL_SWITCH_ACTION,
} from "@/lib/copy";
import { cn } from "@/lib/utils";

export function KillSwitchBanner() {
  const visible = useKillSwitch();
  const [pending, setPending] = useState(false);

  if (visible === false) return null;

  const onTurnOff = async () => {
    setPending(true);
    try {
      await callDaemon("route.set_split_default", { on: false });
      // route_off event will fire; useKillSwitch flips false; banner unmounts.
    } catch (e) {
      const msg =
        e !== null && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
      toast.error(`couldn't turn off routing: ${msg}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      role="alert"
      aria-live="polite"
      className={cn(
        "border bg-card p-6",
        "border-border border-l-2 border-l-destructive",
        "rounded-none",
      )}
    >
      <header className="flex items-center gap-3 font-mono text-sm uppercase tracking-widest">
        <span className="font-semibold text-destructive">
          {KILL_SWITCH_HEADLINE}
        </span>
      </header>
      <div className="mt-4 border-t border-border pt-4 font-mono text-sm text-foreground max-w-[60ch] leading-[1.6]">
        {KILL_SWITCH_BODY}
      </div>
      <div className="mt-4 flex gap-4">
        <Button
          type="button"
          size="lg"
          onClick={() => {
            void onTurnOff();
          }}
          aria-disabled={pending === true || undefined}
        >
          {pending === true ? "[…]" : KILL_SWITCH_ACTION}
        </Button>
      </div>
    </section>
  );
}
