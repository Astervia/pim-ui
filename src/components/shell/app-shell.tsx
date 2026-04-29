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
 * + 03-UI-SPEC §Keyboard navigation + 04-CONTEXT D-16 + 05-CONTEXT D-03/D-29/D-42):
 *   ⌘1 / Ctrl+1 → dashboard
 *   ⌘2 / Ctrl+2 → peers (Phase 3 Plan 03-01 D-02: now its own dedicated
 *                  route; Plan 03-02 populates the screen)
 *   ⌘3 / Ctrl+3 → routing (Phase 4 Plan 04-03 D-16: ⌘3 routes to the
 *                  Routing tab; Plan 04-03 populates the screen)
 *   ⌘4 / Ctrl+4 → gateway (Phase 5 Plan 05-01 D-03: ⌘4 routes to the
 *                  Gateway tab; Plan 05-02/05-03 populate the body)
 *   ⌘5 / Ctrl+5 → logs
 *   ⌘6 / Ctrl+6 → settings (Phase 3 Plan 03-01 D-01: now active; Plan
 *                  03-04 populates the screen)
 *   ⌘, / Ctrl+, → alias for ⌘6 (macOS Preferences idiom per 03-UI-SPEC
 *                  §Shell chrome note)
 *   ⌘K / Ctrl+K → toggles the command palette (Phase 5 Plan 05-01 D-03 +
 *                  D-29: stub atom in src/lib/command-palette/state.ts;
 *                  Plan 05-05 replaces with the real Dialog)
 *   ⌘↑ / Ctrl+↑ → dispatches `pim:settings-collapse-all` window event
 *                  (Plan 03-04 SettingsScreen listens). No-op on other tabs.
 *   ⌘↓ / Ctrl+↓ → dispatches `pim:settings-expand-all` window event.
 *                  No-op on other tabs.
 *
 * The handler ignores modifier combinations other than plain meta/ctrl —
 * ⌘⇧1 / ⌘⌥1 etc. pass through so browser + DevTools shortcuts stay live.
 *
 * W1 contract: window.addEventListener('keydown', …) is a BROWSER event,
 * not a Tauri event — the Tauri-API subscription helper from
 * @tauri-apps/api/event is NOT used here. Custom-event dispatch
 * (window.dispatchEvent + addEventListener on Plan 03-04 side) is
 * also browser-native, not Tauri.
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
 *
 * Phase 5 Plan 05-06 D-31 + TBD-PHASE-4-G: a single
 * `pim://open-add-peer` Tauri event subscription lives in this file —
 * the documented exception to the W1 invariant. The event is a CUSTOM
 * Tauri event emitted by Plan 05-04's tray popover Add-peer click and
 * Plan 05-05's command-palette `peers.add_nearby` action. It is NOT
 * carried by the daemon's `daemon://rpc-event` channel, so it does not
 * fall under the daemon-event-domain W1 contract (which governs
 * src/lib/rpc.ts + src/hooks/use-daemon-state.ts only). Do NOT add any
 * other Tauri-API subscriptions in this file.
 *
 * Phase 5 Plan 05-06 D-31: <GatewayNotificationsListener /> mounts at
 * shell level alongside <SubscriptionErrorToast /> + <CommandPalette />.
 * The listener subscribes via actions.subscribe (W1 fan-out, no new
 * Tauri listener) to status.event + peers.event + gateway.event and
 * dispatches per-event toasts / OS notifications per the policy at
 * src/lib/notifications/policy.ts.
 */

import { useEffect } from "react";
import { Toaster } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./sidebar";
import { ActiveScreen } from "./active-screen";
import { useActiveScreen } from "@/hooks/use-active-screen";
// Plan 03-04 §Part H.3 (checker Blocker 1) — D-13: keyboard nav routes
// through requestActive so dirty Settings sections open the discard
// dialog before ⌘1/2/3/5/6 actually change tab.
import { requestActive } from "@/hooks/use-gated-navigation";
import { ReconnectToast } from "@/components/brand/reconnect-toast";
import { StopConfirmDialog } from "@/components/brand/stop-confirm-dialog";
import { SubscriptionErrorToast } from "@/components/brand/subscription-error-toast";
import { InvitePeerSheet } from "@/components/brand/invite-peer-sheet";
import { BannerStack } from "./banner-stack";
// Phase 5 Plan 05-01 D-03 + D-29: ⌘K toggles the command palette atom.
// Plan 05-05 replaced the Plan 05-01 stub at src/lib/command-palette/state.ts
// with the real module-level atom + useSyncExternalStore — this import path
// stays the same; the atom shape stayed identical so this call site needs
// zero changes.
import { useCommandPalette } from "@/lib/command-palette/state";
// Plan 05-05 D-28: <CommandPalette /> mounts ONCE at AppShell level next
// to <Toaster /> + <SubscriptionErrorToast />. Reads the same
// useCommandPalette atom we toggle via ⌘K above.
import { CommandPalette } from "@/components/command-palette";
// Plan 05-06 D-31: <GatewayNotificationsListener /> mounts ONCE at AppShell
// level next to <SubscriptionErrorToast /> + <CommandPalette />. Subscribes
// to status.event + peers.event + gateway.event via the W1 fan-out and
// dispatches per-event to toast / system / both per the policy table.
import { GatewayNotificationsListener } from "@/hooks/use-gateway-notifications";

