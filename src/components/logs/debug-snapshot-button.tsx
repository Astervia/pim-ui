/**
 * DebugSnapshotButton — placeholder stub.
 *
 * Real implementation lands in Phase 3 03-03 Task 2 (OBS-03) — assembles
 * the D-23 schema-conformant JSON, downloads via Blob + <a download>,
 * and fires a sonner success / failure toast (D-32 routing on failure).
 *
 * This stub exists so Task 1's three-row LogFilterBar can wire the
 * button into row 3 with a stable import path; Task 2 fills in the
 * actual click handler + toast.
 */

import { Button } from "@/components/ui/button";

export interface DebugSnapshotButtonProps {
  className?: string;
}

export function DebugSnapshotButton({ className }: DebugSnapshotButtonProps) {
  return (
    <Button type="button" variant="default" disabled className={className}>
      [ Export debug snapshot ]
    </Button>
  );
}
