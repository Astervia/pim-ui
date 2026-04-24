/**
 * <PeerDetailSheet /> — right-edge slide-over that opens when a peer row
 * is clicked on the Dashboard (PEER-04, 02-CONTEXT D-15..D-18,
 * 02-UI-SPEC §S3 Peer Detail slide-over).
 *
 * Width: 480px per D-15 / UI-SPEC §Spacing §Slide-over width.
 * Four sections in fixed order per D-17:
 *   1. IDENTITY      — node_id (copy), short_id, mesh_ip, label
 *   2. CONNECTION    — transport, state (StatusIndicator + word), hops,
 *                      last_seen, latency, is_gateway
 *   3. TRUST         — source string: D-17 verbatim
 *                      "configured in pim.toml" or "paired via discovery"
 *   4. TROUBLESHOOT  — last 25 peers.event entries for this peer;
 *      LOG            failed peer pins a pair_failed reason at top
 *                     in text-destructive per UI-SPEC §Section 4.
 *
 * Phase-3 peer-action affordances are intentionally OMITTED per D-18 —
 * not disabled, not rendered at all. Those land in Phase 3 with PEER-02
 * and PEER-03 once the add/remove/re-pair RPCs are wired.
 *
 * Interaction:
 *   - Header's `[ show full ]` button toggles 8-char short_id ↔ 64-char
 *     full node_id (D-16).
 *   - Close via `Esc`, click outside, or × glyph (Radix Sheet default).
 *   - showFull is reset whenever the selected peer changes.
 *
 * NO border-radius, NO gradients, NO literal palette colors, NO
 * exclamation marks.
 */

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { KvRow } from "./kv-row";
import { formatDuration } from "@/lib/format";
import { usePeerDetail } from "@/hooks/use-peer-detail";
import {
  usePeerTroubleshootLog,
  type PeerLogEntry,
} from "@/hooks/use-peer-troubleshoot-log";
import { cn } from "@/lib/utils";
import type { PeerState, PeerSummary } from "@/lib/rpc-types";

// Honesty-contract state-word colour (mirrors peer-row.tsx).
const STATE_WORD_CLASS: Record<PeerState, string> = {
  active: "text-foreground",
  relayed: "text-accent",
  connecting: "text-muted-foreground",
  failed: "text-destructive",
};

/** ISO-8601 → "HH:mm:ss" in local time. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 8);
}

export function PeerDetailSheet() {
  const { selected, close } = usePeerDetail();
  const [showFull, setShowFull] = useState(false);
  const log = usePeerTroubleshootLog(selected?.node_id);

  // Reset show-full reveal whenever the selected peer changes.
  useEffect(() => {
    setShowFull(false);
  }, [selected?.node_id]);

  if (selected === null) return null;
  const peer: PeerSummary = selected;

  // Failed-peer callout per UI-SPEC §Section 4: when peer.state === "failed",
  // pin the most recent `pair_failed` event at top with reason in destructive.
  const failedEvent: PeerLogEntry | undefined =
    peer.state === "failed"
      ? log.find((e) => e.kind === "pair_failed")
      : undefined;

  // Connection column values.
  const latencyValue =
    peer.latency_ms === null ? "—" : `${peer.latency_ms}ms`;
  const isGatewayValue = peer.is_gateway === true ? "yes (egress)" : "no";
  // D-17: TRUST source copy VERBATIM.
  const trustSource =
    peer.static === true ? "configured in pim.toml" : "paired via discovery";
  const labelValue = peer.label === null ? "—" : peer.label;

  return (
    <Sheet
      open={selected === null ? false : true}
      onOpenChange={(open) => {
        if (open === false) close();
      }}
    >
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] p-6 gap-6"
      >
        <SheetHeader>
          <SheetTitle>
            {peer.label === null ? peer.node_id_short : peer.label}
          </SheetTitle>
          <div className="font-code text-sm text-muted-foreground flex items-center gap-2">
            <span>{peer.node_id_short}</span>
            <button
              type="button"
              onClick={() => setShowFull((s) => (s === true ? false : true))}
              className="font-mono text-xs uppercase tracking-wider text-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors duration-100 ease-linear"
            >
              [ show {showFull === true ? "short" : "full"} ]
            </button>
          </div>
          {showFull === true && (
            <pre className="font-code text-xs break-all mt-2 text-foreground whitespace-pre-wrap">
              {peer.node_id}
            </pre>
          )}
        </SheetHeader>

        {/* Section 1 — IDENTITY */}
        <section
          aria-label="identity"
          className="flex flex-col gap-1 border-b border-border pb-4"
        >
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
            identity
          </h3>
          <KvRow label="node_id" value={peer.node_id} copyable />
          <KvRow label="short_id" value={peer.node_id_short} />
          <KvRow label="mesh_ip" value={peer.mesh_ip} />
          <KvRow label="label" value={labelValue} />
        </section>

        {/* Section 2 — CONNECTION */}
        <section
          aria-label="connection"
          className="flex flex-col gap-1 border-b border-border pb-4"
        >
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
            connection
          </h3>
          <KvRow label="transport" value={peer.transport} />
          <KvRow
            label="state"
            value={
              <span className="inline-flex items-center gap-1">
                <StatusIndicator state={peer.state} />
                <span className={STATE_WORD_CLASS[peer.state]}>
                  {peer.state}
                </span>
              </span>
            }
          />
          <KvRow label="hops" value={String(peer.route_hops)} />
          <KvRow
            label="last_seen"
            value={`${formatDuration(peer.last_seen_s)} ago`}
          />
          <KvRow label="latency" value={latencyValue} />
          <KvRow label="is_gateway" value={isGatewayValue} />
        </section>

        {/* Section 3 — TRUST */}
        <section
          aria-label="trust"
          className="flex flex-col gap-1 border-b border-border pb-4"
        >
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
            trust
          </h3>
          <KvRow label="source" value={trustSource} />
        </section>

        {/* Section 4 — TROUBLESHOOT LOG */}
        <section
          aria-label="troubleshoot log"
          className="flex-1 min-h-0 flex flex-col"
        >
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
            troubleshoot log
          </h3>
          {log.length === 0 ? (
            <p className="font-code text-sm text-muted-foreground">
              No events recorded this session
            </p>
          ) : (
            <ul
              role="list"
              className="font-code text-sm leading-[1.7] space-y-0.5 overflow-y-auto"
            >
              {failedEvent === undefined ? null : (
                <li className="pb-2 mb-2 border-b border-border">
                  <span className="text-muted-foreground">
                    {formatTime(failedEvent.at)}
                  </span>{" "}
                  <span className="text-destructive">✗ pair_failed</span>{" "}
                  <span className="text-destructive">
                    reason: {failedEvent.reason === undefined ? "unknown" : failedEvent.reason}
                  </span>
                </li>
              )}
              {log
                .filter((e) => (e === failedEvent ? false : true))
                .map((e, i) => (
                  <li
                    key={`${e.at}-${i}`}
                    className={cn(
                      "flex items-baseline gap-2",
                      e.kind === "pair_failed" && "text-destructive",
                    )}
                  >
                    <span className="text-muted-foreground">
                      {formatTime(e.at)}
                    </span>
                    <span>{e.kind}</span>
                    {e.reason === undefined || e.reason === "" ? null : (
                      <span className="text-muted-foreground">{e.reason}</span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
