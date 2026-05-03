/**
 * <MessagesScreen /> — the encrypted peer-to-peer messaging tab.
 *
 * Two-pane CliPanel layout matching the brand. Left: peer list. Right:
 * active thread + composer. Honest footer underneath spelling out the
 * security model (mesh-routed, ECIES end-to-end, locally stored).
 */

import { useMemo, useState } from "react";
import { CliPanel } from "@/components/brand/cli-panel";
import { PeerList } from "@/components/conversations/peer-list";
import { ConversationPane } from "@/components/conversations/conversation-pane";
import { BroadcastControlPanel } from "@/components/conversations/broadcast-control-panel";
import { useConversations } from "@/hooks/use-conversations";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { usePeers } from "@/hooks/use-peers";
import {
  useDiscoveredPeers,
  type DiscoveredPeer,
} from "@/hooks/use-discovered-peers";
import type { ConversationSummary, PeerSummary } from "@/lib/rpc-types";

function isPeerConnected(peer: PeerSummary): boolean {
  return peer.state === "active" || peer.state === "relayed";
}

function synthesizeConversation(peer: PeerSummary): ConversationSummary {
  return {
    peer_node_id: peer.node_id,
    peer_node_id_short: peer.node_id_short,
    name: peer.label ?? peer.node_id_short,
    last_message_preview: null,
    last_message_ts_ms: null,
    unread_count: 0,
    is_connected: true,
    x25519_pubkey: peer.x25519_pubkey,
  };
}

function synthesizeDiscoveredConversation(p: DiscoveredPeer): ConversationSummary {
  return {
    peer_node_id: p.nodeId,
    peer_node_id_short: p.nodeId.slice(0, 8),
    name: p.name === "" ? p.nodeId.slice(0, 8) : p.name,
    last_message_preview: null,
    last_message_ts_ms: null,
    unread_count: 0,
    // Discovered-via-broadcast peers don't have a direct session — they
    // surface as offline in the sidebar's "discovered" group.
    is_connected: false,
    // x25519 is known by definition (the discover hook only tracks
    // entries with `x25519_known: true`) but the actual key isn't
    // carried on the event yet — show null until a future RPC seeds
    // the cache.
    x25519_pubkey: null,
  };
}

export function MessagesScreen() {
  const conversations = useConversations();
  const peers = usePeers();
  const discovered = useDiscoveredPeers();
  const [selected, setSelected] = useState<string | null>(null);
  const { snapshot } = useDaemonState();

  // Merge live connected peers into the conversation list so a freshly-
  // paired peer with no message history still surfaces under ACTIVE.
  // Existing conversation rows win — their preview/unread state is real.
  // Then layer in discovered peers (broadcast-only) as a third category.
  const merged = useMemo<ConversationSummary[]>(() => {
    const known = new Set(conversations.map((c) => c.peer_node_id));
    const syntheticActive = peers
      .filter((p) => isPeerConnected(p) && !known.has(p.node_id))
      .map(synthesizeConversation);
    for (const p of syntheticActive) {
      known.add(p.peer_node_id);
    }
    const syntheticDiscovered = discovered
      .filter((p) => !known.has(p.nodeId))
      .map(synthesizeDiscoveredConversation);
    return [...conversations, ...syntheticActive, ...syntheticDiscovered];
  }, [conversations, peers, discovered]);

  const discoveredIds = useMemo(
    () => new Set(discovered.map((p) => p.nodeId)),
    [discovered],
  );

  const selectedConversation = useMemo(
    () => merged.find((c) => c.peer_node_id === selected) ?? null,
    [merged, selected],
  );

  const subtitle = useMemo(() => {
    if (snapshot.state !== "running") {
      return "daemon offline · messages will resume when the mesh is up";
    }
    const active = merged.filter((c) => c.is_connected === true).length;
    return `via mesh · noise hop-by-hop + ecies e2e · ${active} peer${active === 1 ? "" : "s"} online`;
  }, [merged, snapshot.state]);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <CliPanel
        title="messages"
        status={{
          label: snapshot.state === "running" ? "live" : "offline",
          variant: snapshot.state === "running" ? "default" : "muted",
        }}
        density="default"
        fill
      >
        <p className="text-xs text-muted-foreground -mt-1 mb-2 font-code">
          {subtitle}
        </p>
        <BroadcastControlPanel />
        <div className="flex flex-1 min-h-0 border border-border bg-background">
          <PeerList
            conversations={merged}
            selected={selected}
            onSelect={setSelected}
            discoveredIds={discoveredIds}
          />
          <ConversationPane
            conversation={selectedConversation}
            onConversationGone={(nodeId) => {
              if (selected === nodeId) setSelected(null);
            }}
          />
        </div>
        <p className="mt-3 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground font-code">
          messages stored locally · identity is the peer's node_id, not its
          name or ip · cleartext leaves your device only inside ecies
          ciphertext
        </p>
      </CliPanel>
    </div>
  );
}
