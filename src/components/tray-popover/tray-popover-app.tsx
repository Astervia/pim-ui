/**
 * <TrayPopoverApp /> — top-level component for the tray-popover window.
 *
 * Mounts the lifecycle hook (D-21 hide-on-blur via onFocusChanged) at
 * the root so the popover hides whenever it loses focus, then renders
 * the layout shell.
 */

import { PopoverShell } from "./popover-shell";
import { usePopoverLifecycle } from "./use-popover-lifecycle";

export function TrayPopoverApp() {
  usePopoverLifecycle();
  return <PopoverShell />;
}
