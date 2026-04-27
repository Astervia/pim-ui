/**
 * useRemovePeer — module-level atom + useSyncExternalStore for the
 * Remove-peer AlertDialog. The dialog is open iff `target !== null`;
 * `submitting` flags the in-flight peers.remove RPC call.
 *
 * Spec:
 *   - 03-CONTEXT D-19 (verbatim title + body + race-toast copy)
 *   - 03-CONTEXT D-20 (only static peers expose Remove — gating lives
 *     on PeerRemoveButton render path; the hook itself is generic)
 *   - 03-CONTEXT D-30 (post-remove refetchSettingsConfig)
 *   - 03-CONTEXT D-32 (limited-mode disables confirm)
 *   - 03-UI-SPEC §S4 Remove Peer AlertDialog (first-focus on Cancel)
 *
 * RPC contract: PeersRemoveParams accepts either node_id OR
 * config_entry_id (one required). PeerSummary in rpc-types.ts only
 * exposes node_id, so Phase 3 prefers node_id — config_entry_id is
 * reserved for a future PeerSummary schema extension. Kernel doc
 * (`proximity-internet-mesh/docs/RPC.md` §5.2 line 298) confirms
 * either field is accepted.
 *
 * Pattern: mirrors use-add-peer.ts (which mirrors use-peer-detail.ts /
 * use-settings-config.ts) — module-scope atom so PeerRemoveButton
 * (trigger) and RemovePeerAlertDialog (consumer) share one state.
 *
 * W1 contract: this module does NOT call listen(...) — it only invokes
 * callDaemon("peers.remove", ...), a request/response RPC. The peer
 * list reflows via the existing peers.event { kind: "disconnected" }
 * subscription owned by use-daemon-state.ts.
 *
 * Bang-free policy: comparisons use === / === false / === null rather
 * than `!`.
 */

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { callDaemon } from "@/lib/rpc";
import { RpcErrorCode, type PeerSummary, type RpcError } from "@/lib/rpc-types";
import { refetchSettingsConfig } from "@/hooks/use-settings-config";

// ─── Module-level atom ─────────────────────────────────────────────

let target: PeerSummary | null = null;
let submittingState = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getTarget(): PeerSummary | null {
  return target;
}

function getSubmitting(): boolean {
  return submittingState;
}

function setTarget(next: PeerSummary | null): void {
  if (target === next) return;
  target = next;
  notify();
}

function setSubmitting(next: boolean): void {
  if (submittingState === next) return;
  submittingState = next;
  notify();
}

// ─── Hook surface ──────────────────────────────────────────────────

export interface UseRemovePeerReturn {
  /** The peer the user wants to remove; null when no dialog is open. */
  peer: PeerSummary | null;
  /** True while peers.remove is in flight. */
  submitting: boolean;
  /** Open the AlertDialog targeting `peer`. */
  requestRemove: (peer: PeerSummary) => void;
  /** Close without calling peers.remove. */
  cancel: () => void;
  /** Confirm: calls peers.remove + refetchSettingsConfig + closes. */
  confirm: () => Promise<void>;
}

export function useRemovePeer(): UseRemovePeerReturn {
  const peer = useSyncExternalStore(subscribe, getTarget, getTarget);
  const submitting = useSyncExternalStore(subscribe, getSubmitting, getSubmitting);

  const requestRemove = useCallback((p: PeerSummary) => {
    setTarget(p);
  }, []);

  const cancel = useCallback(() => {
    setTarget(null);
  }, []);

  const confirm = useCallback(async () => {
    const toRemove = target;
    if (toRemove === null) return;
    setSubmitting(true);
    try {
      // Phase 3 prefers node_id (the only id PeerSummary exposes).
      // The daemon accepts either node_id or config_entry_id per
      // PeersRemoveParams.
      await callDaemon("peers.remove", { node_id: toRemove.node_id });
      // D-30 / Checker Blocker 2: re-fetch config.get so the parsed
      // TOML base picks up the pruned [[peers]] entry.
      try {
        await refetchSettingsConfig();
      } catch (refetchErr) {
        console.warn("refetchSettingsConfig after remove_peer failed:", refetchErr);
      }
      setTarget(null);
    } catch (e) {
      const err = e as RpcError;
      if (err.code === RpcErrorCode.PeerNotFound) {
        // D-19 verbatim race toast
        toast.message("Peer was already removed.");
        setTarget(null);
      } else {
        const msg = typeof err?.message === "string" && err.message !== ""
          ? err.message
          : "Couldn't remove peer.";
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { peer, submitting, requestRemove, cancel, confirm };
}

// Exposed for tests to reset module state between cases.
export const __test_resetRemovePeerAtom = (): void => {
  target = null;
  submittingState = false;
  listeners.clear();
};
