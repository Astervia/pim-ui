/**
 * Daemon-lifecycle state machine and the single snapshot the whole UI
 * reads from.
 *
 * The 5-state machine is locked by
 * `.planning/phases/01-rpc-bridge-daemon-lifecycle/01-UI-SPEC.md`
 * Surface 1 (DaemonStatusIndicator) — every downstream UI component
 * consults `DaemonState` to decide whether the toggle is disabled, the
 * LimitedModeBanner renders, the UptimeCounter ticks, etc. Adding a 6th
 * state requires a UI-SPEC revision.
 *
 * This module has ZERO runtime dependencies on `@tauri-apps/api` — it
 * exists so the React hook layer (Plan 03) and any component-level
 * helpers can import these types without dragging the Tauri surface
 * through tree-shaking.
 */

import type { HelloResult, RpcError, Status } from "./rpc-types";

/**
 * The 5 UI-SPEC states. Semantics (locked 2026-04-24):
 *   - stopped:      No daemon process exists. Limited-mode banner + Start.
 *   - starting:     Sidecar spawned; pre-rpc.hello. Blinking amber glyph.
 *   - running:      rpc.hello succeeded; status RPC has returned ≥1 snapshot.
 *   - reconnecting: Socket dropped while running; auto-retry in progress.
 *   - error:        Terminal failure — user must dismiss or retry manually.
 */
export type DaemonState =
  | "stopped"
  | "starting"
  | "running"
  | "reconnecting"
  | "error";

/**
 * The two states during which:
 *   1. The DaemonToggle shows a blinking amber glyph.
 *   2. Click-to-toggle is disabled (no new start/stop request while one
 *      is already in flight).
 * Kept as a `readonly` tuple so `isTransientState` is a simple includes
 * check without allocating per call.
 */
export const TRANSIENT_STATES: readonly DaemonState[] = [
  "starting",
  "reconnecting",
] as const;

/** True when the toggle must be disabled and UI should surface progress. */
export function isTransientState(s: DaemonState): boolean {
  return (TRANSIENT_STATES as readonly string[]).includes(s);
}

/**
 * The single snapshot the entire UI consumes. Held by the
 * `useDaemonState` hook (Plan 03). Every field is daemon-sourced; the
 * UI never fabricates values — if the daemon hasn't said something yet,
 * the field is `null` (or `0` for `peerCount`) and consumers must
 * render a placeholder rather than guess.
 */
export interface DaemonSnapshot {
  state: DaemonState;
  /**
   * Populated on the first successful `rpc.hello` after spawn. Null
   * while `starting`, while `stopped`, or after an `error` that
   * preceded the handshake.
   */
  hello: HelloResult | null;
  /** Latest `status` RPC snapshot. Null until the first success. */
  status: Status | null;
  /**
   * `Date.now()` at the moment `status` was received. UptimeCounter
   * uses this as the anchor so the displayed uptime is daemon-sourced
   * (uptime_s + drift from local clock since snapshot).
   */
  baselineTimestamp: number | null;
  /** Last RPC error; drives LimitedModeBanner copy when state === "error". */
  lastError: RpcError | null;
  /**
   * Number of peers with `state === "active"`. Cached from
   * `status.peers` so DaemonToggle can gate the stop-confirmation
   * dialog ("you have N active peers — really stop?") without
   * recomputing.
   */
  peerCount: number;
}

/** Initial snapshot used before the Rust shell has reported anything. */
export const INITIAL_SNAPSHOT: DaemonSnapshot = {
  state: "stopped",
  hello: null,
  status: null,
  baselineTimestamp: null,
  lastError: null,
  peerCount: 0,
};

/**
 * Payload of the Tauri `daemon://state-changed` event emitted by the
 * Rust shell (Plan 02). The Rust side bundles whatever is known at the
 * moment of the transition so the UI can avoid a follow-up RPC round-
 * trip — e.g. on `stopped → starting → running` the hook typically
 * receives the first `hello` and `status` together with the `running`
 * event.
 */
export interface DaemonStateChange {
  state: DaemonState;
  error?: RpcError;
  /** Set when state transitions to `running` — carries first post-hello status. */
  status?: Status;
  hello?: HelloResult;
}
