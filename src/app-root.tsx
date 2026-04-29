/**
 * AppRoot — boot-time router (Phase 01.1 D-01, extended by Phase 4 D-01).
 *
 * On mount, issues a one-shot `configExists()` Tauri call. While in
 * flight (≤100 ms on local FS per Phase 01.1 D-01), renders the centered
 * `█ pim · booting…` splash from 01.1-UI-SPEC §S1. On resolve:
 *   - exists === false → <FirstRunScreen path={path} ... />
 *   - exists === true  → either <WelcomeScreen /> or <App />, depending
 *                         on the localStorage onboarding flag (Phase 4).
 *
 * Phase 4 D-01: a third boot state — `WelcomeScreen` — sits between
 * FirstRunScreen completion and AppShell. Gated by
 * localStorage["pim-ui.onboarding.completed"]; once set to "true",
 * subsequent launches skip directly to AppShell.
 *
 * Phase 4 D-04: when the user picks `[ ADD PEER NEARBY ]`, AppRoot
 * dispatches a `pim-ui:scroll-to-nearby` CustomEvent on `window` so the
 * Dashboard (Plan 04-05 Task 2) can scroll its NearbyPanel into view
 * once it mounts. The browser-native event channel keeps the W1
 * invariant intact — no new Tauri-side subscription, no new module-
 * level atom. Both files reference the same event-name string verbatim.
 *
 * D-22: an fs error from configExists is treated as "no config yet" —
 * the user lands on FirstRunScreen and the bootstrap-write step will
 * surface the real error if it persists. (Plan 01.1-01 already swallows
 * EIO/EACCES Rust-side, so this branch is purely defensive.)
 *
 * Cross-phase W1 invariant preserved: AppRoot does NOT register any
 * Tauri event subscription. It only calls `configExists()` (a Tauri
 * command, not an event channel).
 */

import { useEffect, useState } from "react";
import App from "./App";
import { configExists } from "@/lib/rpc";
import { FirstRunScreen } from "@/screens/first-run";
import { WelcomeScreen } from "@/screens/welcome";
import { SimpleShell } from "@/components/shell/simple-shell";
import { useAppMode } from "@/hooks/use-app-mode";

type ConfigState =
  | { kind: "loading" }
  | { kind: "missing"; path: string }
  | { kind: "present" };

const UNKNOWN_PATH = "(unknown path)";
const ONBOARDING_FLAG_KEY = "pim-ui.onboarding.completed";
const SCROLL_TO_NEARBY_EVENT = "pim-ui:scroll-to-nearby";

export function AppRoot(): React.JSX.Element {
  const [configState, setConfigState] = useState<ConfigState>({
    kind: "loading",
  });
  const [bootstrapped, setBootstrapped] = useState(false);
  // Simple vs advanced mode — once onboarding is done this atom
  // decides which shell to render. Default is "simple" for new users
  // (UX-PLAN §2a, persona Aria). Persisted in localStorage via
  // useAppMode.
  const { mode } = useAppMode();
  // Phase 4 D-01 + D-03: gate the WelcomeScreen on the localStorage flag.
  // Initialized synchronously so a returning user (flag === "true")
  // bypasses WelcomeScreen on the very first render — no UI flash.
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ONBOARDING_FLAG_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    configExists()
      .then((r) => {
        if (cancelled === true) return;
        if (r.exists === true) {
          setConfigState({ kind: "present" });
          return;
        }
        setConfigState({ kind: "missing", path: r.path });
      })
      .catch(() => {
        // D-22 defensive fallback — Rust already swallows fs errors to
        // exists=false, so this branch only fires if the Tauri bridge
        // itself fails. Land the user on FirstRunScreen so they can at
        // least try to bootstrap; the write step will surface the real
        // failure inline.
        if (cancelled === true) return;
        setConfigState({ kind: "missing", path: UNKNOWN_PATH });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (configState.kind === "loading") {
    return (
      <main
        aria-label="starting pim"
        aria-busy="true"
        className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8"
      >
        <span className="font-mono text-xl tracking-tight logo-hero">
          <span className="phosphor">█ pim</span>
          <span className="text-muted-foreground"> · booting…</span>
        </span>
      </main>
    );
  }

  if (configState.kind === "missing" && bootstrapped === false) {
    return (
      <FirstRunScreen
        path={configState.path}
        onBootstrapComplete={() => setBootstrapped(true)}
      />
    );
  }

  // Phase 4 D-01: third boot state — show WelcomeScreen when the user
  // has not yet picked an onboarding path. The flag is written by
  // WelcomeScreen itself BEFORE this callback fires (D-03), so this
  // useState slot only needs to flip the in-memory gate so AppShell
  // mounts on the next render.
  if (onboardingDone === false) {
    return (
      <WelcomeScreen
        onComplete={(scrollToNearby: boolean) => {
          setOnboardingDone(true);
          if (scrollToNearby === true) {
            // D-04: signal Dashboard to scroll the NearbyPanel into view
            // once it mounts. Plan 04-05 Task 2 wires the listener on
            // dashboard.tsx (one-shot, removes itself after firing).
            // Both files reference SCROLL_TO_NEARBY_EVENT verbatim.
            try {
              window.dispatchEvent(new CustomEvent(SCROLL_TO_NEARBY_EVENT));
            } catch {
              /* SSR / non-DOM env — no-op */
            }
          }
        }}
      />
    );
  }

  // After onboarding the user is either in simple mode (one-screen
  // shell with a TURN ON button) or advanced mode (full sidebar via
  // AppShell). Both share the same providers and daemon-state hooks —
  // only the chrome differs. The useAppMode atom is persisted to
  // localStorage so the choice survives relaunches.
  if (mode === "simple") {
    return <SimpleShell />;
  }
  return <App />;
}
