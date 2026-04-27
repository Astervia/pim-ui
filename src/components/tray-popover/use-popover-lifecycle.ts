/**
 * usePopoverLifecycle — hide the popover on blur.
 *
 * 05-CONTEXT D-21 + RESEARCH §6c: when the popover loses focus, hide it.
 * Standard NSPopover idiom on macOS; matches user expectation on Windows
 * popovers as well. (Linux uses native menu — this hook never runs there
 * because the popover window doesn't open on Linux per
 * show_menu_on_left_click(false).)
 *
 * W1 invariant: the popover window registers its own onFocusChanged
 * listener — that's a per-window subscription, NOT the W1 main-window
 * single-listener. RESEARCH §11c documents per-window listeners as
 * allowed (each webview owns its own listener budget).
 */

import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function usePopoverLifecycle(): void {
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    const win = getCurrentWebviewWindow();
    win
      .onFocusChanged(({ payload: focused }) => {
        if (focused === false) {
          void win.hide().catch(() => {});
        }
      })
      .then((fn) => {
        unlistenFn = fn;
      })
      .catch(() => {});
    return () => {
      if (unlistenFn !== null) unlistenFn();
    };
  }, []);
}
