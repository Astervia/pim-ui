import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TunPermissionProvider } from "./components/brand/tun-permission-modal";
import { ReconnectToaster } from "./components/brand/reconnect-toast";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TunPermissionProvider>
      <App />
    </TunPermissionProvider>
    <ReconnectToaster />
  </React.StrictMode>,
);
