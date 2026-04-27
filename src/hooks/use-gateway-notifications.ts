/**
 * GatewayNotificationsListener — single subscriber to status.event +
 * peers.event + gateway.event per 05-CONTEXT D-31. Mounted ONCE at
 * AppShell level (D-31 — per-screen mounts would duplicate the
 * dispatcher).
 *
 * Reads policy.getChannelFor(eventKey) and dispatches to:
 *   - sonner toast (TOAST_COPY templates)
 *   - tauri-plugin-notification (SYSTEM_COPY templates)
 *   - both (toast + system)
 *
 * W1 invariant preserved: this hook subscribes via actions.subscribe
 * (the W1 fan-out from useDaemonState). It does NOT call
 * `listen(...)` from @tauri-apps/api/event — daemon events flow
 * through the existing single Tauri listener inside use-daemon-state.ts.
 *
 * Synthesizes "all gateways lost" per RESEARCH §14 question 7:
 *   When status.event { kind: "gateway_lost" } AND
 *   snapshot.status.routes.selected_gateway === null AND
 *   previous_selected_gateway is non-null (we lost a gateway, not "none was set"),
 *   fire the synthesized event.
 *
 * The daemon may emit only per-gateway gateway_lost events; the UI
 * reconstructs the "all lost" condition by tracking the previous
 * selected_gateway in a useRef and checking the current snapshot for
 * a null after the lost event arrives.
 *
 * TBD-PHASE-4-C: kill_switch consumer — Phase 4 wires the in-app
 * <KillSwitchBanner /> via UX-03 (already shipped in Plan 04-06);
 * Phase 5 owns the OS notification path. The marker stays so the
 * Plan 05-07 audit grep is deterministic and so a future audit can
 * locate every kill-switch escalation site.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useSystemNotifications } from "@/hooks/use-system-notifications";
import {
  getChannelFor,
  TOAST_COPY,
  SYSTEM_COPY,
  type NotificationChannel,
} from "@/lib/notifications/policy";
import type {
  GatewayEvent,
  PeerEvent,
  PeerSummary,
  StatusEvent,
} from "@/lib/rpc-types";
import type { DaemonSubscription } from "@/lib/rpc";

export function GatewayNotificationsListener() {
  const { actions, snapshot } = useDaemonState();
  const { send: sendSystem } = useSystemNotifications();

  // Track previous gateway so all-gateways-lost synthesis is correct.
  // We compare the current selected_gateway against the previous value
  // when a gateway_lost event arrives — if both we just had a gateway
  // and now we have none, the mesh has fully lost egress.
  const previousGatewayRef = useRef<string | null>(null);

  useEffect(() => {
    previousGatewayRef.current = snapshot.status?.routes.selected_gateway ?? null;
  }, [snapshot.status?.routes.selected_gateway]);

  // Cache the latest snapshot in a ref so the subscription handlers
  // (which only run once per mount) can read fresh values without
  // re-subscribing on every render.
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    let aliveStatus: DaemonSubscription | null = null;
    let alivePeers: DaemonSubscription | null = null;
    let aliveGateway: DaemonSubscription | null = null;

    function dispatch(
      channel: NotificationChannel,
      toastBody: string | null,
      systemPayload: { title: string; body: string } | null,
    ) {
      if (channel === "silent") return;
      if ((channel === "toast" || channel === "both") && toastBody === null) {
        // skip toast — null body indicates no in-app surface for this event
      } else if (channel === "toast" || channel === "both") {
        toast(toastBody as string, { className: "font-mono" });
      }
      if ((channel === "system" || channel === "both") && systemPayload === null) {
        // skip system — null payload indicates no OS surface for this event
      } else if (channel === "system" || channel === "both") {
        void sendSystem(systemPayload as { title: string; body: string });
      }
    }

    (async () => {
      aliveStatus = await actions.subscribe("status.event", (evt: StatusEvent) => {
        // status.event:kill_switch sub-keyed by detail.engaged
        if (evt.kind === "kill_switch") {
          const engaged = (evt.detail as { engaged?: boolean } | undefined)?.engaged === true;
          if (engaged === true) {
            // TBD-PHASE-4-C: Phase 4 ships the in-app <KillSwitchBanner />
            // via UX-03 (Plan 04-06 already landed); Plan 05-06 owns the
            // OS notification + the toast variant of the `both` channel.
            const channel = getChannelFor("status.event:kill_switch:engaged"); // "both"
            dispatch(channel, TOAST_COPY.killSwitchEngageToast(), SYSTEM_COPY.killSwitchEngageSystem());
          } else {
            const channel = getChannelFor("status.event:kill_switch:disengaged"); // "toast"
            dispatch(channel, TOAST_COPY.killSwitchDisengage(), null);
          }
          return;
        }

        if (evt.kind === "gateway_lost") {
          // Failover detection: if a NEW gateway was selected, the corresponding
          // gateway_selected event will fire alongside; we ride only one event,
          // so use the simpler "gateway_lost" channel (toast).
          // RESEARCH §14 question 7 synthesis — all-gateways-lost when:
          //   selected_gateway === null AND prev is non-null
          // (route_on field check omitted because all-gateways-lost is a
          // critical signal whether or not split-default routing is on —
          // a relayed peer also lost its egress)
          const sel = snapshotRef.current.status?.routes.selected_gateway ?? null;
          const prev = previousGatewayRef.current;
          const hadGateway = prev === null ? false : true;
          const allLost = sel === null && hadGateway === true;
          if (allLost === true) {
            // synthesized:all_gateways_lost → "system" per D-33; we also
            // surface the toast for the in-window user.
            const channel = getChannelFor("synthesized:all_gateways_lost"); // "system"
            dispatch(channel, TOAST_COPY.allGatewaysLostToast(), SYSTEM_COPY.allGatewaysLostSystem());
          } else {
            const channel = getChannelFor("status.event:gateway_lost"); // "toast"
            // Failover semantics — for now the toast template needs both
            // gateway names; we synthesize "old → new" if we can detect
            // them from the snapshot, otherwise show a generic line.
            const toastBody = TOAST_COPY.gatewayFailover(sel ?? "—", prev ?? "—");
            dispatch(channel, toastBody, null);
          }
          return;
        }

        if (evt.kind === "interface_down") {
          const detail = evt.detail as { interface?: string } | undefined;
          const iface = detail?.interface ?? "—";
          const channel = getChannelFor("status.event:interface_down"); // "toast"
          dispatch(channel, TOAST_COPY.interfaceDown(iface), null);
          return;
        }

        if (evt.kind === "role_changed") {
          const detail = evt.detail as { role?: string } | undefined;
          const role = detail?.role ?? "—";
          const channel = getChannelFor("status.event:role_changed"); // "toast"
          dispatch(channel, TOAST_COPY.roleChanged(role), null);
          return;
        }

        // gateway_selected, route_on, route_off, interface_up → silent (default)
      });

      alivePeers = await actions.subscribe("peers.event", (evt: PeerEvent) => {
        if (evt.kind === "connected") {
          const peer = evt.peer as PeerSummary;
          const label = peer.label ?? null;
          const shortId = peer.node_id_short ?? "—";
          const channel = getChannelFor("peers.event:connected"); // "toast"
          dispatch(channel, TOAST_COPY.peerConnected(label, shortId), null);
          return;
        }
        if (evt.kind === "pair_failed") {
          const peer = evt.peer as PeerSummary;
          const label = peer.label ?? null;
          const shortId = peer.node_id_short ?? "—";
          const channel = getChannelFor("peers.event:pair_failed"); // "toast"
          dispatch(channel, TOAST_COPY.pairFailed(label, shortId), null);
          return;
        }
        // disconnected, discovered, state_changed → silent (default)
      });

      aliveGateway = await actions.subscribe("gateway.event", (evt: GatewayEvent) => {
        if (evt.kind === "enabled") {
          const detail = evt.detail as { nat_interface?: string } | undefined;
          const iface = detail?.nat_interface ?? "—";
          const channel = getChannelFor("gateway.event:enabled"); // "toast"
          dispatch(channel, TOAST_COPY.gatewayEnabled(iface), null);
          return;
        }
        if (evt.kind === "disabled") {
          const channel = getChannelFor("gateway.event:disabled"); // "toast"
          dispatch(channel, TOAST_COPY.gatewayDisabled(), null);
          return;
        }
        if (evt.kind === "conntrack_pressure") {
          const detail = evt.detail as { level?: number; pct?: number } | undefined;
          const level = detail?.level ?? 1;
          const pct = detail?.pct ?? 0;
          if (level === 2) {
            const channel = getChannelFor("gateway.event:conntrack_pressure:2"); // "system"
            dispatch(channel, TOAST_COPY.conntrackSaturatedToast(), SYSTEM_COPY.conntrackSaturatedSystem());
          } else {
            const channel = getChannelFor("gateway.event:conntrack_pressure:1"); // "toast"
            dispatch(channel, TOAST_COPY.conntrackNearLimit(pct), null);
          }
          return;
        }
        // throughput_sample, peer_through_me_added/_removed → silent
      });
    })().catch((e) => {
      console.warn("GatewayNotificationsListener subscribe failed:", e);
    });

    return () => {
      if (aliveStatus === null) {
        // no-op — subscription never resolved
      } else {
        void aliveStatus.unsubscribe().catch(() => {});
      }
      if (alivePeers === null) {
        // no-op
      } else {
        void alivePeers.unsubscribe().catch(() => {});
      }
      if (aliveGateway === null) {
        // no-op
      } else {
        void aliveGateway.unsubscribe().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
