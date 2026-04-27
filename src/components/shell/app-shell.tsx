/**
 * <AppShell /> — Phase-2 top-level layout (D-01, D-02, D-03).
 *
 * Composes Sidebar + <main> + ActiveScreen into the approved UI-SPEC §S1
 * shape. The flat Phase-1 "centered max-w-6xl main" wrapper is replaced
 * here; AppShell now owns the full viewport.
 *
 * Scroll lives in the <main> content pane (overflow-y-auto), not the
 * window — the sidebar must stay pinned while long screens (Logs tab,
 * many peers) scroll inside the right pane.
 *
 * Global keyboard shortcuts (02-UI-SPEC §Accessibility §Keyboard nav
 * + 03-UI-SPEC §Keyboard navigation + 04-CONTEXT D-16):
 *   ⌘1 / Ctrl+1 → dashboard
 *   ⌘2 / Ctrl+2 → peers (Phase 3 Plan 03-01 D-02: now its own dedicated
 *                  route; Plan 03-02 populates the screen)
 *   ⌘3 / Ctrl+3 → routing (Phase 4 Plan 04-03 D-16: ⌘3 routes to the
 *                  Routing tab; Plan 04-03 populates the screen)
 *   ⌘5 / Ctrl+5 → logs
 *   ⌘6 / Ctrl+6 → settings (Phase 3 Plan 03-01 D-01: now active; Plan
 *                  03-04 populates the screen)
 *   ⌘, / Ctrl+, → alias for ⌘6 (macOS Preferences idiom per 03-UI-SPEC
 *                  §Shell chrome note)
 *   ⌘↑ / Ctrl+↑ → dispatches `pim:settings-collapse-all` window event
 *                  (Plan 03-04 SettingsScreen listens). No-op on other tabs.
 *   ⌘↓ / Ctrl+↓ → dispatches `pim:settings-expand-all` window event.
 *                  No-op on other tabs.
 *
 * The handler ignores modifier combinations other than plain meta/ctrl —
 * ⌘⇧1 / ⌘⌥1 etc. pass through so browser + DevTools shortcuts stay live.
 *
 * W1 contract: window.addEventListener('keydown', …) is a BROWSER event,
 * not a Tauri event — `listen(...)` from @tauri-apps/api/event is NOT
 * called here. Custom-event dispatch (window.dispatchEvent + addEventListener
 * on Plan 03-04 side) is also browser-native, not Tauri.
 *
 * Extension seams (Wave 2):
 *   - Plans 02-03/04/05 mount screen content inside ActiveScreen (not
 *     here) — this file intentionally exposes NO props or slots.
 *   - If a future plan needs an app-wide overlay (e.g. Pair Approval
 *     modal), render it from main.tsx alongside TunPermissionProvider,
 *     NOT here — AppShell stays focused on the Sidebar + main split.
 *
 * Phase 4 D-08: <InvitePeerSheet /> mounted at shell level alongside
 * ReconnectToast / StopConfirmDialog, so the slide-over overlays every
 * screen and its open state survives ⌘1/⌘2/⌘3 tab switches. The trigger
 * (PeerListPanel's [ Invite peer ] button) lives on the Dashboard but
 * the Sheet must NOT unmount when the user navigates away — module-level
 * useInvitePeer atom is the shared boolean.
 *
 * Phase 4 D-21: <KillSwitchBanner /> mounted above <ActiveScreen />
 * inside <main>. Banner derives visibility from useKillSwitch() —
 * renders only when route_on===true && selected_gateway===null. Sits
 * above the active-screen content but inside the main content pane so
 * it scrolls with the page if content overflows (mirrors
 * LimitedModeBanner placement convention).
 */

import { useEffect } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "./sidebar";
import { ActiveScreen } from "./active-screen";
import { useActiveScreen } from "@/hooks/use-active-screen";
import { ReconnectToast } from "@/components/brand/reconnect-toast";
import { StopConfirmDialog } from "@/components/brand/stop-confirm-dialog";
import { SubscriptionErrorToast } from "@/components/brand/subscription-error-toast";
import { InvitePeerSheet } from "@/components/brand/invite-peer-sheet";
import { KillSwitchBanner } from "@/components/brand/kill-switch-banner";

export function AppShell() {
  const { active, setActive } = useActiveScreen();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Only plain meta/ctrl combos. Bail on meta+shift, meta+alt, etc.
      const hasMod = e.metaKey === true || e.ctrlKey === true;
      if (hasMod === false) return;
      if (e.shiftKey === true || e.altKey === true) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          setActive("dashboard");
          break;
        case "2":
          // Plan 03-01 D-02: peers is now a dedicated route (no longer
          // aliased to Dashboard).
          e.preventDefault();
          setActive("peers");
          break;
        case "3":
          // Plan 04-03 D-16: ⌘3 routes to the Routing tab.
          e.preventDefault();
          setActive("routing");
          break;
        case "5":
          e.preventDefault();
          setActive("logs");
          break;
        case "6":
          // Plan 03-01 D-01: ⌘6 routes to Settings.
          e.preventDefault();
          setActive("settings");
          break;
        case ",":
          // ⌘, alias for ⌘6 (macOS Preferences idiom per 03-UI-SPEC
          // §Shell chrome note). Swallow so it does NOT trigger Tauri's
          // native Preferences menu.
          e.preventDefault();
          setActive("settings");
          break;
        case "ArrowUp":
          // D-06: ⌘↑ collapses all settings sections — no-op on other
          // tabs. Plan 03-04 SettingsScreen binds the listener for
          // ownership-by-the-Settings-surface (browser CustomEvent, NOT
          // a Tauri listen() — W1 preserved).
          if (active === "settings") {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("pim:settings-collapse-all"));
          }
          break;
        case "ArrowDown":
          // D-06: ⌘↓ expands all settings sections — no-op on other tabs.
          if (active === "settings") {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("pim:settings-expand-all"));
          }
          break;
        default:
          return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, setActive]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main
        aria-label="content"
        className="flex-1 overflow-y-auto px-8 py-8"
      >
        {/* Phase 4 D-21: KillSwitchBanner sits above active-screen content
            but inside <main> so it scrolls with the page on overflow. The
            banner self-derives visibility from useKillSwitch() and
            renders nothing when the kill-switch condition is false. */}
        <KillSwitchBanner />
        <ActiveScreen />
      </main>
      {/* App-level chrome moved from Dashboard by Plan 02-03 — neither
          component renders visible UI unless its state triggers it, and
          both consume useDaemonState directly. They belong at the shell
          layer rather than inside a specific screen. */}
      <ReconnectToast />
      <StopConfirmDialog />
      {/* Phase 4 D-08 (Plan 04-05): InvitePeerSheet sibling so the
          right-edge slide-over overlays every screen; its open state
          survives ⌘1/⌘2/⌘3 tab switches via the module-level
          useInvitePeer atom. */}
      <InvitePeerSheet />

      {/* Sonner Toaster — single app-wide toast container. Previously
          mounted as <ReconnectToaster /> in main.tsx; consolidated here
          (Plan 02-06) so both Phase-1 ReconnectToast and Phase-2
          SubscriptionErrorToast share one container, matching the
          user-critical-invariant "don't conflict with existing toast usage."
          Position + styling preserved from the Phase-1 ReconnectToaster. */}
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
      {/* Watchers — null-rendering logical components that read snapshot
          state and fire toasts on transitions. ReconnectToast (Phase 1)
          is mounted above; SubscriptionErrorToast (Plan 02-06 / D-31)
          fires on snapshot.subscriptionError changes. */}
      <SubscriptionErrorToast />
    </div>
  );
}
