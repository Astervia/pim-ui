import { AppShell } from "@/components/shell/app-shell";
import { BluetoothPermissionDialog } from "@/components/permissions/bluetooth-permission-dialog";

/**
 * App — thin composition root. The Phase-1 centered <main> wrapper was
 * replaced in Phase 2 Plan 02-02 by AppShell, which owns the full
 * viewport layout (sidebar + content pane, D-01/D-02/D-03).
 *
 * BluetoothPermissionDialog auto-opens once on macOS when the parsed
 * config has `bluetooth.enabled = true` and the user has not yet
 * dismissed the notice (localStorage flag). It pre-warms the system
 * Privacy prompt the daemon's first `blueutil --inquiry` call will
 * trigger.
 *
 * Providers (TunPermissionProvider, ReconnectToaster) stay in main.tsx
 * where Phase 1 Plan 03 mounted them — this file is intentionally
 * minimal so future screens, overlays, and providers compose above or
 * below AppShell without re-touching the root.
 */
function App() {
  return (
    <>
      <AppShell />
      <BluetoothPermissionDialog />
    </>
  );
}

export default App;
