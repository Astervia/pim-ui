import { AppShell } from "@/components/shell/app-shell";

/**
 * App — thin composition root. The Phase-1 centered <main> wrapper was
 * replaced in Phase 2 Plan 02-02 by AppShell, which owns the full
 * viewport layout (sidebar + content pane, D-01/D-02/D-03).
 *
 * Providers (TunPermissionProvider, ReconnectToaster) stay in main.tsx
 * where Phase 1 Plan 03 mounted them — this file is intentionally
 * minimal so future screens, overlays, and providers compose above or
 * below AppShell without re-touching the root.
 */
function App() {
  return <AppShell />;
}

export default App;
