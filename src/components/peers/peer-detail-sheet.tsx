/**
 * <PeerDetailSheet /> — right-edge slide-over for a single peer.
 *
 * Post-redesign: the sheet primitive now owns the top-chrome (close
 * button + macOS clearance) so this file renders only content. The
 * header is restructured around a single display name + short_id reveal
 * + status pill, removing the previous "title (uppercased) followed by
 * the same id again" redundancy.
 *
 * Layout:
 *
 *   ┌── (sheet chrome: × close) ───────────────┐
 *   │                                          │
 *   │  pim                                     │  display name
 *   │  9efa1720…660f2bd7   [ show full ]       │  short id (reveal full)
 *   │  9efa17206618...660f2bd7                 │  full id when shown
 *   │                                          │
 *   │  ◆ active · tcp · 6ms · 6s ago · gateway │  status pill
 *   │                                          │
 *   ├──────────────────────────────────────────┤
 *   │  IDENTITY                                │
 *   │    node_id   ...                         │
 *   │    mesh_ip   ...                         │
 *   │    label     ...                         │
 *   │                                          │
 *   │  ROUTING                                 │
 *   │    hops, latency, last_seen, is_gateway  │
 *   │                                          │
 *   │  TRUST                                   │
 *   │    source                                │
 *   │                                          │
 *   │  TROUBLESHOOT                            │
 *   │    log entries                           │
 *   └──────────────────────────────────────────┘
 *
 * Phase 4 D-25 preserved: failed peers' troubleshoot log gets a docs
 * link after the reason line — same SECURITY_DOCS_URL as the PeerRow
 * sub-line.
 *
 * NO border-radius, NO gradients, NO literal palette colors.
 */

import { useEffect, useState } from "react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import {
  Sheet,
  SheetContent,
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
import { HANDSHAKE_FAIL_SUBLINE, SECURITY_DOCS_URL } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { PeerState, PeerSummary } from "@/lib/rpc-types";

const STATE_WORD_CLASS: Record<PeerState, string> = {
  active: "text-foreground",
  relayed: "text-accent",
  connecting: "text-muted-foreground",
  failed: "text-destructive",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 8);
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Section primitive — title in caps + tracking on top, content stack
 * below. Sections are separated by a subtle 1px border-t for terminal
 * rhythm; the first section drops the rule so the header below the
 * sheet chrome reads cleanly.
 */
function Section({ title, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3 pt-5 mt-5 border-t border-border first:mt-0 first:pt-0 first:border-t-0">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-secondary">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

export function PeerDetailSheet() {
  const { selected, close } = usePeerDetail();
  const [showFull, setShowFull] = useState(false);
  const log = usePeerTroubleshootLog(selected?.node_id);

  useEffect(() => {
    setShowFull(false);
  }, [selected?.node_id]);

  if (selected === null) return null;
  const peer: PeerSummary = selected;

  const failedEvent: PeerLogEntry | undefined =
    peer.state === "failed"
      ? log.find((e) => e.kind === "pair_failed")
      : undefined;

  const latencyValue =
    peer.latency_ms === null ? "—" : `${peer.latency_ms}ms`;
  const isGatewayValue = peer.is_gateway === true ? "yes (egress)" : "no";
  const trustSource =
    peer.static === true ? "configured in pim.toml" : "paired via discovery";
  const labelValue = peer.label === null ? "—" : peer.label;
  const displayName = peer.label === null ? peer.node_id_short : peer.label;

  return (
    <Sheet
      open={selected === null ? false : true}
      onOpenChange={(open) => {
        if (open === false) close();
      }}
    >
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px]"
      >
        {/* Header — display name + short_id reveal + status pill row.
            Sits inside the sheet body padding so it inherits the chrome
            clearance from the primitive. */}
        <header className="flex flex-col gap-3 pb-5 border-b border-border">
          <div className="flex flex-col gap-1.5">
            <SheetTitle>{displayName}</SheetTitle>
            <div className="font-code text-sm text-text-secondary flex items-center gap-3 flex-wrap">
              <span className="break-all">{peer.node_id_short}</span>
              <button
                type="button"
                onClick={() => setShowFull((s) => (s === true ? false : true))}
                className="font-mono text-[10px] uppercase tracking-wider text-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors duration-100 ease-linear"
              >
                [ {showFull === true ? "hide" : "show full"} ]
              </button>
            </div>
            {showFull === true ? (
              <pre className="font-code text-xs break-all text-foreground whitespace-pre-wrap mt-1 select-text">
                {peer.node_id}
              </pre>
            ) : null}
          </div>

          {/* Status pill — answers "what is this peer doing right now?"
              in a single scannable row. */}
          <div className="flex items-center gap-2 flex-wrap font-code text-sm">
            <StatusIndicator state={peer.state} />
            <span className={STATE_WORD_CLASS[peer.state]}>{peer.state}</span>
            <span className="text-text-secondary">·</span>
            <span className="text-text-secondary">{peer.transport}</span>
            {peer.latency_ms === null ? null : (
              <>
                <span className="text-text-secondary">·</span>
                <span className="text-text-secondary tabular-nums">
                  {peer.latency_ms}ms
                </span>
              </>
            )}
            <span className="text-text-secondary">·</span>
            <span className="text-text-secondary tabular-nums">
              {peer.last_seen_s}s ago
            </span>
            {peer.is_gateway === true ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary border border-primary/60 px-1 py-px shrink-0">
                gateway
              </span>
            ) : null}
            {peer.static === true ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary border border-border px-1 py-px shrink-0">
                static
              </span>
            ) : null}
          </div>
        </header>

        <Section title="identity">
          <KvRow label="node_id" value={peer.node_id} copyable />
          <KvRow label="mesh_ip" value={peer.mesh_ip} />
          <KvRow label="label" value={labelValue} />
        </Section>

        <Section title="routing">
          <KvRow label="hops" value={String(peer.route_hops)} />
          <KvRow label="latency" value={latencyValue} />
          <KvRow label="last_seen" value={`${formatDuration(peer.last_seen_s)} ago`} />
          <KvRow label="is_gateway" value={isGatewayValue} />
        </Section>

        <Section title="trust">
          <KvRow label="source" value={trustSource} />
        </Section>

        <Section title="troubleshoot log">
          {log.length === 0 ? (
            <p className="font-code text-sm text-text-secondary">
              No events recorded this session
            </p>
          ) : (
            <ul
              role="list"
              className="font-code text-sm leading-[1.7] flex flex-col gap-0.5"
            >
              {failedEvent === undefined ? null : (
                <li className="pb-2 mb-2 border-b border-border flex flex-col gap-1">
                  <div>
                    <span className="text-text-secondary">
                      {formatTime(failedEvent.at)}
                    </span>{" "}
                    <span className="text-destructive">✗ pair_failed</span>{" "}
                    <span className="text-destructive">
                      reason: {failedEvent.reason === undefined ? "unknown" : failedEvent.reason}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void shellOpen(SECURITY_DOCS_URL);
                    }}
                    className="text-left font-code text-xs text-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors duration-100 ease-linear"
                    aria-label="open security docs section 3.2"
                  >
                    {HANDSHAKE_FAIL_SUBLINE}
                  </button>
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
                    <span className="text-text-secondary">
                      {formatTime(e.at)}
                    </span>
                    <span>{e.kind}</span>
                    {e.reason === undefined || e.reason === "" ? null : (
                      <span className="text-text-secondary">{e.reason}</span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Section>
      </SheetContent>
    </Sheet>
  );
}
