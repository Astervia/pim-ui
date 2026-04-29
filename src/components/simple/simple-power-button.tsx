/**
 * <SimplePowerButton /> — circular on/off button for simple mode.
 *
 * Terminal-CRT style: thin border + optional phosphor halo via
 * `power-glow`, monospace typography, state-dependent label.
 *
 * The button is large (208px) and centered to be the absolute focus
 * of the screen when the app is off. When on, the consumer swaps
 * `power-glow` for the destructive variant (red) and the label
 * becomes "TURN OFF".
 */

import { cn } from "@/lib/utils";

export type PowerButtonTone = "off" | "on" | "transient";

export interface SimplePowerButtonProps {
  label: string;
  tone: PowerButtonTone;
  disabled?: boolean;
  onClick: () => void;
  /** Small text above the button — explains what the click does. */
  hint?: string;
}

export function SimplePowerButton({
  label,
  tone,
  disabled = false,
  onClick,
  hint,
}: SimplePowerButtonProps) {
  const isOff = tone === "off";
  const isOn = tone === "on";
  const isTransient = tone === "transient";

  return (
    <div className="flex flex-col items-center gap-4">
      {hint !== undefined ? (
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-text-secondary">
          {hint}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={isTransient || undefined}
        className={cn(
          "relative w-52 h-52 flex flex-col items-center justify-center gap-2",
          "border bg-popover transition-colors duration-150 ease-linear",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4",
          "disabled:cursor-not-allowed disabled:opacity-60",
          isOff && "border-primary text-primary power-glow hover:text-brand-hover",
          isOn &&
            "border-destructive text-destructive hover:text-destructive-foreground hover:bg-destructive/20",
          isTransient && "border-accent text-accent",
        )}
      >
        {/* Center glyph — filled block for "on", outline circle for
            "off". Not decorative: it communicates state. */}
        <span
          aria-hidden="true"
          className={cn(
            "font-code text-5xl leading-none",
            isTransient && "phosphor-pulse",
          )}
        >
          {isOff ? "○" : isOn ? "█" : "◆"}
        </span>
        <span className="font-mono text-sm uppercase tracking-[0.35em]">
          {label}
        </span>
      </button>
    </div>
  );
}
