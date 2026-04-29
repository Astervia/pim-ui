/**
 * <SimpleShell /> — minimal shell for simple mode.
 *
 * Unlike AppShell (sidebar + tabs + ⌘K + banner stack), this shell has
 * a tiny topbar and a single content pane that toggles between
 * `SimpleModeScreen` and `SimpleSettingsScreen`. No tab nav, no command
 * palette. ⌘, opens settings; ⌘\ flips simple ↔ advanced.
 *
 * Reuses:
 *   - <Toaster /> (sonner) — RPC fail/success feedback
 *   - <ReconnectToast /> — fires when socket drops
 *   - <SubscriptionErrorToast /> — fires when subscribe fails
 *   - <BluetoothPermissionDialog /> — pre-warm macOS permissions
 *
 * Does NOT mount <CommandPalette />, <PairApprovalModal />,
 * <PeerDetailSheet /> or any other power-user surface. The
 * SimpleModeScreen approves pairs through the centered card.
 *
 * Does NOT mount <BannerStack /> either — the limited-mode banner +
 * [ START DAEMON ] button are redundant here because the SimpleScreen
 * "off" state already shows a big TURN ON button.
 */

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ReconnectToast } from "@/components/brand/reconnect-toast";
import { StopConfirmDialog } from "@/components/brand/stop-confirm-dialog";
import { SubscriptionErrorToast } from "@/components/brand/subscription-error-toast";
import { BluetoothPermissionDialog } from "@/components/permissions/bluetooth-permission-dialog";
import { useAppMode } from "@/hooks/use-app-mode";
import { useLogsSubscriptionLifecycle } from "@/hooks/use-logs-stream";
import { SimpleModeScreen } from "@/screens/simple-mode";
import { SimpleSettingsScreen } from "@/screens/simple-settings";
import { cn } from "@/lib/utils";

type SimpleSurface = "home" | "settings";

export function SimpleShell() {
  const { setMode } = useAppMode();
  const [surface, setSurface] = useState<SimpleSurface>("home");
  // Even in simple mode the logs subscription lifecycle is needed so
  // the daemon's internal telemetry stays in sync — the hook renders
  // nothing on its own, zero visible cost.
  useLogsSubscriptionLifecycle();

  // Shortcuts:
  //   ⌘, / Ctrl+, → toggle home ↔ settings (macOS Preferences idiom)
  //   ⌘\ / Ctrl+\ → switch to advanced mode
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const hasMod = e.metaKey === true || e.ctrlKey === true;
      if (hasMod === false) return;
      if (e.shiftKey === true || e.altKey === true) return;
      if (e.key === ",") {
        e.preventDefault();
        setSurface((s) => (s === "home" ? "settings" : "home"));
      } else if (e.key === "\\") {
        e.preventDefault();
        setMode("advanced");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* ── Minimal topbar ──────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <button
          type="button"
          onClick={() => setSurface("home")}
          aria-label="go home"
          className="font-mono text-base flex items-baseline gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <span aria-hidden="true" className="phosphor text-primary">
            █
          </span>
          <span className="text-foreground">pim</span>
        </button>
        <nav aria-label="actions" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setSurface((s) => (s === "settings" ? "home" : "settings"))
            }
            aria-pressed={surface === "settings"}
            className={cn(
              "px-3 py-2 font-mono text-xs uppercase tracking-[0.2em]",
              "transition-colors duration-100 ease-linear",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
              surface === "settings"
                ? "text-primary"
                : "text-text-secondary hover:text-foreground",
            )}
          >
            {surface === "settings" ? "[ home ]" : "[ settings ]"}
          </button>
          <button
            type="button"
            onClick={() => setMode("advanced")}
            title={"switch to advanced mode (⌘\\)"}
            className="px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary hover:text-accent transition-colors duration-100 ease-linear focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            advanced mode →
          </button>
        </nav>
      </header>

      {/* ── Content ────────────────────────────────────────── */}
      <main aria-label="content" className="flex-1 flex flex-col">
        {surface === "home" ? <SimpleModeScreen /> : <SimpleSettingsScreen />}
      </main>

      {/* ── Global chrome ──────────────────────────────────── */}
      <ReconnectToast />
      <StopConfirmDialog />
      <SubscriptionErrorToast />
      <BluetoothPermissionDialog />
      <Toaster
        position="bottom-right"
        offset={16}
        duration={3000}
        toastOptions={{
          className:
            "font-mono rounded-none border border-border border-l-2 border-l-primary bg-card text-foreground",
          style: { borderRadius: 0 },
          classNames: {
            error: "border-destructive border-l-destructive",
          },
        }}
      />
    </div>
  );
}
