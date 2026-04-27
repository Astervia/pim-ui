/**
 * useSystemNotifications — generic OS-notification helper per 05-CONTEXT
 * D-32 + D-35 + RESEARCH §6b.
 *
 * Lazy permission flow (D-32): isPermissionGranted is checked on FIRST
 * call only; if not granted, requestPermission is deferred until the
 * first event needing system delivery (so the macOS / Windows permission
 * prompt does NOT fire at app launch — it fires the first time something
 * critical actually happens, which is the only time the user benefits
 * from granting permission).
 *
 * Click-to-focus (D-35): the plugin's default action handler brings
 * the main window to front via getAllWebviewWindows + main.show().setFocus().
 * Tauri 2's plugin-notification fires the default action when the user
 * clicks the OS notification bubble; on macOS the OS also brings the
 * dock icon forward automatically. focusMain provides a programmatic
 * fallback callable from the dispatcher.
 *
 * If the user denies permission, send becomes a no-op for the rest of
 * the session (the grantedRef caches the denial). We do NOT re-prompt
 * on every event — that would defeat the purpose of the lazy flow.
 */

import { useCallback, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";

export interface SendOptions {
  title: string;
  body: string;
}

export interface UseSystemNotificationsResult {
  /** Lazy permission flow + send. No-op if user denied. */
  send: (opts: SendOptions) => Promise<void>;
}

async function ensurePermission(grantedRef: { current: boolean | null }): Promise<boolean> {
  if (grantedRef.current === true) return true;
  if (grantedRef.current === false) return false;
  // grantedRef.current === null — first call
  try {
    const granted = await isPermissionGranted();
    if (granted === true) {
      grantedRef.current = true;
      return true;
    }
    // Lazy request — only when the first system / both event arrives.
    const result = await requestPermission();
    if (result === "granted") {
      grantedRef.current = true;
      return true;
    }
    grantedRef.current = false;
    // Dev console hint — the user denied OS notifications. Silent in
    // production except for this one log; we do NOT re-prompt.
    console.warn("system notifications: permission denied — escalations will be toast-only this session");
    return false;
  } catch (e) {
    grantedRef.current = false;
    console.warn("system notifications: permission check failed —", e);
    return false;
  }
}

/**
 * Bring the main webview window to front. Used by the dispatcher (Plan
 * 05-06 useGatewayNotifications) when the user clicks the OS notification;
 * macOS also surfaces the dock icon automatically when the OS notification
 * is clicked, so this is a programmatic redundancy belt for Linux/Windows.
 */
export async function focusMain(): Promise<void> {
  try {
    const all = await getAllWebviewWindows();
    const main = all.find((w) => w.label === "main");
    if (main === undefined) return;
    await main.show();
    await main.setFocus();
  } catch (e) {
    console.warn("focusMain failed —", e);
  }
}

export function useSystemNotifications(): UseSystemNotificationsResult {
  const grantedRef = useRef<boolean | null>(null);

  const send = useCallback(async (opts: SendOptions) => {
    const ok = await ensurePermission(grantedRef);
    if (ok === false) return;
    try {
      await sendNotification({ title: opts.title, body: opts.body });
    } catch (e) {
      // Non-fatal — the OS may have rate-limited or the permission
      // flipped mid-session. Keep grantedRef as-is so the next event
      // tries again rather than locking out the user permanently.
      console.warn("sendNotification failed —", e);
    }
  }, []);

  return { send };
}
