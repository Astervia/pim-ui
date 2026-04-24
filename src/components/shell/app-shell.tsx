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
 * Global keyboard shortcuts (02-UI-SPEC §Accessibility §Keyboard nav):
 *   ⌘1 / Ctrl+1 → dashboard
 *   ⌘2 / Ctrl+2 → peers (aliased to Dashboard in Phase 2, D-02)
 *   ⌘5 / Ctrl+5 → logs
 *   ⌘, / Ctrl+, → reserved for Settings (Phase 3); swallowed here so
 *                  it does NOT fall through to the browser or trigger
 *                  Tauri's native Preferences menu
 *
 * The handler ignores modifier combinations other than plain meta/ctrl —
 * ⌘⇧1 / ⌘⌥1 etc. pass through so browser + DevTools shortcuts stay live.
 *
 * Extension seams (Wave 2):
 *   - Plans 02-03/04/05 mount screen content inside ActiveScreen (not
 *     here) — this file intentionally exposes NO props or slots.
 *   - If a future plan needs an app-wide overlay (e.g. Pair Approval
 *     modal), render it from main.tsx alongside TunPermissionProvider,
 *     NOT here — AppShell stays focused on the Sidebar + main split.
 */

import { useEffect } from "react";
import { Sidebar } from "./sidebar";
import { ActiveScreen } from "./active-screen";
import { useActiveScreen } from "@/hooks/use-active-screen";

export function AppShell() {
  const { setActive } = useActiveScreen();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Only plain meta/ctrl combos. Bail on meta+shift, meta+alt, etc.
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          setActive("dashboard");
          break;
        case "2":
          // D-02: Peers tab aliases to Dashboard in Phase 2; we still
          // set the id to "peers" so the sidebar highlights correctly.
          e.preventDefault();
          setActive("peers");
          break;
        case "5":
          e.preventDefault();
          setActive("logs");
          break;
        case ",":
          // ⌘, reserved for Settings (Phase 3). Swallow the event so it
          // doesn't propagate to the browser or trigger native menus;
          // no-op in Phase 2 until CONF-* lands.
          e.preventDefault();
          break;
        default:
          return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActive]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main
        aria-label="content"
        className="flex-1 overflow-y-auto px-8 py-8"
      >
        <ActiveScreen />
      </main>
    </div>
  );
}
