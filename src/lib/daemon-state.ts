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

import type {
  HelloResult,
  PeerDiscovered,
  RpcError,
  RpcEventName,
  Status,
} from "./rpc-types";

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

// ─── Phase 01.1 D-19 crash-on-boot last-error widening ────────────────
//
// Plan 01.1-01 (Rust) emits a `daemon://state-changed` event whose
// payload.error is an RpcError carrying
// `data: { kind: "crash_on_boot", path, stderr_tail, elapsed_ms,
// exit_code, signal }` when Sidecar::Terminated fires within 500 ms
// of spawn (D-18). The existing state-changed listener in
// `src/hooks/use-daemon-state.ts` (L 347-387, UNTOUCHED by this plan)
// already merges payload.error verbatim into snapshot.lastError —
// so the value stored there is structurally an RpcError whose `data`
// MAY carry the D-19 discriminator.
//
// We expose this as a discriminated union so consumers can narrow
// with `isCrashOnBoot(err)` and project to a canonical
// `CrashOnBootError` with `pickCrashOnBoot(err)`. The narrowing
// helpers concentrate the "peek inside RpcError.data" logic in one
// place; Plan 01.1-04 LimitedModeBanner reads
// `pickCrashOnBoot(snapshot.lastError)` and renders the canonical
// fields without re-parsing.
//
// CRITICAL: there is NO new Tauri event channel for crash-on-boot.
// The W1 cross-phase invariant (`listen(` count in use-daemon-state.ts
// stays at exactly 2) is preserved because the crash payload rides
// on the existing state-changed event.

/**
 * D-19 canonical crash-on-boot variant. Lifted out of `RpcError.data`
 * by `pickCrashOnBoot()` for ergonomic rendering in LimitedModeBanner
 * (Plan 01.1-04). The wire-side shape (Plan 01.1-01 `report_crash_on_boot`)
 * also includes optional `exit_code` and `signal`; we omit them from
 * this canonical projection because the banner copy
 * (D-20: "pim-daemon exited in {elapsed_ms} ms during startup. Check
 * config at {path}.") only needs path / stderr_tail / elapsed_ms.
 * Consumers that need exit_code / signal can still read them off the
 * underlying RpcError.data.
 */
export interface CrashOnBootError {
  kind: "crash_on_boot";
  path: string;
  stderr_tail: string;
  elapsed_ms: number;
}

/**
 * Discriminated union held by `DaemonSnapshot.lastError`. Two variants:
 *
 * - `(RpcError & { kind?: "rpc_error" })` — the historic shape, what
 *   every existing consumer has been writing to lastError since
 *   Phase 1. The optional `kind: "rpc_error"` literal (always
 *   absent on the wire) is the discriminator-by-absence that lets
 *   TS treat this as a non-crash variant when narrowing.
 * - `CrashOnBootError` — the canonical crash variant, narrowed-to
 *   by `isCrashOnBoot()`.
 *
 * Backward compat: any plain RpcError (no `kind` field) structurally
 * matches the rpc_error variant, so existing assignments at
 * use-daemon-state.ts L 347-387 (`lastError: payload.error ?? …`)
 * remain type-compatible without changing that file.
 */
export type DaemonLastError =
  | (RpcError & { kind?: "rpc_error" })
  | CrashOnBootError;

/**
 * D-19: type-narrow `snapshot.lastError` to the crash_on_boot variant.
 *
 * Implementation: the value stored in snapshot.lastError today is the
 * RpcError emitted by Plan 01.1-01's `daemon://state-changed` event.
 * The discriminator lives on `error.data.kind`. We treat
 * `(rpcError.data as { kind?: string })?.kind === "crash_on_boot"` as
 * the narrow signal AND accept a pre-narrowed CrashOnBootError (where
 * `kind` lives at the top level) for callers that already projected.
 *
 * Bang-free per project policy — every negation expressed as
 * `=== null`, `=== false`, or ternary inversion.
 */
