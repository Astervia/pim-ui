/**
 * TunPermissionProvider — app-root provider that mounts EXACTLY ONE
 * TunPermissionModal instance and exposes `requestPermission()` via
 * useTunPermission().
 *
 * B2 checker fix: prior design had `useTunPermission()` own its own local
 * modal JSX. DaemonToggle discarded that JSX, so its requestPermission()
 * call would await a modal that wasn't in the DOM, hanging START forever.
 * Solution: exactly one provider at the app root, exactly one modal in the
 * DOM, consumed by DaemonToggle and LimitedModeBanner via the same context.
 *
 * Spec: 01-UI-SPEC.md §Surface 2 TUN permission flow.
 *
 * UX: the first time ANY entry point (toggle or banner) calls
 * requestPermission() in a session, the modal opens with honest copy.
 * [ GRANT PERMISSION ] → promise resolves true. [ SKIP FOR NOW ] or close →
 * promise resolves false. Grants persist for the session via sessionStorage
 * so the user isn't prompted again until page reload.
 *
 * NB: this is the _app-level_ acknowledgement; the OS's own privilege
 * prompt is fired by pim-daemon itself on TUN interface creation. We
 * surface the rationale BEFORE spawning so the user isn't ambushed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "pim:tun-permission-granted";

export interface TunPermissionModalProps {
  open: boolean;
  onGrant: () => void;
  onSkip: () => void;
}

/**
 * Visual — exported only so Plan 04 integration tests can import it; the
 * provider mounts the only in-app instance. Do NOT render directly outside
 * the provider (B2).
 */
export function TunPermissionModal({
  open,
  onGrant,
  onSkip,
}: TunPermissionModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onSkip();
      }}
    >
      <DialogContent aria-describedby="tun-description">
        <DialogHeader>
          <DialogTitle>Grant virtual network permission</DialogTitle>
        </DialogHeader>
        <DialogDescription id="tun-description">
          pim needs permission to create a virtual network connection (TUN
          interface). This lets the mesh route traffic on your device
          without sending it through a third-party server.
          {" "}See docs/SECURITY.md §2.1.
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={onSkip} type="button">
            SKIP FOR NOW
          </Button>
          <Button onClick={onGrant} type="button">
            GRANT PERMISSION
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TunPermissionContextValue {
  requestPermission(): Promise<boolean>;
}

const TunPermissionContext = createContext<TunPermissionContextValue | null>(
  null,
);

export function TunPermissionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // I1 follow-up: useRef (not useState) for the resolver — it is not part of
  // render state; we only need a stable mutable slot.
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const requestPermission = useCallback((): Promise<boolean> => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1")
        return Promise.resolve(true);
    } catch {
      /* sessionStorage may be unavailable in tests */
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const grant = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const skip = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const value = useMemo(() => ({ requestPermission }), [requestPermission]);

  return (
    <TunPermissionContext.Provider value={value}>
      {children}
      <TunPermissionModal open={open} onGrant={grant} onSkip={skip} />
    </TunPermissionContext.Provider>
  );
}

export function useTunPermission(): TunPermissionContextValue {
  const ctx = useContext(TunPermissionContext);
  if (!ctx) {
    throw new Error(
      "useTunPermission must be used inside <TunPermissionProvider />. " +
        "Plan 04 mounts the provider at the app root (src/main.tsx).",
    );
  }
  return ctx;
}
