/**
 * Phase 4 routing pure helpers.
 *
 * Decision authority:
 *   - D-12 (pre-flight derivation rows: interface up · gateway reachable
 *           · split-default supported)
 *   - D-14 (runtime "Routing through {gateway} (via {first-hop})" line
 *           assembly)
 *
 * These are pure functions — no React, no RPC, no listeners. They
 * consume `Status` + `RouteTableResult` shapes from `./rpc-types` (the
 * existing wire types) and return a string or a `PreflightResult`.
 *
 * Bang-free per D-36: every conditional uses `=== false` / `=== null`
 * instead of the JS negation operator. The audit script
 * (scripts/audit-copy.mjs) does NOT fault `!=` / `!==` operators — only
 * exclamation inside string literals — but Phase 2 D-policy (carried
 * forward) keeps the source bang-free as a stronger invariant.
 *
 * W1 invariant preserved: this file does NOT subscribe to anything.
 * `grep -c 'listen(' src/lib/rpc.ts` stays 0; `grep -c 'listen('
 * src/hooks/use-daemon-state.ts` stays 2.
 */

import type { Status, RouteTableResult, PeerSummary } from "./rpc-types";
import {
  PREFLIGHT_INTERFACE_UP_TEMPLATE,
  PREFLIGHT_GATEWAY_REACHABLE_TEMPLATE,
  PREFLIGHT_SPLIT_DEFAULT_SUPPORTED,
  PREFLIGHT_INTERFACE_DOWN_TEMPLATE,
  PREFLIGHT_NO_GATEWAY,
} from "./copy";

export interface PreflightRow {
  ok: boolean;
  msg: string;
}

export interface PreflightResult {
  /** True iff every row passes. */
  ok: boolean;
  /** Exactly 3 rows in fixed order: interface, gateway, split-default. */
  rows: PreflightRow[];
}

/**
 * Resolve the gateway label per D-14:
 *  - peer.label if the selected gateway has a peer record with a label
 *  - else `gateway-{first-8-of-node-id}` fallback
 */
function gatewayLabelFor(
  selectedGatewayId: string,
  gwPeer: PeerSummary | null,
): string {
  if (gwPeer !== null && gwPeer.label !== null) return gwPeer.label;
  return `gateway-${selectedGatewayId.slice(0, 8)}`;
}

/**
 * Resolve the relay label per D-14:
 *  - peer.label if the via peer has a peer record with a label
 *  - else `relay-{first-8-of-via-id}` fallback
 *  - else `relay-?` (defensive — should not happen in v1)
 */
function relayLabelFor(
  firstHopId: string | null,
  hopPeer: PeerSummary | null,
): string {
  if (hopPeer !== null && hopPeer.label !== null) return hopPeer.label;
  if (firstHopId !== null) return `relay-${firstHopId.slice(0, 8)}`;
  return "relay-?";
}

/**
 * D-14: pure assembly of the runtime line.
 *
 * Returns:
 *   - `null` when status is null OR `route_on === false` OR
 *     `selected_gateway === null` (no line should be displayed).
 *   - `Routing through {gateway-label}` when the gateway is direct
 *     (single-hop, or routeTable says so, or no routeTable info).
 *   - `Routing through {gateway-label} (via {first-hop-label})` when
 *     the gateway is multi-hop and a `via` peer is identifiable.
 *
 * The function tolerates a missing peer record (label fallback) and a
 * missing route table (no parenthetical). It never throws.
 */
export function formatRouteLine(
  status: Status | null,
  routeTable: RouteTableResult | null,
): string | null {
  if (status === null) return null;
  if (status.route_on === false) return null;

  const sel = status.routes.selected_gateway;
  if (sel === null) return null;

  const gwPeer: PeerSummary | null =
    status.peers.find((p) => p.node_id === sel) ?? null;
  const gatewayLabel = gatewayLabelFor(sel, gwPeer);

  // First-hop derivation: scan routeTable for a route entry that
  // names the path to internet OR is flagged as the gateway route.
  let firstHopId: string | null = null;
  if (routeTable !== null) {
    const internetRoute = routeTable.routes.find(
      (r) => r.destination === "internet" || r.is_gateway === true,
    );
    if (internetRoute !== undefined) {
      firstHopId = internetRoute.via;
    }
  }

  // Direct gateway (single-hop). Three signals — any one means no
  // parenthetical:
  //   1. no routeTable info at all (firstHopId === null)
  //   2. the route's `via` IS the selected gateway (firstHopId === sel)
  //   3. the gateway peer record says route_hops <= 1
  if (firstHopId === null) {
    return `Routing through ${gatewayLabel}`;
  }
  if (firstHopId === sel) {
    return `Routing through ${gatewayLabel}`;
  }
  if (gwPeer !== null && gwPeer.route_hops <= 1) {
    return `Routing through ${gatewayLabel}`;
  }

  // Multi-hop: render the relay parenthetical.
  const hopPeer: PeerSummary | null =
    status.peers.find((p) => p.node_id === firstHopId) ?? null;
  const hopLabel = relayLabelFor(firstHopId, hopPeer);
  return `Routing through ${gatewayLabel} (via ${hopLabel})`;
}

