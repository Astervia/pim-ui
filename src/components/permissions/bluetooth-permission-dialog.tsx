/**
 * <BluetoothPermissionDialog /> — first-run macOS Bluetooth pairing notice.
 *
 * macOS TCC gates Bluetooth access per-bundle. The bundled `pim-daemon`
 * is a CLI invoked from a root `osascript ... with administrator
 * privileges` subprocess, which has no Info.plist bundle for TCC to
 * attribute permission requests to — so TCC silently denies and never
 * shows the system prompt. The user can't add the daemon to Privacy →
 * Bluetooth manually either, since that picker only accepts .app
 * bundles.
 *
 * Workaround: skip radio-level inquiry from the daemon (config flag
 * `bluetooth.radio_discovery_enabled = false` on macOS). Instead, the
 * user pairs the gateway / relay once via macOS's own
 * System Settings → Bluetooth flow (which has working TCC integration
 * because it's Apple-signed). After the PAN link is up, `bridge0`
 * picks up an IP from the gateway's dnsmasq, and the daemon's
 * `auto_discover_peers` watcher reads it from the ARP table —
 * connecting via the regular TCP transport without ever touching
 * blueutil.
 *
 * This dialog explains the manual-pair step and offers a button that
 * opens the right page in System Settings.
 *
 * Triggers automatically when:
 *   1. We're on macOS (cheap UA sniff — same heuristic as first-run.tsx)
 *   2. The parsed config has `bluetooth.enabled = true`
 *   3. localStorage flag `pim:bt-pair-notice-shown` is unset
 */

import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Command } from "@tauri-apps/plugin-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getPath } from "@/lib/config/assemble-toml";
import { useSettingsConfig } from "@/hooks/use-settings-config";

const STORAGE_KEY = "pim:bt-pair-notice-shown";
const BT_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.BluetoothSettings";

function isMacos(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.toLowerCase().includes("mac");
}

function noticeAlreadyShown(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markNoticeShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // localStorage may be disabled; falling back to "show every launch"
    // is acceptable.
  }
}

/**
 * Open System Settings → Bluetooth. Tries the URL-scheme route first
 * (Tauri 2's `plugin-shell` `open()`); on failure, falls back to
 * shelling out to `/usr/bin/open` via the same plugin's `Command`
 * primitive. Both routes are gated by `shell:allow-open` and
 * `shell:allow-execute` in `capabilities/default.json`.
 */
async function openBluetoothSettings(): Promise<void> {
  try {
    await open(BT_SETTINGS_URL);
    return;
  } catch (e) {
    console.warn(
      "shell.open(x-apple.systempreferences:…) failed; falling back to /usr/bin/open",
      e,
    );
  }
  try {
    const cmd = Command.create("open", [BT_SETTINGS_URL]);
    const out = await cmd.execute();
    if (out.code !== 0) {
      console.warn("/usr/bin/open exit code", out.code, out.stderr);
    }
  } catch (e) {
    console.error("could not open System Settings → Bluetooth at all", e);
  }
}

export function BluetoothPermissionDialog(): React.ReactNode {
  const { base } = useSettingsConfig();
  const [open_, setOpen] = useState(false);

  useEffect(() => {
    if (base === null) return;
    if (!isMacos()) return;
    if (noticeAlreadyShown()) return;
    const btEnabled = getPath(base, "bluetooth.enabled");
    if (btEnabled !== true) return;
    setOpen(true);
  }, [base]);

  const onContinue = (): void => {
    markNoticeShown();
    setOpen(false);
  };

  const onOpenBluetooth = (): void => {
    void openBluetoothSettings();
  };

  return (
    <Dialog open={open_} onOpenChange={setOpen}>
      <DialogContent className="font-mono">
        <DialogHeader>
          <DialogTitle>Pair your gateway via macOS Bluetooth</DialogTitle>
          <DialogDescription className="text-foreground/80">
            macOS won&apos;t let the daemon scan Bluetooth directly (the
            system blocks unsigned CLIs running as root from showing a
            permission prompt). Pair your gateway once through{" "}
            <strong className="text-foreground">
              System Settings → Bluetooth
            </strong>
            , and the daemon will pick it up automatically from there.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2 text-sm text-text-secondary">
          <ol className="flex flex-col gap-2 pl-4 list-decimal">
            <li>
              Make sure the gateway is{" "}
              <strong className="text-foreground">discoverable</strong>{" "}
              (Linux: <code>bluetoothctl power on; discoverable on</code>
              ).
            </li>
            <li>
              Open System Settings → Bluetooth and click{" "}
              <strong className="text-foreground">Connect</strong> next
              to your gateway when it shows up under{" "}
              <em>Other Devices</em>.
            </li>
            <li>Confirm the pairing on both sides if asked.</li>
            <li>
              Once the PAN link is up, this app will discover the
              gateway in ~2 seconds via the local{" "}
              <code>bridge0</code> ARP table — you&apos;ll see it in the{" "}
              <em>Peers</em> tab.
            </li>
          </ol>
          <p className="text-xs">
            UDP broadcast discovery on your LAN keeps working
            independently — if the gateway is on the same Wi-Fi, it may
            connect even without Bluetooth.
          </p>
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onContinue}>
            Skip for now
          </Button>
          <Button type="button" onClick={onOpenBluetooth}>
            Open Bluetooth settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
