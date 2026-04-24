/**
 * <ReconnectToaster /> mounts the sonner container globally.
 * <ReconnectToast /> is a logical component with NO visual output —
 * it subscribes to DaemonState transitions and calls `toast()` with the
 * brand-styled payload on reconnecting → running only.
 *
 * Spec: 01-UI-SPEC.md §Surface 7.
 */

import { useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import { useDaemonState } from "@/hooks/use-daemon-state";
import type { DaemonState } from "@/lib/daemon-state";

/** Mount once at the app root (src/main.tsx). Brand-styled container. */
export function ReconnectToaster() {
  return (
    <Toaster
      position="bottom-right"
      offset={16}
      duration={3000}
      toastOptions={{
        className:
          "font-mono rounded-none border border-border border-l-2 border-l-primary bg-card text-foreground",
        style: { borderRadius: 0 },
      }}
    />
  );
}

/** Logical observer — place once inside the React tree. Returns null. */
export function ReconnectToast() {
  const { snapshot } = useDaemonState();
  const prevState = useRef<DaemonState>(snapshot.state);

  useEffect(() => {
    if (
      prevState.current === "reconnecting" &&
      snapshot.state === "running"
    ) {
      const versionLine = snapshot.hello
        ? `${snapshot.hello.daemon} · rpc ${snapshot.hello.rpc_version}`
        : "";
      toast(
        <div className="font-mono text-sm flex flex-col gap-1">
          <span>
            <span className="text-primary" aria-hidden="true">
              ◆
            </span>
            {" "}Daemon reconnected.
          </span>
          {versionLine && (
            <span className="text-muted-foreground text-xs">{versionLine}</span>
          )}
        </div>,
        { duration: 3000 },
      );
    }
    prevState.current = snapshot.state;
  }, [snapshot.state, snapshot.hello]);

  return null;
}