/**
 * D-12: pure derivation of the three pre-flight rows. Each row is
 * computed in <50 ms (no network, no RPC) from the existing snapshot.
 *
 * Returns three rows in fixed order:
 *   [0] interface-up — `status.interface.up === true`
 *   [1] gateway-reachable — selected_gateway is set, has a peer record,
 *                            and that peer's state is "active" or "relayed"
 *   [2] split-default-supported — compile-time guarantee in v1
 *
 * Failing rows render with the failure-copy template from `copy.ts`
 * (PREFLIGHT_INTERFACE_DOWN_TEMPLATE / PREFLIGHT_NO_GATEWAY). The
 * split-default row never fails in v1 because `route.set_split_default`
 * is in `RpcMethodMap` at compile time.
 *
 * When `status === null`, returns `{ ok: false, rows: [] }` —
 * callers should display "loading" copy in that case, not the table.
 */
export function derivePreflight(status: Status | null): PreflightResult {
  if (status === null) return { ok: false, rows: [] };

  // Row 1: interface up.
  const ifaceOk = status.interface.up === true;
  const ifaceMsg = ifaceOk
    ? PREFLIGHT_INTERFACE_UP_TEMPLATE.replace(
        "{iface_name}",
        status.interface.name,
      )
    : PREFLIGHT_INTERFACE_DOWN_TEMPLATE.replace(
        "{iface_name}",
        status.interface.name,
      );

  // Row 2: gateway reachable.
  //
  // Two acceptance paths — both must end with an active/relayed peer
  // that has been advertised as a gateway:
  //
  //   (a) `routes.selected_gateway` is set AND points to an active peer.
  //       This is the daemon's authoritative pick — present once route
  //       updates have propagated and the split-default selector has
  //       run.
  //
  //   (b) Fallback: at least one connected peer has `is_gateway === true`
  //       and an active/relayed state. The daemon may not yet have
  //       picked a `selected_gateway` (first connect, brief gap between
  //       handshake and the first RouteUpdate, etc.) but the user can
  //       legitimately see a gateway-capable peer in the peer list and
  //       expect the pre-flight to acknowledge it.
  //
  // Without (b), the pre-flight contradicts the visible peer state —
  // the user sees "1 CONNECTED" with `is_gateway: yes` but the
  // checklist still says "no gateway is advertising itself".
  const sel = status.routes.selected_gateway;
  const selPeer: PeerSummary | null =
    sel === null
      ? null
      : (status.peers.find((p) => p.node_id === sel) ?? null);
  const selOk =
    sel !== null
    && selPeer !== null
    && (selPeer.state === "active" || selPeer.state === "relayed");

  const fallbackPeer: PeerSummary | null =
    selOk === true
      ? null
      : (status.peers.find(
          (p) =>
            p.is_gateway === true
            && (p.state === "active" || p.state === "relayed"),
        ) ?? null);

  const gatewayOk = selOk === true || fallbackPeer !== null;
  const displayPeer: PeerSummary | null =
    selOk === true ? selPeer : fallbackPeer;
  const displayId: string | null =
    sel !== null && selOk === true
      ? sel
      : displayPeer === null
        ? null
        : displayPeer.node_id;

  const gatewayMsg =
    gatewayOk === true && displayPeer !== null && displayId !== null
      ? PREFLIGHT_GATEWAY_REACHABLE_TEMPLATE.replace(
          "{label}",
          displayPeer.label === null
            ? `gateway-${displayId.slice(0, 8)}`
            : displayPeer.label,
        ).replace(
          "{latency}",
          displayPeer.latency_ms === null
            ? "?"
            : String(displayPeer.latency_ms),
        )
      : PREFLIGHT_NO_GATEWAY;

  // Row 3: split-default routing supported. Compile-time guarantee in
  // v1 — `route.set_split_default` is in RpcMethodMap. The row exists
  // for Mira's reassurance; it never fails in v1.
  const splitOk = true;
  const splitMsg = PREFLIGHT_SPLIT_DEFAULT_SUPPORTED;

  const rows: PreflightRow[] = [
    { ok: ifaceOk, msg: ifaceMsg },
    { ok: gatewayOk, msg: gatewayMsg },
    { ok: splitOk, msg: splitMsg },
  ];
  return { ok: rows.every((r) => r.ok === true), rows };
}
