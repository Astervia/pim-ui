/**
 * <NearbyRow /> — a single nearby-but-unpaired peer row in the Nearby
 * panel (02-UI-SPEC §Nearby panel, 02-CONTEXT D-19/D-20).
 *
 * Row shape (verbatim):
 *   {label_announced ?? "anonymous"}  {short_id ?? "(no id)"}  via {mechanism}
 *   first seen {first_seen_s}s ago  [optional [ Pair ] button]
 *
 * D-20 anonymity rule:
 *   - When `node_id === null` the row has NO Pair action affordance —
 *     the right-hand cell is empty. Rationale: pairing with an anonymous
 *     announcement requires a trust decision we intentionally don't
 *     solicit in Phase 2; deferred to a later phase.
 *   - The fallback label is `anonymous` and the fallback id is `(no id)`.
 *
 * NO border-radius, NO gradients, NO literal Tailwind palette colors,
 * NO exclamation marks.
 */

import type { PeerDiscovered } from "@/lib/rpc-types";
import { Button } from "@/components/ui/button";
import { formatShortId } from "@/lib/format";

export interface NearbyRowProps {
  discovered: PeerDiscovered;
  /** Plan 02-04 wires this to open the outbound Pair modal. */
  onPair?: (d: PeerDiscovered) => void;
}

export function NearbyRow({ discovered, onPair }: NearbyRowProps) {
  const label =
    discovered.label_announced === null
      ? "anonymous"
      : discovered.label_announced;
  const shortId =
    discovered.node_id === null ? "(no id)" : formatShortId(discovered.node_id);
  const isAnonymous = discovered.node_id === null;

  const handlePair = () => {
    if (onPair === undefined) return;
    onPair(discovered);
  };

  return (
    <div className="grid grid-cols-[1fr_10ch_14ch_1fr_auto] items-center gap-x-2 px-4 py-2.5 font-code text-sm">
      <span>{label}</span>
      <span className="text-muted-foreground">{shortId}</span>
      <span className="text-muted-foreground">via {discovered.mechanism}</span>
      <span className="text-muted-foreground">
        first seen {discovered.first_seen_s}s ago
      </span>
      {isAnonymous === true ? (
        // D-20: anonymous rows render NO Pair affordance.
        <span />
      ) : (
        <Button variant="default" size="sm" onClick={handlePair}>
          [ Pair ]
        </Button>
      )}
    </div>
  );
}
