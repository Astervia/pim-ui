/**
 * <SimpleModeScreen /> — single-screen surface for simple mode.
 *
 * Automated flow:
 *   1. User taps [ TURN ON ] → start daemon (after TUN permission)
 *   2. Daemon enters `running` → discovery starts automatically
 *   3. When a peer with a known node_id is announced, show a card
 *      "Someone is nearby" + [ CONNECT ]
 *   4. Tap connect → peers.pair { node_id, trust: "persist" }
 *   5. When the peer appears in status.peers as "active",
 *      route.set_split_default { on: true } fires automatically
 *   6. UI shows "you're connected to {name}" — [ DISCONNECT ]
 *
 * No jargon visible: no "daemon", "routing", "node_id", "TUN",
 * "transport". The user sees: turn on, looking, someone is nearby,
 * connected, turn off. The technical terms remain in advanced mode
 * for users who care.
 *
 * Reuses existing hooks (useDaemonState, useDiscovered, usePeers,
 * useRouteOn) — no parallel state machine. The "view" derivation
 * is purely a function of the daemon snapshot.
 *
 * Simple mode does NOT mount the PairApprovalModal — the card serves
 * as the approver. Inbound pair handshakes arriving while the card
 * is visible are surfaced as the same peer (same source: useDiscovered).
 * Tapping [ CONNECT ] covers both inbound and outbound cases.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useDiscovered } from "@/hooks/use-discovered";
import { usePeers } from "@/hooks/use-peers";
import { useRouteOn } from "@/hooks/use-routing";
import { callDaemon } from "@/lib/rpc";
import { useTunPermission } from "@/components/brand/tun-permission-modal";
import { isTransientState } from "@/lib/daemon-state";
import { formatShortId } from "@/lib/format";
import { RadarLoader } from "@/components/simple/radar-loader";
import { SimplePowerButton } from "@/components/simple/simple-power-button";
import { SimplePeerCard } from "@/components/simple/simple-peer-card";
import { SimpleHero } from "@/components/simple/simple-hero";
import type { PeerSummary, PeerDiscovered } from "@/lib/rpc-types";

type SimpleView =
  | { kind: "off" }
  | { kind: "starting" }
  | { kind: "searching" }
  | { kind: "found"; peer: PeerDiscovered }
  | { kind: "pairing"; peer: PeerDiscovered }
  | { kind: "connecting"; peer: PeerSummary }
  | { kind: "connected"; peer: PeerSummary }
  | { kind: "error"; message: string };

function peerDisplayName(p: PeerDiscovered | PeerSummary): string {
  // Discovered carries label_announced; Summary carries label.
  if ("label_announced" in p && p.label_announced !== null) {
    return p.label_announced;
  }
  if ("label" in p && p.label !== null && p.label !== undefined) {
    return p.label;
  }
  return formatShortId(p.node_id);
}

function friendlyTransport(t: string): string {
  switch (t) {
    case "tcp":
      return "wi-fi";
    case "bluetooth":
      return "bluetooth";
    case "wifi_direct":
      return "wi-fi direct";
    case "relay":
      return "via another device";
    default:
      return t;
  }
}

function friendlyMechanism(m: string): string {
  switch (m) {
    case "broadcast":
      return "wi-fi";
    case "bluetooth":
      return "bluetooth";
    case "wifi_direct":
      return "wi-fi direct";
    default:
      return m;
  }
}

export function SimpleModeScreen() {
  const { snapshot, actions } = useDaemonState();
  const { requestPermission } = useTunPermission();
  const peers = usePeers();
  const discovered = useDiscovered();
  const routeOn = useRouteOn();

  const [pairingNodeId, setPairingNodeId] = useState<string | null>(null);
  const [routeAttempted, setRouteAttempted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Peers the user chose to ignore in this session. Excluded from
  // pairablePeer — the view goes back to "searching" until the next
  // announcement. The Set is local-only; resets on shell remount.
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(() => new Set());

  const daemonState = snapshot.state;
  const isTransient = isTransientState(daemonState);

  // Active peer for the "connecting/connected" state. Picks the first
  // peer with state === "active". Paired peers without heartbeat
  // still count as "active" in the daemon's model.
  const activePeer: PeerSummary | null = useMemo(() => {
    return peers.find((p) => p.state === "active") ?? null;
  }, [peers]);

  // Pairable discovered peer: has a node_id, isn't already in the
  // paired peers list, hasn't been ignored this session.
  const pairablePeer: PeerDiscovered | null = useMemo(() => {
    const known = new Set(peers.map((p) => p.node_id));
    return (
      discovered.find(
        (d) =>
          d.node_id !== null &&
          known.has(d.node_id) === false &&
          ignoredIds.has(d.node_id) === false,
      ) ?? null
    );
  }, [discovered, peers, ignoredIds]);

  // Auto-routing: when a peer becomes active but routing is off, turn
  // it on automatically (once per connection session). Flag resets
  // when the active peer disappears.
  useEffect(() => {
    if (activePeer === null) {
      if (routeAttempted === true) setRouteAttempted(false);
      return;
    }
    if (routeOn === true) return;
    if (routeAttempted === true) return;
    if (daemonState !== "running") return;
    setRouteAttempted(true);
    callDaemon("route.set_split_default", { on: true }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      // In simple mode a routing failure is reported via toast; the
      // peer connection itself remains valid so the flow isn't blocked.
      toast.error(`Couldn't enable internet routing: ${msg}`);
    });
  }, [activePeer, routeOn, routeAttempted, daemonState]);

  // Clear local pairing state when the peer becomes active (pair
  // succeeded) or disappears from discovered (timeout).
  useEffect(() => {
    if (pairingNodeId === null) return;
    const stillDiscovered = discovered.some(
      (d) => d.node_id === pairingNodeId,
    );
    const nowActive = peers.some(
      (p) => p.node_id === pairingNodeId && p.state === "active",
    );
    if (nowActive === true || stillDiscovered === false) {
      setPairingNodeId(null);
    }
  }, [pairingNodeId, peers, discovered]);

  // ─── View derivation ────────────────────────────────────────────
  const view: SimpleView = (() => {
    if (errorMsg !== null) return { kind: "error", message: errorMsg };
    if (daemonState === "stopped") return { kind: "off" };
    if (daemonState === "error") return { kind: "off" };
    if (isTransient === true) return { kind: "starting" };
    if (daemonState !== "running") return { kind: "off" };

    if (activePeer !== null) {
      if (routeOn === true) return { kind: "connected", peer: activePeer };
      return { kind: "connecting", peer: activePeer };
    }
    if (pairingNodeId !== null) {
      const p = discovered.find((d) => d.node_id === pairingNodeId);
      if (p !== undefined) return { kind: "pairing", peer: p };
    }
    if (pairablePeer !== null) return { kind: "found", peer: pairablePeer };
    return { kind: "searching" };
  })();

  // ─── Actions ────────────────────────────────────────────────────
  const onPower = useCallback(async () => {
    setErrorMsg(null);
    if (daemonState === "running") {
      // Turning off — also turn routing off so the state stays clean.
      try {
        if (routeOn === true) {
          await callDaemon("route.set_split_default", { on: false });
        }
      } catch {
        // Don't block stop if routing can't turn off.
      }
      await actions.stop();
      return;
    }
    if (isTransient === true) return;
    const granted = await requestPermission();
    if (granted !== true) return;
    try {
      await actions.start();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(`Couldn't turn on: ${msg}`);
    }
  }, [daemonState, isTransient, routeOn, actions, requestPermission]);

  const onConnectPeer = useCallback(
    async (peer: PeerDiscovered) => {
      if (peer.node_id === null) return;
      setPairingNodeId(peer.node_id);
      try {
        await callDaemon("peers.pair", {
          node_id: peer.node_id,
          trust: "persist",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Couldn't connect: ${msg}`);
        setPairingNodeId(null);
      }
    },
    [],
  );

  const onIgnorePeer = useCallback(() => {
    if (pairablePeer === null || pairablePeer.node_id === null) return;
    const nodeId = pairablePeer.node_id;
    setIgnoredIds((prev) => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
    toast.message("Still looking");
  }, [pairablePeer]);

  const onDisconnect = useCallback(async () => {
    if (activePeer === null) return;
    setRouteAttempted(false);
    try {
      if (routeOn === true) {
        await callDaemon("route.set_split_default", { on: false });
      }
      await callDaemon("peers.remove", { node_id: activePeer.node_id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't disconnect: ${msg}`);
    }
  }, [activePeer, routeOn]);

  // Unique keys per view kind let React remount the block so the
  // `simple-fade-in` animation fires on every transition.
  // Tagline below the hero changes with the daemon state so the brand
  // mark always carries a one-line context line ("private mesh, ready"
  // → "looking for a peer" → "you're connected").
  const tagline = heroTagline(view);

  return (
    <div
      role="region"
      aria-label="pim · simple mode"
      className="relative flex-1 flex flex-col items-center px-6 pt-12 pb-10 gap-10 min-h-[640px]"
    >
      <SimpleHero tagline={tagline} />
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-8">
        {renderView(view, {
          onPower,
          onConnectPeer,
          onIgnorePeer,
          onDisconnect,
          isTransient,
        })}
      </div>
    </div>
  );
}

function heroTagline(view: SimpleView): string {
  switch (view.kind) {
    case "off":
      return "private mesh · offline";
    case "starting":
      return "starting up";
    case "searching":
      return "scanning the area";
    case "found":
      return "someone is nearby";
    case "pairing":
      return "exchanging keys";
    case "connecting":
      return "almost there";
    case "connected":
      return "private mesh · online";
    case "error":
      return "something went wrong";
  }
}

interface ViewActions {
  onPower: () => void;
  onConnectPeer: (p: PeerDiscovered) => void;
  onIgnorePeer: () => void;
  onDisconnect: () => void;
  isTransient: boolean;
}

function renderView(view: SimpleView, a: ViewActions) {
  switch (view.kind) {
    case "off":
      return (
        <div key="off" className="flex flex-col items-center gap-6 simple-fade-in">
          <SimplePowerButton label="TURN ON" tone="off" onClick={a.onPower} />
          <p className="max-w-sm text-center font-code text-sm text-text-secondary leading-7">
            pim creates a private network between you and people
            nearby. nothing routes through external servers.
          </p>
        </div>
      );

    case "starting":
      return (
        <div key="starting" className="flex flex-col items-center gap-6 simple-fade-in">
          <SimplePowerButton
            label="STARTING"
            tone="transient"
            disabled
            onClick={() => {}}
          />
          <p className="font-code text-sm text-text-secondary">
            getting your private network ready…
          </p>
        </div>
      );

    case "searching":
      return (
        <div key="searching" className="flex flex-col items-center gap-8 simple-fade-in">
          <RadarLoader size={240} />
          <div className="flex flex-col items-center gap-2 max-w-md text-center">
            <h2 className="font-mono text-lg uppercase tracking-[0.25em] text-foreground">
              looking for someone nearby
            </h2>
            <p className="font-code text-sm text-text-secondary">
              keep this screen open. you'll be notified when another
              device with pim shows up.
            </p>
          </div>
          <button
            type="button"
            onClick={a.onPower}
            className="mt-4 px-6 py-2.5 border-2 border-destructive text-destructive font-mono text-sm uppercase tracking-[0.3em] hover:bg-destructive hover:text-destructive-foreground transition-colors duration-150 ease-linear focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            [ turn off ]
          </button>
        </div>
      );

    case "found":
      return (
        <div key="found" className="flex flex-col items-center gap-6 simple-fade-in">
          <RadarLoader size={200} peerFound />
          <SimplePeerCard
            variant="found"
            name={peerDisplayName(view.peer)}
            subtitle={`found via ${friendlyMechanism(view.peer.mechanism)}`}
            primaryLabel="connect"
            onPrimary={() => a.onConnectPeer(view.peer)}
            secondaryLabel="ignore"
            onSecondary={a.onIgnorePeer}
          />
        </div>
      );

    case "pairing":
      return (
        <div key="pairing" className="flex flex-col items-center gap-6 simple-fade-in">
          <RadarLoader size={200} peerFound />
          <div className="flex flex-col items-center gap-2 max-w-md text-center">
            <h2 className="font-mono text-lg uppercase tracking-[0.25em] text-foreground">
              establishing secure connection
            </h2>
            <p className="font-code text-sm text-text-secondary">
              exchanging keys with {peerDisplayName(view.peer)}…
            </p>
          </div>
        </div>
      );

    case "connecting":
      return (
        <div key="connecting" className="flex flex-col items-center gap-6 simple-fade-in">
          <RadarLoader size={200} peerFound />
          <div className="flex flex-col items-center gap-2 max-w-md text-center">
            <h2 className="font-mono text-lg uppercase tracking-[0.25em] text-foreground">
              almost there
            </h2>
            <p className="font-code text-sm text-text-secondary">
              wrapping up the connection with {peerDisplayName(view.peer)}…
            </p>
          </div>
        </div>
      );

    case "connected":
      return (
        <div key="connected" className="flex flex-col items-center gap-6 simple-fade-in">
          <SimplePeerCard
            variant="connected"
            name={peerDisplayName(view.peer)}
            subtitle={`online · ${friendlyTransport(view.peer.transport)}`}
            primaryLabel="disconnect"
            onPrimary={a.onDisconnect}
          />
          <button
            type="button"
            onClick={a.onPower}
            className="mt-4 px-6 py-2.5 border-2 border-destructive text-destructive font-mono text-sm uppercase tracking-[0.3em] hover:bg-destructive hover:text-destructive-foreground transition-colors duration-150 ease-linear focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            [ turn everything off ]
          </button>
        </div>
      );

    case "error":
      return (
        <div key="error" className="flex flex-col items-center gap-6 simple-fade-in">
          <span aria-hidden="true" className="font-code text-5xl text-destructive">
            ✗
          </span>
          <div className="flex flex-col items-center gap-2 max-w-md text-center">
            <h2 className="font-mono text-lg uppercase tracking-[0.25em] text-destructive">
              something went wrong
            </h2>
            <p className="font-code text-sm text-text-secondary">
              {view.message}
            </p>
          </div>
          <SimplePowerButton
            label="TRY AGAIN"
            tone="off"
            onClick={a.onPower}
          />
        </div>
      );
  }
}
