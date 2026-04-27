/**
 * <PopoverActions /> — Add peer nearby + Open pim + Quit pim per
 * 05-CONTEXT D-19 rows 5/6/7.
 *
 * Add peer nearby (TBD-PHASE-4-G): emits 'pim://open-add-peer' Tauri
 * event; the main window's listener routes the user to the existing
 * Phase 2 Nearby panel. Phase 4 ROUTE-* / PEER-05/06 may further refine.
 *
 * Open pim: brings the main window to front via getAllWebviewWindows() +
 * label === "main" lookup, then hides the popover.
 *
 * Quit pim (Plan 05-04 W1 fix): the popover NEVER imports a JS-side exit
 * API. The Tauri shell plugin does not export `exit` (it's `Command`,
 * `open`, `Child` only — verified against the dist-js/index.d.ts surface),
 * and the process plugin is NOT a Phase 5 dependency. Quit fans
 * out via emit('pim://quit', {}); the Rust setup hook in
 * src-tauri/src/lib.rs registers app.listen("pim://quit", ...) which
 * calls app.exit(0). Single source of truth = the Rust listener.
 */

import { emit } from "@tauri-apps/api/event";
import {
  getAllWebviewWindows,
  getCurrentWebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import { cn } from "@/lib/utils";

async function openMain(): Promise<void> {
  try {
    const all = await getAllWebviewWindows();
    const main = all.find((w) => w.label === "main");
    if (main !== undefined) {
      await main.show();
      await main.setFocus();
    }
    // hide popover after action
    const popover = getCurrentWebviewWindow();
    await popover.hide();
  } catch {
    // non-fatal — the popover keeps rendering even if the main window
    // is unavailable; the user can re-click the tray icon.
  }
}

async function addPeerNearby(): Promise<void> {
  try {
    // TBD-PHASE-4-G: bring main window forward + emit the open-add-peer
    // event. Plan 05-04 brings the user to the main-window surface;
    // Phase 4 ROUTE-* / PEER-05/06 owns the destination.
    await openMain();
    await emit("pim://open-add-peer", {});
  } catch {
    // non-fatal
  }
}

async function quitPim(): Promise<void> {
  try {
    // Plan 05-04 W1 fix: emit a Tauri event the Rust setup hook listens
    // for — single source of truth for app.exit(0). See src-tauri/src/lib.rs
    // for the matching `app.listen("pim://quit", ...)` registration.
    // This is the popover's documented W1 cross-window IPC exception
    // (custom Tauri event, NOT a daemon RPC event); the same pattern is
    // used for `pim://open-add-peer` from `addPeerNearby` above.
    await emit("pim://quit", {});
  } catch {
    // non-fatal
  }
}

interface ActionRowProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
}

function ActionRow({ label, shortcut, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2",
        "bg-transparent text-foreground",
        "hover:bg-popover hover:text-primary",
        "font-mono text-xs uppercase tracking-wider",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]",
      )}
    >
      <span>{label}</span>
      {shortcut !== undefined ? (
        <span className="text-muted-foreground">{shortcut}</span>
      ) : null}
    </button>
  );
}

export function PopoverActions() {
  return (
    <div className="flex flex-col">
      <ActionRow label="+ Add peer nearby" shortcut="⌘⇧N" onClick={addPeerNearby} />
      <ActionRow label="Open pim" shortcut="⌘O" onClick={openMain} />
      <div
        aria-hidden="true"
        className="px-3 text-muted-foreground select-none font-mono text-xs"
      >
        ├──
      </div>
      <ActionRow label="Quit pim" shortcut="⌘Q" onClick={quitPim} />
    </div>
  );
}
