/**
 * Phase 4 D-01..D-05: <WelcomeScreen /> — onboarding step 3.
 *
 * Rendered by AppRoot AFTER Phase 01.1's FirstRunScreen has succeeded
 * (configState.kind === "present" || bootstrapped === true) AND the
 * localStorage flag "pim-ui.onboarding.completed" is null/false.
 *
 * Two bracketed primary actions:
 *   [ ADD PEER NEARBY ] -> set flag, call onComplete(scrollToNearby=true)
 *                          AppShell mounts on dashboard; Dashboard scrolls
 *                          the NearbyPanel into view (Plan 04-05 Task 2).
 *   [ RUN SOLO ]        -> set flag, call onComplete(scrollToNearby=false)
 *                          AppShell mounts on dashboard normally.
 *
 * The flag is set BEFORE navigation (D-03). On reload mid-flight,
 * WelcomeScreen reads the flag on mount and short-circuits via onComplete
 * if already "true".
 *
 * Brand: bang-free conditionals (=== false / === null), no border-radius
 * variants, no fade-blends, every string sourced from src/lib/copy.ts
 * (audit-locked).
 */

import { useEffect } from "react";
import type * as React from "react";
import { CliPanel } from "@/components/brand/cli-panel";
import { Button } from "@/components/ui/button";
import {
  WELCOME_TITLE,
  WELCOME_SECTION,
  WELCOME_SUBTITLE,
  WELCOME_ADD_LABEL,
  WELCOME_ADD_DESC,
  WELCOME_SOLO_LABEL,
  WELCOME_SOLO_DESC,
} from "@/lib/copy";

const ONBOARDING_FLAG_KEY = "pim-ui.onboarding.completed";

export interface WelcomeScreenProps {
  /** Called once a path is picked. `scrollToNearby` = true when [ ADD PEER NEARBY ] was clicked. */
  onComplete: (scrollToNearby: boolean) => void;
}

export function WelcomeScreen({
  onComplete,
}: WelcomeScreenProps): React.JSX.Element | null {
  // D-03 short-circuit: if user reloaded mid-flight after flag was already
  // set, hand off immediately (no UI flash).
  useEffect(() => {
    try {
      const flag = window.localStorage.getItem(ONBOARDING_FLAG_KEY);
      if (flag === "true") onComplete(false);
    } catch {
      /* localStorage blocked -> render the screen normally */
    }
  }, [onComplete]);

  const handle = (scrollToNearby: boolean): void => {
    try {
      window.localStorage.setItem(ONBOARDING_FLAG_KEY, "true");
    } catch {
      /* ignore — onComplete still fires so the user is not trapped */
    }
    onComplete(scrollToNearby);
  };

  return (
    <main
      aria-label="welcome"
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 gap-6"
    >
      <span className="font-mono text-xl tracking-tight logo-hero">
        <span className="phosphor">{WELCOME_TITLE}</span>
      </span>

      <CliPanel title={WELCOME_SECTION} className="max-w-md w-full">
        <div className="flex flex-col gap-6 font-code text-sm">
          <p className="text-foreground">{WELCOME_SUBTITLE}</p>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={() => handle(true)}
            >
              {WELCOME_ADD_LABEL}
            </Button>
            <p className="text-muted-foreground">{WELCOME_ADD_DESC}</p>
          </div>

          {/* Phase 5 hierarchy: [ RUN SOLO ] is the lower-effort,
              lower-stakes path — secondary visual weight (transparent
              bg, border-only) so the eye reads it as the alternative
              rather than a parallel primary action. */}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => handle(false)}
            >
              {WELCOME_SOLO_LABEL}
            </Button>
            <p className="text-muted-foreground">{WELCOME_SOLO_DESC}</p>
          </div>
        </div>
      </CliPanel>
    </main>
  );
}
