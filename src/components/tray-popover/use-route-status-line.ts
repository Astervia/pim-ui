/**
 * useRouteStatusLine — TBD-PHASE-4-B selector.
 *
 * 05-CONTEXT D-19 row 4: the popover's second row is "Routing through
 * gateway-c (via relay-b)" once Phase 4 ROUTE-02 lands. Until then we
 * fall back to the existing Phase-2 selected_gateway data:
 *   "egress: {selected_gateway ?? 'local'}"
 *
 * Phase 4 will replace this hook with one that reads
 * snapshot.status.routes.selected_gateway resolution + the relay chain.
 */

import { useStatus } from "@/hooks/use-status";

export function useRouteStatusLine(): string {
  const status = useStatus();
  // TBD-PHASE-4-B: Phase 4 ROUTE-02 replaces with full hop-chain
  // "Routing through gateway-c (via relay-b)" — for now we emit the
  // honest egress field already populated by Phase 2.
  const egress = status?.routes.selected_gateway ?? "local";
  return `egress: ${egress}`;
}
