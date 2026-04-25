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
  /**
   * Plan 01.1-01: writes platform-correct user-scope `pim.toml` with the
   * D-16 default template, keyed on node name + role. Atomic (tmp+fsync+
   * rename per D-14). Returns { path }.
   */
  bootstrapConfig: "bootstrap_config",
  /**
   * Plan 01.1-01: stat-checks the resolved user-scope pim.toml path.
   * D-22 behavior — treats fs errors (EIO/EACCES/…) as `exists: false`
   * so the AppRoot gate always lands on first-run on a stat failure.
   */
  configExists: "config_exists",
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

// ─── Phase 01.1 first-run config bootstrap (SETUP-01/02) ─────────────
//
// These two wrappers are Tauri commands, NOT JSON-RPC methods — they
// bridge the UI to the Rust shell's filesystem operations, not the
// pim-daemon wire. They deliberately live in rpc.ts (not rpc-types.ts)
// because they have no entry in `RpcMethodMap`.
//
// W1 contract (unchanged by this plan): rpc.ts still owns ZERO Tauri
// event subscriptions. Plan 01.1-01 routes the crash-on-boot signal
// through the EXISTING `daemon://state-changed` event whose RpcError
// payload.data carries the D-19 discriminator — see daemon-state.ts
// `DaemonLastError` + `isCrashOnBoot` helper. No new event channel
// here; `DaemonEvents` (aliased as `EVT` below) keeps its two keys.

/**
 * D-08 role union. The Rust `Role` enum
 * (`src-tauri/src/daemon/default_config.rs`) uses
 * `#[serde(rename_all = "snake_case")]`, so the wire values are
 * `"join_the_mesh"` / `"share_my_internet"` exactly. FirstRunScreen
 * (Plan 01.1-03) pre-selects `"join_the_mesh"` per D-08 and disables
 * the gateway radio on macOS/Windows per D-08 platform gate.
 */
export type FirstRunRole = "join_the_mesh" | "share_my_internet";

/**
 * Arguments to `bootstrap_config`. camelCase on the JS side; Tauri
 * serde auto-maps `nodeName` to Rust `node_name` (same pattern as the
 * existing `subscriptionId` → `subscription_id` marshal at the
 * unsubscribe wrapper above). `role` passes through the literal-union
 * string directly.
 *
 * Defined as a `type` (not `interface`) so it structurally extends
 * `Record<string, unknown>` and satisfies Tauri's `InvokeArgs`
 * constraint without a manual index signature. Same trick the
 * @tauri-apps/api types use for typed-args internally.
 */
export type BootstrapConfigArgs = {
  /** Device name, e.g. "pedro-macbook". Validated client-side per D-11. */
  nodeName: string;
  /** D-08 role; maps to `[roles] gateway = true|false` in the template. */
  role: FirstRunRole;
};

/**
 * Result of `bootstrap_config`. The absolute resolved path the Rust
 * side atomically wrote (D-14). Surfaced in the first-run footer
 * line per D-10 and in the step-2-failure copy per D-13.
 */
export interface BootstrapConfigResult {
  /** Absolute path on disk, e.g. `/Users/pedro/Library/Application Support/pim/pim.toml`. */
  path: string;
}

/**
 * D-13 step 2: write the platform-correct user-scope `pim.toml` with
 * the D-16 default template. Rust creates the parent dir at 0o700 on
 * Unix (D-06), writes atomically (tmp+fsync+rename per D-14), and
 * returns the absolute path. Structured error on each failure mode
 * (permission denied, read-only FS, etc.) — rendered by Plan 01.1-03
 * FirstRunScreen as the step-2 inline-error copy.
 */
export async function bootstrapConfig(
  args: BootstrapConfigArgs,
): Promise<BootstrapConfigResult> {
  return invoke(CMD.bootstrapConfig, args);
}

/**
 * Result of `config_exists`. Both fields are always present — on a
 * stat failure (D-22), Rust returns `{ exists: false, path: <resolved> }`
 * so the UI can still render the footer-line path even when no file
 * is on disk yet.
 */
export interface ConfigExistsResult {
  exists: boolean;
  /** Absolute path the daemon will look at — resolved even when exists=false. */
  path: string;
}

/**
 * D-01 AppRoot one-shot gate: ask Rust if the user-scope `pim.toml`
 * exists at the platform-resolved path. Returns `{ exists, path }`.
 * On any fs error, Rust swallows to `exists: false` per D-22 so the
 * gate always lands on FirstRunScreen when there is no usable config
 * (Plan 01.1-03 consumes this).
 */
export async function configExists(): Promise<ConfigExistsResult> {
  return invoke(CMD.configExists);
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
