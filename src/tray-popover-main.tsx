/**
 * Tray popover React entry per Plan 05-04 D-21.
 *
 * The popover window is a SEPARATE webview from the main window. It mounts
 * its own React tree, gets its own useDaemonState listener (per-window —
 * NOT a violation of the W1 single-listener invariant which is scoped
 * per-window per RESEARCH §11c).
 *
 * Loads the same globals.css as the main window so brand tokens apply.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import { TrayPopoverApp } from "./components/tray-popover/tray-popover-app";

const root = document.getElementById("tray-popover-root");
if (root === null) {
  // Defensive — the host HTML always provides #tray-popover-root, but
  // surface a console warning so a renamed div doesn't silently break.
  console.warn("tray-popover: #tray-popover-root not found; popover not mounted");
} else {
  createRoot(root).render(
    <React.StrictMode>
      <TrayPopoverApp />
    </React.StrictMode>,
  );
}
