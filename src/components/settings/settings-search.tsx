/**
 * <SettingsSearch /> — top-of-screen filter for the Settings page.
 *
 * Post-redesign: bigger, more confident input that anchors the page.
 * Uses the brand <Input> primitive (now bordered with focus state) and
 * adds a leading magnifier-style glyph + a clear button when filled.
 * Reads as a real terminal filter rather than a generic search box.
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │ ⌕ > filter sections…                          [×]  │
 *   └────────────────────────────────────────────────────┘
 */

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SettingsSearchProps {
  value: string;
  onChange: (next: string) => void;
}

export const SettingsSearch = forwardRef<HTMLInputElement, SettingsSearchProps>(
  ({ value, onChange }, ref) => {
    const showClear = value.length > 0;
    return (
      <div className="relative">
        {/* Leading glyph — sits inside the field's left padding so the
            input still owns the focus border. */}
        <span
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 font-mono text-text-secondary leading-none pointer-events-none"
        >
          ⌕
        </span>
        <Input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="filter sections by title or wire key…"
          spellCheck={false}
          autoComplete="off"
          aria-label="filter settings sections"
          className="pl-9"
          prompt=""
        />
        {showClear === true ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="clear filter"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 z-10",
              "h-7 w-7 inline-flex items-center justify-center",
              "font-mono text-base leading-none",
              "text-text-secondary hover:text-primary",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
              "transition-colors duration-100 ease-linear",
            )}
          >
            <span aria-hidden>×</span>
          </button>
        ) : null}
      </div>
    );
  },
);
SettingsSearch.displayName = "SettingsSearch";
