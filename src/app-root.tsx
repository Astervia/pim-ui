/**
 * AppRoot — boot-time router (Phase 01.1 D-01).
 *
 * On mount, issues a one-shot `configExists()` Tauri call. While in
 * flight (≤100 ms on local FS per D-01), renders the centered
 * `█ pim · booting…` splash from 01.1-UI-SPEC §S1. On resolve:
 *   - exists === false → <FirstRunScreen path={path} ... />
 *   - exists === true  → <App />  (AppShell — Phase 2 plumbing)
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

type ConfigState =
  | { kind: "loading" }
  | { kind: "missing"; path: string }
  | { kind: "present" };

const UNKNOWN_PATH = "(unknown path)";

export function AppRoot(): React.JSX.Element {
  const [configState, setConfigState] = useState<ConfigState>({
    kind: "loading",
  });
  const [bootstrapped, setBootstrapped] = useState(false);

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

  return <App />;
}
