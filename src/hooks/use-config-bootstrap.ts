/**
 * useConfigBootstrap — D-13 5-step boot-sequence state machine.
 *
 * Stub: real implementation lands in Plan 01.1-03 Task 1 GREEN below.
 */

import type { FirstRunRole } from "@/lib/rpc";

export type BootstrapStatus =
  | "idle"
  | "writing_config"
  | "requesting_permission"
  | "starting_daemon"
  | "complete"
  | "failed";

export interface BootstrapError {
  step: "write_config" | "start_daemon";
  message: string;
}

export interface BootstrapHandle {
  runBootstrap(args: { nodeName: string; role: FirstRunRole }): Promise<void>;
  status: BootstrapStatus;
  error: BootstrapError | null;
  reset(): void;
}

export function useConfigBootstrap(): BootstrapHandle {
  throw new Error("not implemented");
}
