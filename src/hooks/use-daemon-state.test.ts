/**
 * Compile-only test for useDaemonState + DaemonStatusIndicator contracts.
 * Not imported at runtime. `tsc --noEmit` is the enforcement mechanism.
 */

import type {
  DaemonStateHookResult,
  DaemonActions,
} from "./use-daemon-state";
import type { DaemonSnapshot } from "@/lib/daemon-state";
import type { RpcEventMap } from "@/lib/rpc-types";

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
