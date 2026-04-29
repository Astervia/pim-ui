/**
 * <SimplePeerCard /> — peer card for simple mode.
 *
 * Two variants:
 *   - "found"     — someone is nearby (not yet paired). Shows the
 *                   announced name + a primary [ CONNECT ] button
 *                   and a quiet [ ignore ] link. No jargon (no
 *                   "node_id", "mechanism", "transport") — just
 *                   social identity.
 *   - "connected" — you are connected to this peer. Shows ✓, name,
 *                   "online" indicator, and a [ DISCONNECT ] button.
 *
 * Reuses brand tokens (border-l-2 primary when connected, accent when
 * a peer just appeared). No border-radius, no gradients.
 */

import { cn } from "@/lib/utils";

export interface SimplePeerCardProps {
  variant: "found" | "connected";
  /** Friendly name — label_announced or formatted shortId. */
  name: string;
  /** Quiet subtitle — e.g. "via wi-fi" / "online · 2 min ago". */
  subtitle?: string;
  /** Primary button text — varies by context. */
  primaryLabel: string;
  onPrimary: () => void;
  /** Optional secondary button. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  busy?: boolean;
}

export function SimplePeerCard({
  variant,
  name,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  busy = false,
}: SimplePeerCardProps) {
  const isFound = variant === "found";

  return (
    <div
      className={cn(
        "w-full max-w-md flex flex-col gap-5 p-6 bg-popover border border-border simple-fade-in",
        isFound ? "border-l-2 border-l-accent" : "border-l-2 border-l-primary",
      )}
    >
      <div className="flex items-start gap-4">
        {/* Identity glyph — filled square (accent / primary) */}
        <div
          aria-hidden="true"
          className={cn(
            "shrink-0 w-12 h-12 flex items-center justify-center border font-code text-2xl leading-none",
            isFound
              ? "border-accent text-accent"
              : "border-primary text-primary phosphor",
          )}
        >
          {isFound ? "◆" : "✓"}
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
            {isFound ? "Someone is nearby" : "You're connected"}
          </span>
          <h2 className="font-mono text-xl text-foreground break-words">
            {name}
          </h2>
          {subtitle !== undefined ? (
            <p className="font-code text-xs text-text-secondary">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onPrimary}
          disabled={busy === true}
          aria-busy={busy === true || undefined}
          className={cn(
            "px-5 py-2 border font-mono text-sm uppercase tracking-[0.25em]",
            "transition-colors duration-150 ease-linear",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            isFound
              ? "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              : "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground",
          )}
        >
          {busy === true ? "..." : primaryLabel}
        </button>
        {secondaryLabel !== undefined && onSecondary !== undefined ? (
          <button
            type="button"
            onClick={onSecondary}
            disabled={busy === true}
            className="px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary hover:text-foreground transition-colors duration-100 ease-linear focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