export function AppShell() {
  const { active, setActive } = useActiveScreen();
  // Phase 5 Plan 05-01 D-03: ⌘K binding calls togglePalette(). Stub
  // implementation is a no-op until Plan 05-05 ships the real atom.
  const { toggle: togglePalette } = useCommandPalette();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Only plain meta/ctrl combos. Bail on meta+shift, meta+alt, etc.
      const hasMod = e.metaKey === true || e.ctrlKey === true;
      if (hasMod === false) return;
      if (e.shiftKey === true || e.altKey === true) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          requestActive("dashboard", setActive);
          break;
        case "2":
          // Plan 03-01 D-02: peers is now a dedicated route (no longer
          // aliased to Dashboard).
          e.preventDefault();
          requestActive("peers", setActive);
          break;
        case "3":
          // Plan 04-03 D-16: ⌘3 routes to the Routing tab.
          e.preventDefault();
          requestActive("routing", setActive);
          break;
        case "4":
          // Plan 05-01 D-03: ⌘4 routes to Gateway (Plan 05-02 fills the body).
          e.preventDefault();
          requestActive("gateway", setActive);
          break;
        case "5":
          e.preventDefault();
          requestActive("logs", setActive);
          break;
        case "6":
          // Plan 03-01 D-01: ⌘6 routes to Settings.
          e.preventDefault();
          requestActive("settings", setActive);
          break;
        case ",":
          // ⌘, alias for ⌘6 (macOS Preferences idiom per 03-UI-SPEC
          // §Shell chrome note). Swallow so it does NOT trigger Tauri's
          // native Preferences menu.
          e.preventDefault();
          requestActive("settings", setActive);
          break;
        case "k":
        case "K":
          // Plan 05-01 D-03 + D-29: ⌘K toggles the command palette.
          // Plan 05-05 ships the real palette Dialog; until then toggle()
          // is a no-op (stub atom in src/lib/command-palette/state.ts).
          // Modifier guard above already rejects ⌘⇧K and ⌘⌥K (D-42).
          e.preventDefault();
          togglePalette();
          break;
        case "ArrowUp":
          // D-06: ⌘↑ collapses all settings sections — no-op on other
          // tabs. Plan 03-04 SettingsScreen binds the handler for
          // ownership-by-the-Settings-surface (browser CustomEvent, NOT
          // a Tauri-API subscription — W1 preserved).
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
        case "f":
        case "F":
          // Phase 7 (UI/UX overhaul): ⌘F focuses the Settings section
          // search input. No-op on other tabs so the browser's native
          // find-in-page is left untouched on Logs, etc. SettingsScreen
          // owns the focus action via window.addEventListener — same
          // browser-CustomEvent pattern as collapse/expand-all (W1
          // preserved).
          if (active === "settings") {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("pim:settings-focus-search"));
          }
          break;
        default:
          return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, setActive, togglePalette]);

  // Plan 05-06 + TBD-PHASE-4-G: subscribe to the custom Tauri event
  // pim://open-add-peer emitted by Plan 05-04's tray popover Add-peer
  // click and Plan 05-05's palette peers.add_nearby action. On receipt,
  // route the user to the Phase 2 Nearby panel (currently the peers
  // tab). Phase 4 PEER-05/06 may refine the destination — this hook
  // brings the user to the right surface; Phase 4 owns the Add-peer flow.
  // This is the SINGLE documented W1 exception in this file — the event
  // is a custom IPC bridge from the popover/palette to the main window,
  // NOT a daemon RPC event.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listen<unknown>("pim://open-add-peer", () => {
      requestActive("peers", setActive);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((e) => {
        console.warn("pim://open-add-peer subscription failed —", e);
      });
    return () => {
      if (unlisten === null) {
        // subscription never resolved — nothing to clean up
      } else {
        unlisten();
      }
    };
  }, [setActive]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main
        aria-label="content"
        className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-6"
      >
        {/* Phase 1 Task 1.3: BannerStack consolidates KillSwitchBanner +
            LimitedModeBanner into a single mount point. Each banner
            self-derives visibility; the stack renders nothing visible
            when both conditions are false. Sits above ActiveScreen so
            banners scroll with content on long screens (Logs / Settings). */}
        <BannerStack />
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
      {/* Plan 05-05 D-28: ⌘K palette — global shell-level mount. Reads
          the useCommandPalette atom toggled by the AppShell keyboard
          handler above (Plan 05-01 case "k": / case "K":). The palette
          renders nothing when open === false; cmdk's Dialog handles its
          own portal + Esc close + focus trap. */}
      <CommandPalette />
      {/* Plan 05-06 D-31: notification policy dispatcher — single
          shell-level mount. Subscribes to status.event + peers.event +
          gateway.event via actions.subscribe (W1 fan-out, no new Tauri
          listener) and dispatches per-event to toast / system / both
          per the policy table at src/lib/notifications/policy.ts. */}
      <GatewayNotificationsListener />
    </div>
  );
}
