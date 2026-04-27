/**
 * <LinuxOnlyPanel /> — Gateway tab body for macOS / Windows.
 *
 * GATE-04 (REQUIREMENTS verbatim): On macOS / Windows, Gateway section
 * shows clear 'Gateway mode is Linux-only today' messaging (not hidden).
 *
 * Verbatim copy locked to SETUP-02 (already in production from Phase 01.1
 * per 05-CONTEXT D-10) so Aria's first impression doesn't shift.
 *
 * Rendered NOT HIDDEN — section is visible, with continuation paragraph
 * + platform/supported data lines + [ Open kernel repo ] action.
 *
 * W1: zero new Tauri-side subscriptions in this file.
 */

import { open as openUrl } from "@tauri-apps/plugin-shell";
import { cn } from "@/lib/utils";
import type { GatewayPlatform } from "@/lib/rpc-types";

const KERNEL_REPO_URL = "https://github.com/Astervia/proximity-internet-mesh";

export interface LinuxOnlyPanelProps {
  /** "macos" | "windows" | "other" — narrowed by GatewayScreen so "linux" never reaches here. */
  platform: GatewayPlatform;
}

export function LinuxOnlyPanel({ platform }: LinuxOnlyPanelProps) {
  async function openKernelRepo() {
    try {
      await openUrl(KERNEL_REPO_URL);
    } catch {
      // Non-fatal — opener errors are extremely rare; if openUrl fails
      // (no default browser, capability denied), the user can copy the
      // URL from the page source. We do NOT toast — that violates
      // P1 honest-over-polished by adding noise to a harmless edge case.
    }
  }

  return (
    <div className="flex flex-col gap-4 font-code text-sm">
      <p className="text-foreground">Gateway mode is Linux-only today.</p>
      <p className="text-foreground">
        Your device can still join a mesh as a client or relay. Gateway
        support for macOS and Windows depends on the kernel growing
        {" iptables-equivalent NAT — see the kernel repo for status."}
      </p>
      <div className="flex flex-col gap-1 text-muted-foreground">
        <span>{`· platform: ${platform}`}</span>
        <span>{`· supported: false`}</span>
      </div>
      <button
        type="button"
        onClick={openKernelRepo}
        className={cn(
          "self-start mt-2 px-3 py-1",
          "border border-border bg-transparent text-foreground",
          "hover:border-primary hover:text-primary",
          "font-mono text-xs uppercase tracking-wider",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
        )}
      >
        [ Open kernel repo ]
      </button>
    </div>
  );
}
