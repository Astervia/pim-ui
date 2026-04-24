/**
 * <DaemonToggle /> — the single action that starts or stops pim-daemon.
 *
 * Spec: 01-UI-SPEC.md §Surface 2.
 * Self-contained consumer of useDaemonState — no props required; pass
 * a `className` to position it.
 *
 * B2 fix: calls useTunPermission() which is a CONSUMER hook — the modal
 * lives in TunPermissionProvider at the app root. This component does NOT
 * render its own modal. The requestPermission() promise resolves from the
 * single provider-mounted TunPermissionModal instance.
 *
 * Never a <Switch /> — always a bracketed action button whose label
 * flips based on state per the rendering matrix in 01-UI-SPEC.
 */

import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { isTransientState } from "@/lib/daemon-state";
import { cn } from "@/lib/utils";
import { useTunPermission } from "./tun-permission-modal";

export interface DaemonToggleProps {
  className?: string;
}

export function DaemonToggle({ className }: DaemonToggleProps) {
  const { snapshot, actions } = useDaemonState();
  const { requestPermission } = useTunPermission();

  const state = snapshot.state;
  const disabled = isTransientState(state);

  const onClick = async () => {
    if (state === "running") {
      await actions.stop(); // opens confirm if peers > 0
      return;
    }
    if (state === "stopped" || state === "error") {
      const granted = await requestPermission();
      if (!granted) return;
      await actions.start();
    }
  };

  let label: string;
  let variant: "default" | "destructive" | "secondary" = "default";
  let size: "lg" | "default" = "lg";

  switch (state) {
    case "stopped":
      label = "START DAEMON";
      size = "lg";
      break;
    case "starting":
      label = "STARTING…";
      size = "lg";
      break;
    case "running":
      label = "STOP DAEMON";
      variant = "destructive";
      size = "default";
      break;
    case "reconnecting":
      label = "RECONNECTING…";
      variant = "secondary";
      size = "default";
      break;
    case "error":
      label = "RETRY START";
      size = "lg";
      break;
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      aria-disabled={disabled || undefined}
      aria-busy={disabled || undefined}
      className={cn(disabled && "pointer-events-none opacity-40", className)}
    >
      {label}
    </Button>
  );
}
