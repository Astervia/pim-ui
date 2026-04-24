/**
 * useStatus — thin selector over `useDaemonState().snapshot.status`.
 *
 * Returns the nullable live `Status` slice. React 19's compiler handles
 * memoization downstream; this hook does NOT wrap the value in its own
 * `useMemo`. Consumers that need a specific sub-field (e.g. just
 * `status.peers`) should compose with `usePeers` rather than selecting
 * via `useStatus().peers` — the narrower hook avoids re-rendering when
 * unrelated status fields change (e.g. `uptime_s`).
 *
 * Contract: returns `null` until the first `rpc.hello + status` round-
 * trip has completed (Phase-1 Plan 03 invariant). Consumers render a
 * loading/last-seen affordance in that window — NEVER placeholder zeros
 * (P1 + D-07).
 */

import type { Status } from "@/lib/rpc-types";
import { useDaemonState } from "./use-daemon-state";

export function useStatus(): Status | null {
  return useDaemonState().snapshot.status;
}
