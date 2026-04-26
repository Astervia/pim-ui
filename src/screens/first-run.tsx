/**
 * FirstRunScreen — S1 surface for Phase 01.1.
 *
 * Single-screen first-run form: device name + role radio + footer hint
 * + [ Start pim ] / [ Customize… ]. Captures the two D-07 fields,
 * validates per D-11, orchestrates the D-13 5-step boot sequence via
 * useConfigBootstrap, and fires `onBootstrapComplete` exactly once when
 * the hook flips to "complete" (step 5).
 *
 * Layout + verbatim copy authority: 01.1-UI-SPEC.md §S1 +
 * §Copywriting Contract.
 *
 * Brand absolutes upheld: no gradients, no rounded-*, no literal palette
 * classes, no exclamation marks in any user-visible string. Every
 * conditional is bang-free (=== null, === false, ternary inversion).
 */

import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CliPanel } from "@/components/brand/cli-panel";
import { useConfigBootstrap } from "@/hooks/use-config-bootstrap";
import type { FirstRunRole } from "@/lib/rpc";
import { cn } from "@/lib/utils";

export interface FirstRunScreenProps {
  /** Resolved config path from configExists() — rendered in footer hint. */
  path: string;
  /** D-13 step 5 — flips AppRoot's bootstrapped flag → AppShell mounts. */
  onBootstrapComplete: () => void;
}

const DEVICE_NAME_REGEX = /^[A-Za-z0-9_\-\.]+$/;
const DEVICE_NAME_MAX = 64;
const FALLBACK_NODE_NAME = "pim-node";
const VALIDATION_COPY =
  "Device name must be letters, numbers, _, -, or . (1-64 characters)";

type Platform = "linux" | "macos" | "windows" | "unknown";

/**
 * Best-effort platform detection. Tauri 2's @tauri-apps/plugin-os is
 * NOT in the project deps (verified via `grep package.json`), so we
 * fall back to navigator.userAgent — purely a UI gating hint per D-08.
 * The Rust side (Plan 01.1-01) is the source of truth on whether the
 * gateway role can actually function; the radio gate just prevents the
 * obvious foot-gun. Runs once at module init (no React state needed).
 */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("linux") === true && ua.includes("android") === false) {
    return "linux";
  }
  if (ua.includes("mac") === true) return "macos";
  if (ua.includes("win") === true) return "windows";
  return "unknown";
}

/**
 * D-11 sanitizer for the pre-filled hostname. Maps any character
 * outside the allowed set to "-" and truncates to 64. If the result is
 * empty (extreme edge case), returns the literal fallback.
 */
function sanitizeNodeName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_\-\.]/g, "-").slice(0, DEVICE_NAME_MAX);
  return cleaned.length === 0 ? FALLBACK_NODE_NAME : cleaned;
}

/**
 * Validates the device name input against D-11. Returns null on
 * success (the bang-free convention this codebase uses for "no error").
 */
function validateNodeName(name: string): string | null {
  if (name.length === 0) return VALIDATION_COPY;
  if (name.length > DEVICE_NAME_MAX) return VALIDATION_COPY;
  if (DEVICE_NAME_REGEX.test(name) === false) return VALIDATION_COPY;
  return null;
}

interface RoleOption {
  value: FirstRunRole;
  primary: string;
  description: string;
  disabled: boolean;
}

function buildRoleOptions(platform: Platform): readonly [RoleOption, RoleOption] {
  const isLinux = platform === "linux";
  return [
    {
      value: "join_the_mesh",
      primary: "Join the mesh",
      description: "just be a node; relays happen automatically",
      disabled: false,
    },
    {
      value: "share_my_internet",
      primary: "Share my internet",
      description: isLinux === true
        ? "gateway mode — Linux only. CAP_NET_ADMIN + iptables."
        : "Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay.",
      disabled: isLinux === false,
    },
  ] as const;
}

