/**
 * Phase 6 Plan 06-05 — pure-function tests for `computeRelayContribution`.
 *
 * The hook is a one-line selector over the pure derivation, so pinning
 * the pure function covers every interesting path without spinning up
 * the React renderer or stubbing useStatus / useRouteTable.
 */

import { describe, expect, it } from "vitest";
import type { RouteTableResult, Status } from "@/lib/rpc-types";
import { computeRelayContribution } from "./use-relay-contribution";

function buildStatus(overrides: Partial<Status> = {}): Status {
  return {
    node: "test-node",
    node_id: "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
    node_id_short: "aaaa",
    x25519_pubkey:
      "1111111111111111111111111111111111111111111111111111111111111111",
    mesh_ip: "10.77.0.1/24",
    interface: { name: "pim0", up: true, mtu: 1400 },
    role: ["client", "relay"],
    transport: { tcp: { port: 9100 } },
    peers: [],
    routes: { active: 0, expired: 0, selected_gateway: null },
    stats: {
      forwarded_bytes: 0,
      forwarded_packets: 0,
      dropped: 0,
      dropped_reason: null,
      congestion_drops: 0,
      conntrack_size: 0,
    },
    uptime_s: 0,
    route_on: false,
    started_at: "2026-04-29T18:00:00Z",
    ...overrides,
  };
}

function buildTable(routes: RouteTableResult["routes"]): RouteTableResult {
  return { routes, gateways: [] };
}

describe("computeRelayContribution", () => {
  it("reports loading=true when status is null", () => {
    expect(computeRelayContribution(null, null)).toEqual({
      active: false,
      peersViaMe: 0,
      packetsForwarded: 0,
      bytesForwarded: 0,
      loading: true,
    });
  });

  it("derives active=true when role includes relay", () => {
    const status = buildStatus({ role: ["client", "relay"] });
    const r = computeRelayContribution(status, null);
    expect(r.active).toBe(true);
    expect(r.loading).toBe(false);
  });

  it("derives active=true when role is the gateway superset", () => {
    const status = buildStatus({ role: ["client", "relay", "gateway"] });
    expect(computeRelayContribution(status, null).active).toBe(true);
  });

  it("derives active=false for client-only role", () => {
    const status = buildStatus({ role: ["client"] });
    const r = computeRelayContribution(status, null);
    expect(r.active).toBe(false);
    expect(r.peersViaMe).toBe(0);
  });

  it("counts distinct destinations whose `via` matches our node_id", () => {
    const ourId = "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
    const status = buildStatus({ node_id: ourId });
    const table = buildTable([
      // Two destinations through us — counts as 2.
      {
        destination: "10.77.0.10",
        via: ourId,
        hops: 1,
        learned_from: "peer1",
        is_gateway: false,
        load: 5,
        age_s: 1,
      },
      {
        destination: "10.77.0.20",
        via: ourId,
        hops: 2,
        learned_from: "peer2",
        is_gateway: false,
        load: 5,
        age_s: 1,
      },
      // Same destination twice — must dedupe.
      {
        destination: "10.77.0.10",
        via: ourId,
        hops: 1,
        learned_from: "peer3",
        is_gateway: false,
        load: 5,
        age_s: 1,
      },
      // A route that does NOT use us as the next hop — must be ignored.
      {
        destination: "10.77.0.30",
        via: "someone-else",
        hops: 1,
        learned_from: "peer1",
        is_gateway: false,
        load: 5,
        age_s: 1,
      },
    ]);
    expect(computeRelayContribution(status, table).peersViaMe).toBe(2);
  });

  it("returns peersViaMe=0 when route table is null", () => {
    const status = buildStatus();
    expect(computeRelayContribution(status, null).peersViaMe).toBe(0);
  });

  it("propagates forwarded counters from Status.stats", () => {
    const status = buildStatus({
      stats: {
        forwarded_bytes: 12_345,
        forwarded_packets: 67,
        dropped: 0,
        dropped_reason: null,
        congestion_drops: 0,
        conntrack_size: 0,
      },
    });
    const r = computeRelayContribution(status, null);
    expect(r.bytesForwarded).toBe(12_345);
    expect(r.packetsForwarded).toBe(67);
  });
});
