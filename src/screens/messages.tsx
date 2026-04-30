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
import { useConversations } from "@/hooks/use-conversations";
import { useDaemonState } from "@/hooks/use-daemon-state";

export function MessagesScreen() {
  const conversations = useConversations();
  const [selected, setSelected] = useState<string | null>(null);
  const { snapshot } = useDaemonState();

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.peer_node_id === selected) ?? null,
    [conversations, selected],
  );

  const subtitle = useMemo(() => {
    if (snapshot.state !== "running") {
      return "daemon offline · messages will resume when the mesh is up";
    }
    const active = conversations.filter((c) => c.is_connected === true).length;
    return `via mesh · noise hop-by-hop + ecies e2e · ${active} peer${active === 1 ? "" : "s"} online`;
  }, [conversations, snapshot.state]);

  return (
    <div className="flex flex-col gap-3">
      <CliPanel
        title="messages"
        status={{
          label: snapshot.state === "running" ? "live" : "offline",
          variant: snapshot.state === "running" ? "default" : "muted",
        }}
        density="default"
      >
        <p className="text-xs text-muted-foreground -mt-1 mb-2 font-code">
          {subtitle}
        </p>
        <div className="flex h-[60vh] min-h-[28rem] border border-border bg-background">
          <PeerList
            conversations={conversations}
            selected={selected}
            onSelect={setSelected}
          />
          <ConversationPane conversation={selectedConversation} />
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
