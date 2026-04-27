/**
 * useAddPeer — module-level atom + useSyncExternalStore for AddPeerSheet
 * open state, in-flight flag, and the shared react-hook-form instance
 * consumed by both <AddPeerSheet /> and <AddPeerActionRow /> (PEER-02,
 * 03-CONTEXT D-16/D-17/D-18, 03-UI-SPEC §S3).
 *
 * Pattern: mirrors use-peer-detail.ts / use-settings-config.ts —
 * module-scope state with notify() + useSyncExternalStore so multiple
 * call sites read the SAME `open` flag. A local useState in two places
 * would produce two independent instances and the ActionRow's openSheet
 * would never reach the Sheet's `open` prop. (Checker Info 2.)
 *
 * Single shared form instance: react-hook-form's `useForm` returns a new
 * instance per call. To share fields/errors between the trigger and the
 * Sheet, we lazily create ONE useForm in a small inner component
 * (FormHolder) that lives inside the AddPeerSheet — but the open/submit
 * coordination lives here at module scope. The sheet OWNS the form
 * instance and exports it via the hook so the action row can call
 * openSheet without needing the form. ActionRow only touches `openSheet`.
 *
 * D-30 / Checker Blocker 2: on successful peers.add_static, await
 * refetchSettingsConfig() so the Settings TOML base picks up the new
 * [[peers]] entry before the sheet closes.
 *
 * W1 contract: this module does NOT call listen(...) — it only invokes
 * callDaemon("peers.add_static", ...), a request/response RPC, and the
 * peer list updates through the existing peers.event subscription owned
 * by use-daemon-state.ts.
 *
 * Bang-free policy: comparisons use === / === false rather than `!`.
 */

import { useCallback, useSyncExternalStore } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { callDaemon } from "@/lib/rpc";
import { RpcErrorCode, type RpcError } from "@/lib/rpc-types";
import { refetchSettingsConfig } from "@/hooks/use-settings-config";

/** Form values for the Add Peer Sheet. `label` empty string → omit from RPC. */
export interface AddPeerFormValues {
  address: string;
  mechanism: "tcp" | "bluetooth" | "wifi_direct";
  label: string;
}

export const ADD_PEER_DEFAULTS: AddPeerFormValues = {
  address: "",
  mechanism: "tcp",
  label: "",
};

// ─── Module-level atom ─────────────────────────────────────────────

let openState = false;
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

function getOpen(): boolean {
  return openState;
}

function getSubmitting(): boolean {
  return submittingState;
}

function setOpen(next: boolean): void {
  if (openState === next) return;
  openState = next;
  notify();
}

function setSubmitting(next: boolean): void {
  if (submittingState === next) return;
  submittingState = next;
  notify();
}

// ─── Hook surface ──────────────────────────────────────────────────

export interface UseAddPeerReturn {
  open: boolean;
  submitting: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  /**
   * Builds the submit handler the Sheet binds to its <form onSubmit={...}>.
   * The handler is bound to a specific UseFormReturn instance so it can
   * call setError() on field-level daemon errors (-32011 / -32012) per
   * D-18. The Sheet creates the form via `useForm` and passes it in.
   */
  buildOnSubmit: (
    form: UseFormReturn<AddPeerFormValues>,
  ) => (values: AddPeerFormValues) => Promise<void>;
}

export function useAddPeer(): UseAddPeerReturn {
  const open = useSyncExternalStore(subscribe, getOpen, getOpen);
  const submitting = useSyncExternalStore(subscribe, getSubmitting, getSubmitting);

  const openSheet = useCallback(() => {
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setOpen(false);
  }, []);

  const buildOnSubmit = useCallback(
    (form: UseFormReturn<AddPeerFormValues>) =>
      async (values: AddPeerFormValues) => {
        setSubmitting(true);
        try {
          const trimmedLabel = values.label.trim();
          const params = {
            address: values.address.trim(),
            mechanism: values.mechanism,
            ...(trimmedLabel === "" ? {} : { label: trimmedLabel }),
          };
          await callDaemon("peers.add_static", params);
          // D-30 / Checker Blocker 2: re-fetch config.get so the parsed
          // TOML base picks up the new [[peers]] entry. Best-effort —
          // peers.add_static success is the user-visible commit moment;
          // a refetch failure should NOT block sheet close.
          try {
            await refetchSettingsConfig();
          } catch (refetchErr) {
            console.warn("refetchSettingsConfig after add_peer failed:", refetchErr);
          }
          setOpen(false);
          form.reset(ADD_PEER_DEFAULTS);
        } catch (e) {
          const err = e as RpcError;
          if (err.code === RpcErrorCode.PeerAlreadyExists) {
            // D-18 verbatim
            form.setError("address", {
              type: "daemon",
              message: "That peer is already configured.",
            });
          } else if (err.code === RpcErrorCode.InvalidPeerAddress) {
            // D-18 verbatim
            form.setError("address", {
              type: "daemon",
              message: "Address format not recognized by the daemon.",
            });
          } else if (err.code === RpcErrorCode.InvalidParams) {
            // D-18: -32602 fires a sonner toast and leaves the sheet open.
            toast.error("Daemon rejected parameters. [Show in Logs →]");
          } else {
            const msg = typeof err?.message === "string" && err.message !== ""
              ? err.message
              : "Couldn't add peer.";
            toast.error(msg);
          }
        } finally {
          setSubmitting(false);
        }
      },
    [],
  );

  return { open, submitting, openSheet, closeSheet, buildOnSubmit };
}

// Exposed for tests to reset module state between cases.
export const __test_resetAddPeerAtom = (): void => {
  openState = false;
  submittingState = false;
  listeners.clear();
};

// Re-export useForm so callers can grab a typed form instance without
// duplicating the type parameter at every call site.
export { useForm };
