/**
 * <CmdKHint /> — Phase 8 (UI/UX overhaul §Discoverability).
 *
 * Tiny footer hint mounted at the bottom of the Sidebar that surfaces
 * the ⌘K command palette without violating Layer-1 minimalism (P2: no
 * "Advanced" toggle, no native-platform UI idioms that fight the
 * monospace aesthetic). The hint:
 *
 *   - reads "⌘K · search anything" in muted-foreground monospace
 *   - opens the palette on click via the existing useCommandPalette atom
 *   - exposes a [ × ] inline button to dismiss the hint forever
 *   - auto-dismisses itself once the user has pressed ⌘K at least once
 *
 * Persistence uses a single localStorage key `pim-ui.hints.cmdk-seen`
 * — set to the literal string "true" once either dismissal path fires.
 * Reading the flag at mount keeps the hint hidden across sessions for
 * users who already know the shortcut.
 *
 * W1 contract: this file uses ONLY browser primitives (window.addEventListener
 * for keydown, localStorage for persistence). No Tauri-API listeners — the
 * `listen(...)` invariant from src/lib/rpc.ts + src/hooks/use-daemon-state.ts
 * is preserved. The keydown listener mirrors AppShell's ⌘K binding so the
 * hint dismisses itself in lock-step with palette activations.
 *
 * Brand absolutes:
 *   - border-radius: 0 (no rounded classes)
 *   - tokens only (no literal palette colors)
 *   - monospace, no shadows, no gradients, no exclamation marks
 *   - copy sourced from src/lib/copy.ts (CMDK_HINT_*)
 */

import { useEffect, useState } from "react";
import { useCommandPalette } from "@/lib/command-palette/state";
import {
  CMDK_HINT_ARIA,
  CMDK_HINT_DISMISS,
  CMDK_HINT_DISMISS_ARIA,
  CMDK_HINT_LABEL,
} from "@/lib/copy";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pim-ui.hints.cmdk-seen";

function readSeenFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // localStorage can throw in private/unsupported contexts — fall
    // through to "not seen" so the hint stays visible (safer default
    // than silently hiding a discoverability surface).
    return false;
  }
}

function writeSeenFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Best-effort — a missing localStorage just means the hint will
    // re-appear next session. No user-visible failure mode.
  }
}

export function CmdKHint() {
  const { toggle } = useCommandPalette();
  const [seen, setSeen] = useState<boolean>(() => readSeenFlag());

  // ⌘K detection mirror — when the user fires the global shortcut from
  // anywhere in the app, mark the hint as seen so it stops nagging.
  // This mirrors AppShell's keydown switch (case "k"/"K") with the
  // same modifier guard. Browser event only — W1 preserved.
  useEffect(() => {
    if (seen === true) return;
    function onKey(e: KeyboardEvent) {
      const hasMod = e.metaKey === true || e.ctrlKey === true;
      if (hasMod === false) return;
      if (e.shiftKey === true || e.altKey === true) return;
      if (e.key === "k" || e.key === "K") {
        writeSeenFlag();
        setSeen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seen]);

  if (seen === true) return null;

  const dismiss = (): void => {
    writeSeenFlag();
    setSeen(true);
  };

  return (
    <div className="mt-auto px-4 py-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => toggle()}
        aria-label={CMDK_HINT_ARIA}
        className={cn(
          "font-mono text-xs text-muted-foreground hover:text-primary",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]",
          "text-left truncate min-w-0",
        )}
      >
        {CMDK_HINT_LABEL}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={CMDK_HINT_DISMISS_ARIA}
        className={cn(
          "font-mono text-xs text-muted-foreground hover:text-foreground",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-1px]",
          "px-1 shrink-0",
        )}
      >
        [ {CMDK_HINT_DISMISS} ]
      </button>
    </div>
  );
}
