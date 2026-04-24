import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TunPermissionProvider } from "./components/brand/tun-permission-modal";
import "./globals.css";

// Plan 02-06: The sonner <Toaster /> container moved from here into
// <AppShell />, consolidating Phase-1 ReconnectToast + Phase-2
// SubscriptionErrorToast behind a single container. TunPermissionProvider
// stays here — it renders a modal that must be reachable even before the
// app shell mounts (e.g. first-run TUN grant before any screen renders).
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TunPermissionProvider>
      <App />
    </TunPermissionProvider>
  </React.StrictMode>,
);
