/**
 * <NearbyPanel /> — the Nearby CliPanel on the Dashboard (02-UI-SPEC §Nearby
 * panel, 02-CONTEXT D-19/D-20).
 *
 * Honesty contract:
 *   - Panel is ALWAYS visible even when the discovered list is empty —
 *     the UI must preserve the user's mental model of "the app is
 *     listening for peers" (D-19). Empty state renders the D-19 verbatim
 *     copy: `no devices discovered yet · discovery is active`.
 *   - Panel title (CliPanel uppercases internally): `nearby — not paired`
 *     (em-dash U+2014, NOT double hyphen) — renders as
 *     `NEARBY — NOT PAIRED`.
 *   - Badge reads `[SCANNING]` when the list is empty, `[{n} NEARBY]`
 *     otherwise.
 *
 * D-30 limited mode: panel dims to opacity-60; badge flips to muted.
 *
 * NO border-radius, NO gradients, NO literal Tailwind palette colors,
 * NO exclamation marks.
 */

import type { PeerDiscovered } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { NearbyRow } from "./nearby-row";
import { cn } from "@/lib/utils";

export interface NearbyPanelProps {
  discovered: PeerDiscovered[];
  onPair?: (d: PeerDiscovered) => void;
  limitedMode?: boolean;
}

export function NearbyPanel({
  discovered,
  onPair,
  limitedMode = false,
}: NearbyPanelProps) {
  const isEmpty = discovered.length === 0;
  const badgeLabel = isEmpty === true ? "SCANNING" : `${discovered.length} NEARBY`;
  const badge = limitedMode === true
    ? { label: badgeLabel, variant: "muted" as const }
    : { label: badgeLabel, variant: "default" as const };

  return (
    <CliPanel
      title="nearby — not paired"
      status={badge}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {isEmpty === true ? (
        <p className="px-4 py-2 text-muted-foreground">
          no devices discovered yet · discovery is active
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border/30">
          {discovered.map((d) => (
            <li key={`${d.address}:${d.mechanism}`}>
              <NearbyRow discovered={d} onPair={onPair} />
            </li>
          ))}
        </ul>
      )}
    </CliPanel>
  );
}
