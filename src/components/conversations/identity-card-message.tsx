/**
 * <IdentityCardMessage /> — special render for messages whose body is
 * a {@link parseIdentityCard}-able peer-share payload. Replaces the
 * raw monospace block with a structured card and a single-action
 * [ Import ] button that calls `peers.import_identity` on the daemon.
 *
 * The component owns its own import state (idle / importing /
 * imported / mismatch / error) so each shared card in the thread has
 * an independent affordance — sharing the same identity twice in one
 * thread is fine; only the row the user clicks transitions.
 *
 * Mismatch uses the structured error data the daemon returns
 * (PEER_IDENTITY_MISMATCH = -32040) so the user sees the existing key
 * alongside the supplied one and can decide whether to delete + re-
 * import out-of-band.
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { KvRow } from "@/components/peers/kv-row";
import { cn } from "@/lib/utils";
import { callDaemon } from "@/lib/rpc";
import type { ParsedIdentityCard } from "@/lib/conversations/identity-card";

export interface IdentityCardMessageProps {
  card: ParsedIdentityCard;
  /** "sent" cards (we shared) skip the import button; the local
   *  daemon already has the identity. */
  isOutbound: boolean;
}

type ImportState =
  | { kind: "idle" }
  | { kind: "importing" }
  | { kind: "imported"; freshInsert: boolean }
  | { kind: "mismatch"; existingHex: string }
  | { kind: "error"; message: string };

interface DaemonRpcError {
  code?: number;
  message?: string;
  data?: { existing_x25519_pubkey?: string };
}

function extractRpcError(e: unknown): DaemonRpcError | null {
  if (typeof e !== "object" || e === null) return null;
  const obj = e as Record<string, unknown>;
  // Tauri's invoke surfaces JSON-RPC errors as Error.message containing
  // the JSON; some adapters expose .code/.data directly. Try both.
  if (typeof obj.code === "number" || typeof obj.data === "object") {
    return obj as DaemonRpcError;
  }
  if (typeof obj.message === "string") {
    try {
      const parsed = JSON.parse(obj.message);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // not JSON
    }
  }
  return null;
}

export function IdentityCardMessage({ card, isOutbound }: IdentityCardMessageProps) {
  const [state, setState] = useState<ImportState>({ kind: "idle" });

  const onImport = useCallback(async () => {
    if (card.x25519Pubkey === null) {
      setState({
        kind: "error",
        message:
          "card is missing x25519 — peer must come online or share a fresh card",
      });
      return;
    }
    setState({ kind: "importing" });
    try {
      const result = await callDaemon("peers.import_identity", {
        node_id: card.nodeId,
        x25519_pubkey: card.x25519Pubkey,
        friendly_name: card.name ?? undefined,
      });
      setState({ kind: "imported", freshInsert: result.imported });
    } catch (e) {
      const rpcErr = extractRpcError(e);
      if (rpcErr?.code === -32040 && rpcErr.data?.existing_x25519_pubkey) {
        setState({
          kind: "mismatch",
          existingHex: rpcErr.data.existing_x25519_pubkey,
        });
        return;
      }
      const msg =
        rpcErr?.message ?? (e instanceof Error ? e.message : String(e));
      setState({ kind: "error", message: msg });
    }
  }, [card]);

  const headerLabel = isOutbound === true
    ? "shared identity card"
    : "received identity card";

  return (
    <div className="flex flex-col gap-2 font-code text-sm leading-[1.55]">
      <div className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
        ── {headerLabel} ──
      </div>
      <div className="flex flex-col gap-1">
        <KvRow label="name" value={card.name ?? "—"} />
        <KvRow
          label="node_id"
          value={card.nodeId}
          copyable
          valueClassName="break-all"
        />
        {card.meshIp !== null ? (
          <KvRow label="mesh_ip" value={card.meshIp} copyable />
        ) : null}
        {card.x25519Pubkey !== null ? (
          <KvRow
            label="x25519"
            value={card.x25519Pubkey}
            copyable
            valueClassName="break-all"
          />
        ) : (
          <KvRow
            label="x25519"
            value="missing — cannot import"
            valueClassName="text-text-secondary"
          />
        )}
      </div>
      {isOutbound === true ? null : (
        <ImportFooter state={state} onImport={onImport} card={card} />
      )}
    </div>
  );
}

interface ImportFooterProps {
  state: ImportState;
  onImport: () => void;
  card: ParsedIdentityCard;
}

function ImportFooter({ state, onImport, card }: ImportFooterProps) {
  const canImport = card.x25519Pubkey !== null;
  switch (state.kind) {
    case "idle":
      return (
        <div className="flex items-center justify-end pt-1">
          <Button
            type="button"
            size="sm"
            onClick={onImport}
            disabled={canImport === false}
            title={canImport === true ? undefined : "card has no x25519 key"}
          >
            import
          </Button>
        </div>
      );
    case "importing":
      return (
        <div className="flex items-center justify-end pt-1 text-xs text-text-secondary">
          importing…
        </div>
      );
    case "imported":
      return (
        <div className="flex items-center justify-end pt-1 text-xs text-primary">
          ✓ imported{state.freshInsert === true ? "" : " (already cached — refreshed)"}
        </div>
      );
    case "mismatch":
      return (
        <div
          className={cn(
            "flex flex-col gap-1 pt-1 text-xs",
            "border-l-2 border-destructive pl-2",
          )}
        >
          <span className="text-destructive uppercase tracking-wider">
            ✗ key mismatch — refused
          </span>
          <span className="text-text-secondary break-all">
            existing: {state.existingHex}
          </span>
          <span className="text-text-secondary">
            delete the cached identity manually before re-importing if you
            trust this newer key.
          </span>
        </div>
      );
    case "error":
      return (
        <div className="flex flex-col gap-1 pt-1 text-xs text-destructive">
          <span>✗ import failed</span>
          <span className="break-all">{state.message}</span>
        </div>
      );
  }
}
