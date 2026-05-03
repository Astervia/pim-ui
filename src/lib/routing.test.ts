/**
 * Compile-time + load-time tests for `src/lib/routing.ts`.
 *
 * Pattern: matches `format.test.ts` and `copy.test.ts` — no vitest, no
 * runtime test framework. tsc validates types; the `_runtimeChecks`
 * function is declared but only invoked under `if (false)` so production
 * builds skip it. To run the assertions during dev, switch to
 * `if (true)` and run `pnpm tsx src/lib/routing.test.ts`.
 *
 * Coverage:
 *   formatRouteLine (D-14):
 *     A: gateway direct, labeled                       → "Routing through gateway-c"
 *     B: gateway via relay, gateway label fallback     → "Routing through gateway-{8} (via relay-b)"
 *     C: gateway labeled + relay labeled, multi-hop    → "Routing through gateway-c (via relay-b)"
 *     D: no peer record for selected_gateway           → "Routing through gateway-{8}"
 *     E: route_on === false                            → null
 *     F: status === null                               → null
 *
 *   derivePreflight (D-12):
 *     G: all pass                                      → ok=true, 3 rows
 *     H: interface down                                → row 0 fail with template-interpolated msg
 *     I: no gateway                                    → row 1 fail, PREFLIGHT_NO_GATEWAY
 *     J: status === null                               → ok=false, rows=[]
 */

import { formatRouteLine, derivePreflight } from "./routing";
import type { Status, RouteTableResult, PeerSummary } from "./rpc-types";

// Compile-only return-type pins.
const _line1: string | null = formatRouteLine(null, null);
const _pre1: ReturnType<typeof derivePreflight> = derivePreflight(null);
void _line1;
void _pre1;

/** Build a fully-typed PeerSummary with sensible defaults. */
function makePeer(o: Partial<PeerSummary> & { node_id: string }): PeerSummary {
  return {
    node_id: o.node_id,
    node_id_short: o.node_id_short ?? o.node_id.slice(0, 8),
    label: o.label ?? null,
    mesh_ip: o.mesh_ip ?? "10.77.0.5/24",
    transport: o.transport ?? "tcp",
    state: o.state ?? "active",
    route_hops: o.route_hops ?? 1,
    last_seen_s: o.last_seen_s ?? 0,
    latency_ms: o.latency_ms === undefined ? 12 : o.latency_ms,
    is_gateway: o.is_gateway ?? false,
    static: o.static ?? false,
    x25519_pubkey: o.x25519_pubkey ?? null,
  };
}

/** Build a fully-typed Status with sensible defaults. */
function makeStatus(o: Partial<Status>): Status {
  return {
    node: o.node ?? "client-a",
    node_id: o.node_id ?? "0000000000000000000000000000000000000000000000000000000000000000",
    node_id_short: o.node_id_short ?? "00000000",
    x25519_pubkey:
      o.x25519_pubkey ??
      "0000000000000000000000000000000000000000000000000000000000000000",
    mesh_ip: o.mesh_ip ?? "10.77.0.100/24",
    interface: o.interface ?? { name: "pim0", up: true, mtu: 1280 },
    role: o.role ?? ["client"],
    transport: o.transport ?? { tcp: { port: 7777 } },
    peers: o.peers ?? [],
    routes:
      o.routes ?? { active: 0, expired: 0, selected_gateway: null },
    stats:
      o.stats ?? {
        forwarded_bytes: 0,
        forwarded_packets: 0,
        dropped: 0,
        dropped_reason: null,
        congestion_drops: 0,
        conntrack_size: 0,
      },
    uptime_s: o.uptime_s ?? 0,
    route_on: o.route_on ?? false,
    started_at: o.started_at ?? "2026-04-26T00:00:00Z",
  };
}

function assertEq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`routing.test ${label}: expected ${e}, got ${a}`);
  }
}

