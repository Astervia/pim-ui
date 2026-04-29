/**
 * <BannerStack /> — single mount point for system-state banners.
 *
 * Stack order is fixed: KillSwitchBanner (most critical) above
 * LimitedModeBanner. Each banner self-derives visibility from
 * useDaemonState / useKillSwitch and renders nothing when its condition
 * is false — the stack is therefore a pure ordering decision, not a
 * state machine.
 *
 * Mount once in AppShell above ActiveScreen. This removes the previous
 * split where Dashboard rendered LimitedModeBanner inline (causing
 * duplicate banners during transitions on screens that also rendered
 * their own).
 *
 * The wrapper itself owns no styling beyond the gap so each banner
 * keeps its own border + bg treatment.
 */

import { KillSwitchBanner } from "@/components/brand/kill-switch-banner";
import { LimitedModeBanner } from "@/components/brand/limited-mode-banner";

export function BannerStack() {
  return (
    <div className="flex flex-col gap-3">
      <KillSwitchBanner />
      <LimitedModeBanner />
    </div>
  );
}