export function isCrashOnBoot(
  e: DaemonLastError | null,
): e is CrashOnBootError {
  if (e === null) return false;
  // Already-narrowed crash variant: `kind` literal at the top level.
  if ((e as { kind?: string }).kind === "crash_on_boot") return true;
  // Otherwise peek at the rpc_error variant's `data` field — Plan 01.1-01
  // embeds the discriminator there per the D-19 routing decision.
  const rpcLike = e as RpcError;
  const data = rpcLike.data as { kind?: string } | undefined;
  if (data === undefined) return false;
  return data.kind === "crash_on_boot";
}

/**
 * D-19 ergonomic projection: lift the crash discriminator out of
 * `RpcError.data` into the canonical `CrashOnBootError` shape so
 * Plan 01.1-04's banner can render `{path, stderr_tail, elapsed_ms}`
 * directly without re-parsing the inner JSON. Returns `null` when
 * the input is not a crash variant.
 *
 * Rationale: concentrating the "peek and lift" logic here means
 * downstream consumers stay free of `(err.data as …)` assertions and
 * the union-shape can change in one place if Plan 01.1-01's payload
 * format ever evolves.
 */
export function pickCrashOnBoot(
  e: DaemonLastError | null,
): CrashOnBootError | null {
  if (isCrashOnBoot(e) === false) return null;
  // After the type-predicate, TS has narrowed `e` to `CrashOnBootError`.
  // At runtime, however, `e` may still be the RpcError-with-crash-data
  // variant (the on-the-wire shape from Plan 01.1-01) — the predicate
  // accepts both. Two-step cast (`as unknown as …`) bypasses TS's view
  // so we can inspect both runtime shapes and return the canonical one.
  // Already-narrowed crash variant — top-level `kind` literal present.
  if ((e as { kind?: string }).kind === "crash_on_boot") {
    return e as CrashOnBootError;
  }
  // Otherwise the value is structurally an RpcError whose `data` carries
  // the discriminator. Lift the canonical fields.
  const rpcLike = e as unknown as RpcError;
  const data = rpcLike.data as {
    kind: "crash_on_boot";
    path: string;
    stderr_tail: string;
    elapsed_ms: number;
  };
  return {
    kind: "crash_on_boot",
    path: data.path,
    stderr_tail: data.stderr_tail,
    elapsed_ms: data.elapsed_ms,
  };
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
  /**
   * Last RPC error; drives LimitedModeBanner copy when state === "error".
   *
   * Phase 01.1 widening: `DaemonLastError` is a discriminated union
   * accepting both the historic plain `RpcError` shape (every consumer
   * since Phase 1 writes this) and the new `CrashOnBootError` variant
   * (D-19, populated implicitly when Plan 01.1-01's state-changed event
   * carries an RpcError whose `data.kind === "crash_on_boot"`). Narrow
   * via `isCrashOnBoot(lastError)` and project via
   * `pickCrashOnBoot(lastError)` — both helpers exported from this
   * module. The backward-compat variant (`RpcError & { kind?: "rpc_error" }`)
   * means existing assignments in use-daemon-state.ts L 347-387 are
   * type-compatible without modification (W1 invariant preserved).
   */
  lastError: DaemonLastError | null;
  /**
   * Number of peers with `state === "active"`. Cached from
   * `status.peers` so DaemonToggle can gate the stop-confirmation
   * dialog ("you have N active peers — really stop?") without
   * recomputing.
   */
  peerCount: number;
  /**
   * Nearby-but-unpaired peers — mirrors `peers.discovered` RPC seed +
   * `peers.event { kind: "discovered" }` stream updates. Used by the
   * Phase-2 `NEARBY — NOT PAIRED` panel (D-19) and the Pair Approval
   * modal's outbound path (D-21).
   */
  discovered: PeerDiscovered[];
  /**
   * Last error raised by a `subscribe(...)` call that exhausted its
   * retry-once attempt (D-31). Null when all streams are healthy. The
   * subscription-failure toast (Plan 02-06) reads this field; this plan
   * only STORES the error — toast rendering is intentionally deferred.
   */
  subscriptionError: { stream: RpcEventName; error: RpcError } | null;
}

/** Initial snapshot used before the Rust shell has reported anything. */
export const INITIAL_SNAPSHOT: DaemonSnapshot = {
  state: "stopped",
  hello: null,
  status: null,
  baselineTimestamp: null,
  lastError: null,
  peerCount: 0,
  discovered: [],
  subscriptionError: null,
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
