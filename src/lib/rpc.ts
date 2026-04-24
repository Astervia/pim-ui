/**
 * Typed bridge from the React frontend to the Tauri Rust shell.
 *
 * The Rust side (src-tauri/src/rpc/*, Plan 02) owns the long-lived
 * JSON-RPC connection to `pim-daemon` over a Unix socket. The frontend
 * talks to the Rust side via Tauri `invoke` commands (request /
 * response) and Tauri event listeners (daemon → UI push).
 *
 * This module is the ONLY place the frontend should be aware of Tauri
 * command names or event names. Components import `callDaemon`,
 * `subscribeDaemon`, `startDaemon`, etc. — never `invoke` directly.
 *
 * Contract: mirrors `proximity-internet-mesh/docs/RPC.md` v1. When
 * docs/RPC.md changes, update `rpc-types.ts` first, then adjust
 * whichever Rust #[tauri::command] names match the constants below.
 *
 * ── W1: single-listener design ──
 * This module DOES NOT register any Tauri event subscription. The
 * `subscribeDaemon()` helper below only tells Rust to start forwarding
 * one of the three event streams and hands back the subscription_id.
 * The single global Tauri event subscription on DaemonEvents.rpcEvent
 * lives in `src/hooks/use-daemon-state.ts` (Plan 03) and fans out to
 * per-event subscribers via an internal `Map<eventName, Set<handler>>`.
 * This keeps exactly one Tauri subscription in the whole app regardless
 * of how many UI surfaces subscribe — otherwise every new consumer
 * would allocate a fresh OS-level subscription and we'd leak them on
 * unmount.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  RpcError,
  RpcEventName,
  RpcMethodMap,
  RpcMethodName,
} from "./rpc-types";

/**
 * Tauri command names — the EXACT strings the Rust `#[tauri::command]`
 * handlers must use. Kept in sync with `src-tauri/src/rpc/commands.rs`
 * (Plan 02). Changing a value here without changing Rust is a silent
 * runtime "command not found" — keep both sides in lockstep.
 */
const CMD = {
  /** Generic JSON-RPC request/response: `daemon_call({ method, params })`. */
  call: "daemon_call",
  /** Starts forwarding a Tauri event stream for one of the 3 v1 events. */
  subscribe: "daemon_subscribe",
  /** Cancels a prior `subscribe` by id. */
  unsubscribe: "daemon_unsubscribe",
  /** Spawns the pim-daemon sidecar (Plan 02). Resolves when ready. */
  startDaemon: "daemon_start",
  /** Kills the sidecar (Plan 02). Resolves when the child exits. */
  stopDaemon: "daemon_stop",
  /** Returns the most recent `RpcError` the Rust side raised, or null. */
  getLastError: "daemon_last_error",
} as const;

/**
 * Tauri event names the Rust side emits via `app.emit(...)`. Match the
 * literal strings in `src-tauri/src/daemon/events.rs` (Plan 02).
 *
 * - `stateChanged` carries a `DaemonStateChange` payload (see
 *   daemon-state.ts) on every transition of the daemon lifecycle
 *   machine.
 * - `rpcEvent` fans out the three v1 notification streams —
 *   `status.event`, `peers.event`, `logs.event` — tagged with the
 *   originating event name so a single listener can dispatch them.
 */
const EVT = {
  stateChanged: "daemon://state-changed",
  rpcEvent: "daemon://rpc-event",
} as const;

/**
 * Typed request. The method name picks the correct params + result
 * types from `RpcMethodMap`, so the compiler catches wrong param
 * shapes at call sites without any runtime overhead.
 *
 * Example:
 *   const s = await callDaemon("status", null);       // s: Status
 *   await callDaemon("route.set_split_default", { on: true });
 */
export async function callDaemon<M extends RpcMethodName>(
  method: M,
  params: RpcMethodMap[M]["params"],
): Promise<RpcMethodMap[M]["result"]> {
  return invoke(CMD.call, { method, params });
}

/**
 * Handle returned from `subscribeDaemon`. The `id` is the uuid the
 * Rust side allocated; `unsubscribe` is a convenience wrapper over
 * `daemon_unsubscribe(subscription_id)` bound to this subscription.
 */
export interface DaemonSubscription {
  /** subscription_id returned by Rust; pass back to `daemon_unsubscribe`. */
  id: string;
  /** Idempotent — safe to call on cleanup even if already unsubscribed. */
  unsubscribe: () => Promise<void>;
}

/**
 * Ask Rust to start forwarding one of the 3 v1 event streams.
 *
 * This function does NOT register a Tauri subscription — see the W1
 * note at the top of the file. The caller (useDaemonState, Plan 03)
 * owns the single global Tauri subscription on DaemonEvents.rpcEvent
 * and dispatches payloads by their `event` tag to handlers registered
 * by name. Returning just the subscription_id (plus an unsubscribe
 * closure) keeps the Tauri subscription count in the whole app at
 * exactly one — verified by Plan 01 acceptance greps on this file.
 */
export async function subscribeDaemon(
  event: RpcEventName,
): Promise<DaemonSubscription> {
  const id = await invoke<string>(CMD.subscribe, { event });
  return {
    id,
    unsubscribe: async () => {
      // Matches the B1 Rust contract:
      //   daemon_unsubscribe(subscription_id: String).
      // Tauri's serde bridge maps the JS camelCase `subscriptionId`
      // argument to the Rust snake_case parameter automatically.
      await invoke(CMD.unsubscribe, { subscriptionId: id });
    },
  };
}

/**
 * Low-level unsubscribe helper. Identical to
 * `DaemonSubscription.unsubscribe` but usable when the hook is given a
 * raw subscription_id (e.g. after reload, when the handle wrapper was
 * thrown away but the id persisted).
 */
export async function unsubscribeDaemon(
  subscriptionId: string,
): Promise<void> {
  await invoke(CMD.unsubscribe, { subscriptionId });
}

/**
 * Request Rust to spawn the sidecar. Resolves when the daemon
 * completes `rpc.hello` and transitions to `running`; rejects with an
 * `RpcError` on spawn failure, handshake failure, or version mismatch.
 */
export async function startDaemon(): Promise<void> {
  return invoke(CMD.startDaemon);
}

/**
 * Request Rust to kill the sidecar. Resolves when the child process
 * has exited and the Unix socket is removed.
 */
export async function stopDaemon(): Promise<void> {
  return invoke(CMD.stopDaemon);
}

/**
 * Last `RpcError` the Rust side raised (for display when the UI boots
 * straight into `error` state — e.g. the user kills the daemon, quits
 * pim-ui, and reopens before the daemon is running again).
 */
export async function lastDaemonError(): Promise<RpcError | null> {
  return invoke(CMD.getLastError);
}

/**
 * Internal Tauri event name constants, exported for the daemon-state
 * hook (Plan 03). Components MUST NOT use these directly — always go
 * through the hook — but the hook needs them to register the one
 * global listener per event name.
 */
export const DaemonEvents = EVT;

/**
 * Internal Tauri command name constants, exported for tests and for
 * the rare Plan-02 glue that needs to invoke by raw string. Prefer
 * the typed wrappers above.
 */
export const DaemonCommands = CMD;