function _runtimeChecks(): void {
  // ── Test A: gateway direct, labeled ────────────────────────────────
  {
    const s = makeStatus({
      route_on: true,
      routes: { active: 1, expired: 0, selected_gateway: "g1deadbeef" },
      peers: [
        makePeer({
          node_id: "g1deadbeef",
          label: "gateway-c",
          state: "active",
          route_hops: 1,
          latency_ms: 12,
          is_gateway: true,
        }),
      ],
    });
    assertEq(formatRouteLine(s, null), "Routing through gateway-c", "A");
  }

  // ── Test B: gateway via relay, gateway label fallback ──────────────
  // peer "g1" has NO label → falls back to gateway-{first-8}.
  {
    const s = makeStatus({
      route_on: true,
      routes: { active: 1, expired: 0, selected_gateway: "g1deadbeefXXXX" },
      peers: [
        makePeer({
          node_id: "g1deadbeefXXXX",
          label: null,
          state: "active",
          route_hops: 2,
          is_gateway: true,
        }),
        makePeer({ node_id: "r1aaaaaaaaaaaa", label: "relay-b" }),
      ],
    });
    const rt: RouteTableResult = {
      routes: [
        {
          destination: "internet",
          via: "r1aaaaaaaaaaaa",
          hops: 2,
          learned_from: "g1deadbeefXXXX",
          is_gateway: true,
          load: 0,
          age_s: 0,
        },
      ],
      gateways: [],
    };
    assertEq(
      formatRouteLine(s, rt),
      "Routing through gateway-g1deadbe (via relay-b)",
      "B",
    );
  }

  // ── Test C: gateway labeled + relay labeled, multi-hop ─────────────
  {
    const s = makeStatus({
      route_on: true,
      routes: { active: 1, expired: 0, selected_gateway: "g1xxxxxxxx" },
      peers: [
        makePeer({
          node_id: "g1xxxxxxxx",
          label: "gateway-c",
          state: "relayed",
          route_hops: 2,
          is_gateway: true,
        }),
        makePeer({ node_id: "r1yyyyyyyy", label: "relay-b" }),
      ],
    });
    const rt: RouteTableResult = {
      routes: [
        {
          destination: "internet",
          via: "r1yyyyyyyy",
          hops: 2,
          learned_from: "g1xxxxxxxx",
          is_gateway: true,
          load: 0,
          age_s: 0,
        },
      ],
      gateways: [],
    };
    assertEq(
      formatRouteLine(s, rt),
      "Routing through gateway-c (via relay-b)",
      "C",
    );
  }

  // ── Test D: no peer record for selected_gateway ────────────────────
  // peers=[], routeTable=null → fallback gateway-{first-8}, no via.
  {
    const s = makeStatus({
      route_on: true,
      routes: { active: 1, expired: 0, selected_gateway: "x9deadbeef99" },
      peers: [],
    });
    assertEq(
      formatRouteLine(s, null),
      "Routing through gateway-x9deadbe",
      "D",
    );
  }

  // ── Test E: route_on === false ─────────────────────────────────────
  {
    const s = makeStatus({
      route_on: false,
      routes: { active: 1, expired: 0, selected_gateway: "g1deadbeef" },
    });
    assertEq(formatRouteLine(s, null), null, "E");
  }

  // ── Test F: status === null ────────────────────────────────────────
  {
    assertEq(formatRouteLine(null, null), null, "F");
  }

  // ── Test G: derivePreflight, all pass ──────────────────────────────
  {
    const s = makeStatus({
      route_on: true,
      interface: { name: "pim0", up: true, mtu: 1280 },
      routes: { active: 1, expired: 0, selected_gateway: "g1deadbeef" },
      peers: [
        makePeer({
          node_id: "g1deadbeef",
          label: "gateway-c",
          state: "active",
          latency_ms: 12,
        }),
      ],
    });
    const r = derivePreflight(s);
    assertEq(r.ok, true, "G.ok");
    assertEq(r.rows[0], { ok: true, msg: "interface up (pim0)" }, "G.row0");
    assertEq(
      r.rows[1],
      { ok: true, msg: "gateway reachable (gateway-c · 12ms)" },
      "G.row1",
    );
    assertEq(
      r.rows[2],
      { ok: true, msg: "split-default routing supported" },
      "G.row2",
    );
  }

  // ── Test H: interface down ─────────────────────────────────────────
  {
    const s = makeStatus({
      interface: { name: "pim0", up: false, mtu: 1280 },
    });
    const r = derivePreflight(s);
    assertEq(r.ok, false, "H.ok");
    assertEq(r.rows[0]?.ok, false, "H.row0.ok");
    assertEq(
      r.rows[0]?.msg,
      "interface pim0 is down · check transport logs",
      "H.row0.msg",
    );
  }

  // ── Test I: no gateway ─────────────────────────────────────────────
  {
    const s = makeStatus({
      interface: { name: "pim0", up: true, mtu: 1280 },
      routes: { active: 0, expired: 0, selected_gateway: null },
      peers: [],
    });
    const r = derivePreflight(s);
    assertEq(r.ok, false, "I.ok");
    assertEq(r.rows[1]?.ok, false, "I.row1.ok");
    assertEq(
      r.rows[1]?.msg,
      "no gateway is advertising itself · pair with a gateway-capable peer or run pim on a Linux device",
      "I.row1.msg",
    );
  }

  // ── Test J: status === null ────────────────────────────────────────
  {
    const r = derivePreflight(null);
    assertEq(r.ok, false, "J.ok");
    assertEq(r.rows, [], "J.rows");
  }

  // eslint-disable-next-line no-console
  console.log("routing.test passed");
}

if (false as boolean) {
  _runtimeChecks();
}

void _runtimeChecks;