export function FirstRunScreen({
  path,
  onBootstrapComplete,
}: FirstRunScreenProps): React.JSX.Element {
  // Platform gate runs once on mount — no need for React state since
  // it's deterministic per process. useState ignores the second arg.
  const [platform] = useState<Platform>(() => detectPlatform());
  const [nodeName, setNodeName] = useState<string>(() =>
    sanitizeNodeName(FALLBACK_NODE_NAME),
  );
  const [role, setRole] = useState<FirstRunRole>("join_the_mesh");
  const [validationError, setValidationError] = useState<string | null>(null);

  const bootstrap = useConfigBootstrap();
  const isBooting =
    bootstrap.status === "writing_config" ||
    bootstrap.status === "requesting_permission" ||
    bootstrap.status === "starting_daemon";

  // D-13 step 5 — fire onBootstrapComplete exactly once on the
  // "complete" transition. The ref dedupes against React StrictMode
  // double-mount in dev; production has a single transition path.
  const completedRef = useRef(false);
  useEffect(() => {
    if (
      bootstrap.status === "complete" &&
      completedRef.current === false
    ) {
      completedRef.current = true;
      onBootstrapComplete();
    }
  }, [bootstrap.status, onBootstrapComplete]);

  function handleNodeNameChange(next: string): void {
    setNodeName(next);
    // D-11: clear the inline validation error on the next valid edit.
    if (validationError === null) return;
    if (validateNodeName(next) === null) {
      setValidationError(null);
    }
  }

  function handleRoleChange(next: FirstRunRole): void {
    setRole(next);
  }

  async function handleStart(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isBooting === true) return;
    const validation = validateNodeName(nodeName);
    if (validation === null) {
      setValidationError(null);
      await bootstrap.runBootstrap({ nodeName, role });
      return;
    }
    setValidationError(validation);
  }

  const roleOptions = buildRoleOptions(platform);
  const startButtonLabel = isBooting === true ? "booting…" : "Start pim";
  const startButtonAriaLabel = isBooting === true ? "Starting pim" : undefined;
  const inputAriaInvalid = validationError === null ? undefined : true;

  return (
    <main
      aria-label="first-run setup"
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8"
    >
      <h1 className="sr-only">Set up this pim node</h1>
      <form
        onSubmit={handleStart}
        className="flex flex-col items-center gap-6 w-full max-w-[640px]"
      >
        <span
          className="font-mono text-xl tracking-tight logo-hero"
          aria-hidden="false"
        >
          <span className="phosphor">█ pim</span>
        </span>

        <CliPanel title="NEW NODE" className="w-full">
          <fieldset
            className="flex flex-col gap-6 border-0 p-0 m-0"
            disabled={isBooting}
          >
            <div className="flex flex-col">
              <label
                htmlFor="device-name"
                className="font-mono text-xs uppercase tracking-widest text-foreground"
              >
                device name
              </label>
              <Input
                id="device-name"
                name="device-name"
                autoFocus
                value={nodeName}
                onChange={(e) => handleNodeNameChange(e.target.value)}
                maxLength={DEVICE_NAME_MAX}
                aria-describedby="device-name-helper device-name-error"
                aria-invalid={inputAriaInvalid}
              />
              <p
                id="device-name-helper"
                className="font-mono text-xs text-muted-foreground mt-1"
              >
                your hostname — edit if you want
              </p>
              {validationError === null ? null : (
                <p
                  id="device-name-error"
                  role="alert"
                  className="font-code text-sm text-destructive mt-2"
                >
                  {validationError}
                </p>
              )}
            </div>

            <hr className="border-t border-border m-0" />

            <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">
              <legend className="font-mono text-xs uppercase tracking-widest text-foreground">
                role
              </legend>
              {/* Two radios written inline (not mapped) so the markup
                  matches the UI-SPEC §S1 1:1 and the source radio
                  count equals the rendered radio count. */}
              <label
                className={cn(
                  "flex flex-col gap-1 -ml-3 pl-3 cursor-pointer",
                  "border-l-2 border-transparent",
                  "focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-[-2px]",
                  "hover:bg-popover/60 hover:border-border-active",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value={roleOptions[0].value}
                    checked={role === roleOptions[0].value}
                    onChange={() => handleRoleChange(roleOptions[0].value)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={
                      role === roleOptions[0].value
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {role === roleOptions[0].value ? "◆" : "○"}
                  </span>
                  <span className="text-foreground">
                    {roleOptions[0].primary}
                  </span>
                </span>
                <span className="font-code text-xs text-muted-foreground pl-6">
                  {roleOptions[0].description}
                </span>
              </label>
              <label
                className={cn(
                  "flex flex-col gap-1 -ml-3 pl-3 cursor-pointer",
                  "border-l-2 border-transparent",
                  "focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-[-2px]",
                  roleOptions[1].disabled === true
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:bg-popover/60 hover:border-border-active",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value={roleOptions[1].value}
                    checked={role === roleOptions[1].value}
                    onChange={() => handleRoleChange(roleOptions[1].value)}
                    disabled={roleOptions[1].disabled}
                    aria-disabled={
                      roleOptions[1].disabled === true ? true : undefined
                    }
                    tabIndex={roleOptions[1].disabled === true ? -1 : 0}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={
                      role === roleOptions[1].value
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {role === roleOptions[1].value ? "◆" : "○"}
                  </span>
                  <span
                    className={
                      roleOptions[1].disabled === true
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }
                  >
                    {roleOptions[1].primary}
                  </span>
                </span>
                <span className="font-code text-xs text-muted-foreground pl-6">
                  {roleOptions[1].description}
                </span>
              </label>
            </fieldset>

            <hr className="border-t border-border m-0" />

            <p className="font-mono text-xs text-muted-foreground leading-[1.6]">
              config will be written to{" "}
              <span className="font-code">{path}</span> · edit later in
              Settings
            </p>
          </fieldset>
        </CliPanel>

        {bootstrap.error === null ? null : (
          <div
            role="alert"
            className="w-full font-code text-sm text-destructive"
          >
            {bootstrap.error.message}
          </div>
        )}

        <div className="flex gap-4 justify-center w-full">
          <Button
            type="submit"
            size="lg"
            disabled={isBooting}
            aria-disabled={isBooting === true ? true : undefined}
            aria-label={startButtonAriaLabel}
          >
            {startButtonLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled
            aria-disabled={true}
            title="(Phase 3)"
          >
            Customize…
          </Button>
        </div>
      </form>
    </main>
  );
}
