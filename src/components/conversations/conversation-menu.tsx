/**
 * <ConversationMenu /> — destructive-action affordances for the
 * active conversation: "delete history" (per-peer message wipe) and
 * "forget peer" (drop the cached identity, optionally also wipe
 * messages).
 *
 * Each action goes through an <AlertDialog /> confirm — these are
 * destructive operations and the user should be sure. The menu
 * itself is a small popover-style flyout anchored to the trigger
 * button (built with <details> for keyboard + click-outside without
 * pulling in a popover primitive).
 */

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { callDaemon } from "@/lib/rpc";
import { refreshConversations } from "@/hooks/use-conversations";
import type { ConversationSummary } from "@/lib/rpc-types";

export interface ConversationMenuProps {
  conversation: ConversationSummary;
  /** Called after a successful destructive action so the parent can
   *  drop its `selected` state (the conversation no longer exists). */
  onConversationGone?: (peerNodeId: string) => void;
}

type ConfirmKind = "delete-history" | "forget-keep" | "forget-wipe";

export function ConversationMenu({
  conversation,
  onConversationGone,
}: ConversationMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeMenu = useCallback(() => {
    if (detailsRef.current !== null) {
      detailsRef.current.open = false;
    }
  }, []);

  const openConfirm = useCallback(
    (kind: ConfirmKind) => {
      closeMenu();
      setError(null);
      setConfirm(kind);
    },
    [closeMenu],
  );

  const runAction = useCallback(async () => {
    if (confirm === null) return;
    setBusy(true);
    setError(null);
    try {
      if (confirm === "delete-history") {
        await callDaemon("messages.delete_conversation", {
          peer_node_id: conversation.peer_node_id,
        });
      } else if (confirm === "forget-keep") {
        await callDaemon("peers.forget", {
          node_id: conversation.peer_node_id,
          also_delete_messages: false,
        });
      } else {
        // forget-wipe
        await callDaemon("peers.forget", {
          node_id: conversation.peer_node_id,
          also_delete_messages: true,
        });
      }
      // Daemon emits HistoryCleared / PeerSeen events that flush the
      // live caches; refresh the conversations list once for the
      // (rare) case where the live event was missed.
      void refreshConversations();
      // For "delete-history" the cached identity stays — the
      // conversation row may still appear if a future message arrives,
      // but it's gone for now. For "forget-keep" the row stays under
      // the now-fallback short-id name. For "forget-wipe" the row is
      // gone too.
      if (confirm === "delete-history" || confirm === "forget-wipe") {
        if (onConversationGone !== undefined) {
          onConversationGone(conversation.peer_node_id);
        }
      }
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [confirm, conversation.peer_node_id, onConversationGone]);

  const closeConfirm = useCallback(() => {
    if (busy === true) return;
    setConfirm(null);
    setError(null);
  }, [busy]);

  return (
    <>
      <details
        ref={detailsRef}
        className="relative font-mono text-[10px] uppercase tracking-wider"
      >
        <summary
          className={cn(
            "list-none cursor-pointer select-none px-1",
            "text-text-secondary hover:text-primary",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
            "transition-colors duration-100 ease-linear",
          )}
          aria-label="conversation actions"
          title="conversation actions"
        >
          [ … ]
        </summary>
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full mt-1 z-30",
            "min-w-[12rem] flex flex-col",
            "border border-border bg-popover text-foreground",
            "font-code text-xs",
          )}
        >
          <MenuItem onClick={() => openConfirm("delete-history")}>
            delete history
          </MenuItem>
          <MenuItem onClick={() => openConfirm("forget-keep")}>
            forget peer
          </MenuItem>
          <MenuItem
            onClick={() => openConfirm("forget-wipe")}
            destructive
          >
            forget peer + wipe history
          </MenuItem>
        </div>
      </details>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (o === false) closeConfirm();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete-history"
                ? "delete conversation history?"
                : confirm === "forget-keep"
                  ? "forget peer identity?"
                  : "forget peer + wipe history?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete-history"
                ? `every message exchanged with ${conversation.name} will be deleted from this device. their cached identity (x25519) is kept so you can still message them.`
                : confirm === "forget-keep"
                  ? `${conversation.name}'s cached x25519 will be removed — they cannot be messaged again until re-imported or rediscovered. message history is preserved.`
                  : `${conversation.name}'s cached x25519 AND every message exchanged with them will be deleted from this device. this cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error !== null ? (
            <p className="font-code text-xs text-destructive break-all">
              ✗ {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void runAction();
              }}
              disabled={busy}
            >
              {busy ? "deleting…" : "delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MenuItemProps {
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}

function MenuItem({ onClick, destructive, children }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "text-left px-3 py-2 normal-case tracking-normal",
        "border-b border-border/40 last:border-b-0",
        "transition-colors duration-100 ease-linear",
        destructive === true
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-popover/60 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
