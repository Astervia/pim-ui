/**
 * <SimpleSettingsScreen /> — essential settings for simple mode.
 *
 * Card-based layout, three blocks:
 *   1. Device name — text input with inline save (config.save +
 *      refetchSettingsConfig). The name appears to other peers
 *      during pairing.
 *   2. App mode — accent card pushing toward the advanced shell.
 *   3. About — version + short description of what pim is.
 *
 * Visual contract:
 *   - Each card is a CliPanel-style block (1px border + accented
 *     left edge in the section's tone color).
 *   - Headings use a glyph + uppercase mono label so the cards read
 *     as "terminal panels" matching the brand.
 *   - The hero-mark "█ pim" sits at the top of the settings page so
 *     simple-mode users always see the brand identity, even on the
 *     non-primary surface.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSettingsConfig, refetchSettingsConfig } from "@/hooks/use-settings-config";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useAppMode } from "@/hooks/use-app-mode";
import { assembleToml, getPath } from "@/lib/config/assemble-toml";
import { callDaemon } from "@/lib/rpc";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function SimpleSettingsScreen() {
  const { base, source } = useSettingsConfig();
  const { snapshot } = useDaemonState();
  const { setMode } = useAppMode();

  const stored =
    base === null
      ? ""
      : typeof getPath(base, "node.name") === "string"
        ? (getPath(base, "node.name") as string)
        : "";

  const [name, setName] = useState<string>(stored);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    setName(stored);
  }, [stored]);

  const isDirty = name !== stored;
  const limited = source !== "rpc";

  const onSave = async (): Promise<void> => {
    if (base === null) return;
    if (limited === true) return;
    setBusy(true);
    const trimmed = name.trim();
    try {
      const doc = assembleToml(base, {
        identity: { name: trimmed },
      });
      await callDaemon("config.save", {
        format: "toml",
        config: doc,
        dry_run: true,
      });
      const real = await callDaemon("config.save", {
        format: "toml",
        config: doc,
        dry_run: false,
      });
      await refetchSettingsConfig();
      if (real.requires_restart.length > 0) {
        toast.success("Saved. Restart pim to apply the new name.");
      } else {
        toast.success("Name saved.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't save: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-6 pt-10 pb-12">
      <div className="w-full max-w-xl flex flex-col gap-10">
        {/* ── Page header with quiet hero ──────────────────── */}
        <header className="flex flex-col items-center gap-4 simple-fade-in">
          <Logo size="lg" className="phosphor" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-text-secondary">
              settings
            </span>
            <h1 className="font-mono text-2xl text-foreground tracking-tight">
              the essentials
            </h1>
          </div>
        </header>

        {/* ── Device name card ─────────────────────────────── */}
        <SettingsCard
          glyph="◇"
          tone="primary"
          eyebrow="01 · identity"
          title="device name"
        >
          <p className="font-code text-xs text-text-secondary leading-6">
            other people with pim see this name when your device shows
            up nearby. choose something you'll recognize.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <label
              htmlFor="simple-device-name"
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
            >
              ↳ name
            </label>
            <input
              id="simple-device-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. pedro's laptop"
              disabled={limited === true || busy === true}
              className={cn(
                "w-full px-3 py-2.5 bg-background border border-border text-foreground font-code text-sm",
                "focus:border-primary focus:outline-none transition-colors duration-100 ease-linear",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            />
          </div>

          {limited === true ? (
            <p className="font-code text-xs text-accent flex items-center gap-2">
              <span aria-hidden="true">◐</span>
              <span>turn pim on to edit the name.</span>
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                void onSave();
              }}
              disabled={
                limited === true || busy === true || isDirty === false
              }
              className={cn(
                "px-5 py-2 border-2 font-mono text-sm uppercase tracking-[0.25em]",
                "transition-colors duration-150 ease-linear",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
                "border-primary text-primary hover:bg-primary hover:text-primary-foreground",
                "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary",
              )}
            >
              {busy === true ? "saving…" : "[ save ]"}
            </button>
            {isDirty === true && busy === false ? (
              <button
                type="button"
                onClick={() => setName(stored)}
                className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary hover:text-foreground transition-colors duration-100 ease-linear"
              >
                undo
              </button>
            ) : null}
          </div>
        </SettingsCard>

        {/* ── App mode card ────────────────────────────────── */}
        <SettingsCard
          glyph="◈"
          tone="accent"
          eyebrow="02 · app mode"
          title="want every detail?"
        >
          <p className="font-code text-xs text-text-secondary leading-6">
            advanced mode shows peers in detail, transport per
            connection, daemon logs, full toml configuration and
            diagnostic tools. you can switch back any time with{" "}
            <span className="text-accent">{"⌘\\"}</span>.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMode("advanced")}
              className="px-5 py-2 border-2 border-accent text-accent font-mono text-sm uppercase tracking-[0.25em] hover:bg-accent hover:text-accent-foreground transition-colors duration-150 ease-linear focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              [ go to advanced mode → ]
            </button>
          </div>
        </SettingsCard>

        {/* ── About card ───────────────────────────────────── */}
        <SettingsCard
          glyph="◯"
          tone="muted"
          eyebrow="03 · about"
          title="what is pim?"
        >
          <p className="font-code text-xs text-text-secondary leading-6">
            pim creates a private network between nearby devices
            without relying on external servers. your traffic travels
            encrypted, directly between connected peers.
          </p>
          <div className="pt-3 grid grid-cols-2 gap-3 text-[11px] font-code">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground uppercase tracking-[0.2em]">
                daemon
              </span>
              <span className="text-foreground">
                {snapshot.hello === null ? "offline" : snapshot.hello.daemon}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground uppercase tracking-[0.2em]">
                state
              </span>
              <span
                className={cn(
                  snapshot.state === "running"
                    ? "text-primary"
                    : "text-text-secondary",
                )}
              >
                {snapshot.state}
              </span>
            </div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

// ─── SettingsCard — small visual primitive used only here ───────

interface SettingsCardProps {
  glyph: string;
  tone: "primary" | "accent" | "muted";
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}

function SettingsCard({
  glyph,
  tone,
  eyebrow,
  title,
  children,
}: SettingsCardProps) {
  const toneEdgeClass =
    tone === "primary"
      ? "border-l-primary"
      : tone === "accent"
        ? "border-l-accent"
        : "border-l-muted";
  const toneGlyphClass =
    tone === "primary"
      ? "text-primary phosphor"
      : tone === "accent"
        ? "text-accent"
        : "text-muted-foreground";

  return (
    <section
      className={cn(
        "relative flex flex-col gap-4 p-6 bg-popover border border-border simple-fade-in",
        "border-l-2",
        toneEdgeClass,
      )}
    >
      {/* Header bar — glyph + eyebrow + title, with a faint dotted
          separator below to read as a CRT panel header. */}
      <header className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn("font-code text-2xl leading-none mt-0.5", toneGlyphClass)}
        >
          {glyph}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-text-secondary">
            {eyebrow}
          </span>
          <h2 className="font-mono text-lg text-foreground tracking-tight">
            {title}
          </h2>
        </div>
      </header>
      <div
        aria-hidden="true"
        className="border-t border-dashed border-border/60"
      />
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
