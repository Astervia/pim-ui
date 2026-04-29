import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "./app-root";
import { TunPermissionProvider } from "./components/brand/tun-permission-modal";
import { ErrorBoundary } from "./components/brand/error-boundary";
import "./globals.css";

// Plan 02-06: The sonner <Toaster /> container moved from here into
// <AppShell />, consolidating Phase-1 ReconnectToast + Phase-2
// SubscriptionErrorToast behind a single container. TunPermissionProvider
// stays here — it renders a modal that must be reachable even before the
// app shell mounts (e.g. first-run TUN grant before any screen renders).
//
// Plan 01.1-03 D-01: AppRoot replaces the direct App mount — AppRoot
// decides whether to render FirstRunScreen (no config yet) or AppShell
// (via App, when config exists). TunPermissionProvider stays at the
// root so requestPermission() is reachable from BOTH branches (D-02).
//
// ErrorBoundary wraps everything so a thrown render error surfaces a
// readable diagnostic instead of unmounting the tree to a black window.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TunPermissionProvider>
        <AppRoot />
      </TunPermissionProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
