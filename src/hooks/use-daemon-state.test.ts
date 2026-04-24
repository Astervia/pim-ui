/**
 * Compile-only test for useDaemonState + DaemonStatusIndicator contracts.
 * Not imported at runtime. `tsc --noEmit` is the enforcement mechanism.
 */

import type {
  DaemonStateHookResult,
  DaemonActions,
} from "./use-daemon-state";
import type { DaemonSnapshot } from "@/lib/daemon-state";
import type {
  PeerDiscovered,
  PeerSummary,
  RpcError,
  RpcEventMap,
  RpcEventName,
  Status,
} from "@/lib/rpc-types";

// Action signatures.
const _check: DaemonActions = {
  start: async () => {},
  stop: async () => {},
  confirmStop: async () => {},
  dismissStopConfirm: () => {},
  subscribe: async <E extends keyof RpcEventMap>(
    _e: E,
    _h: (p: RpcEventMap[E]) => void,
  ) => ({ id: "uuid-0", unsubscribe: async () => {} }),
};

// Shape of the hook return.
const _shape: DaemonStateHookResult = {
  snapshot: {} as DaemonSnapshot,
  stopConfirmOpen: false,
  actions: _check,
};
void _shape;

// ─── Phase 2 Plan 01 — reactive spine extensions ─────────────────────
// The DaemonSnapshot MUST grow two new fields without renaming any
// existing Phase-1 field. If this block fails to compile, the hook's
// contract is either missing a field or mistyped.

const _snapshotExtended: DaemonSnapshot = {
  // Phase-1 fields — MUST still be present.
  state: "stopped",
  hello: null,
  status: null,
  baselineTimestamp: null,
  lastError: null,
  peerCount: 0,
  // Phase-2 additions (this plan).
  discovered: [] as PeerDiscovered[],
  subscriptionError: null as
    | { stream: RpcEventName; error: RpcError }
    | null,
};
void _snapshotExtended;

// The `discovered` field is typed as PeerDiscovered[] — assignability
// in both directions proves the field is an array of PeerDiscovered.
const _discovered: PeerDiscovered[] = _snapshotExtended.discovered;
void _discovered;

// subscriptionError uses the exact shape the plan specifies.
const _subErr: { stream: RpcEventName; error: RpcError } | null =
  _snapshotExtended.subscriptionError;
void _subErr;

// ─── Selector hook signatures (Phase 2 Plan 01) ──────────────────────
// These are thin wrappers over useDaemonState; their return types must
// equal the slice they project so downstream screens get narrow types.

import { useStatus } from "./use-status";
import { usePeers } from "./use-peers";
import { useDiscovered } from "./use-discovered";

// useStatus returns the nullable Status slice verbatim.
const _useStatus: () => Status | null = useStatus;
void _useStatus;

// usePeers returns PeerSummary[] — pre-sorted per D-13 but the type is
// just an array; the sort is a runtime guarantee, not a type-level one.
const _usePeers: () => PeerSummary[] = usePeers;
void _usePeers;

// useDiscovered returns PeerDiscovered[].
const _useDiscovered: () => PeerDiscovered[] = useDiscovered;
void _useDiscovered;

// Regression guard: the subscribe action signature must not drift.
// The shape below is copied verbatim from DaemonActions.subscribe; any
// change to DaemonActions that touches subscribe() will break this.
const _subscribeSig: <E extends keyof RpcEventMap>(
  event: E,
  handler: (params: RpcEventMap[E]) => void,
) => Promise<{ id: string; unsubscribe: () => Promise<void> }> =
  _check.subscribe;
void _subscribeSig;
