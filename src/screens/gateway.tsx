/**
 * <GatewayScreen /> — Phase 5 Plan 05-01 placeholder route.
 *
 * Plan 05-01 wires the ⌘4 sidebar route + AppShell keyboard binding.
 * The pre-flight + Linux-only messaging UI ships in Plan 05-02.
 * The active-state gauge + throughput + peer-through-me list ships in
 * Plan 05-03. This file exists ONLY so that active === "gateway"
 * resolves to a real React component instead of triggering the
 * assertNever exhaustiveness check in active-screen.tsx.
 *
 * Brand discipline applied even on the placeholder:
 *   - CliPanel wrapper (brand hero primitive)
 *   - lowercase prose, no exclamation marks
 *   - radius-0 inherited from CliPanel
 */

import { CliPanel } from "@/components/brand/cli-panel";

export function GatewayScreen() {
  return (
    <div className="max-w-5xl">
      <CliPanel title="gateway" status={{ label: "READY", variant: "muted" }}>
        <p className="font-code text-sm text-muted-foreground">
          gateway tab — pre-flight UI ships in plan 05-02; active state ships in plan 05-03.
        </p>
      </CliPanel>
    </div>
  );
}
