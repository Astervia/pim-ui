/**
 * <SettingsSearch /> — prompt-style filter for the Settings screen.
 *
 * Phase 7 (UI/UX overhaul plan): the Settings screen exposes 13
 * collapsible sections in a long scroll. This component is the
 * top-of-screen filter that lets the user narrow the visible set by
 * either section title (e.g. "bluetooth") or a daemon TOML key
 * (e.g. "discovery.shared_key", "wifi_direct.go_intent").
 *
 * Anatomy:
 *
 *   > filter sections…              [ × ]
 *
 * The leading `> ` prompt prefix is provided by the brand <Input>
 * primitive at src/components/ui/input.tsx. The trailing clear button
 * is rendered ONLY when value is non-empty so the row stays visually
 * quiet at rest.
 *
 * Controlled: parent owns `value`. Filtering policy lives in the
 * parent (SettingsScreen) — this component is purely the input
 * surface + clear affordance.
 *
 * Bang-free conditionals per project policy.
 */

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SettingsSearchProps {
  value: string;
  onChange: (next: string) => void;
}

export const SettingsSearch = forwardRef<HTMLInputElement, SettingsSearchProps>(
  ({ value, onChange }, ref) => {
    const showClear = value.length > 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="filter sections…"
            spellCheck={false}
            autoComplete="off"
            aria-label="filter settings sections"
          />
        </div>
        {showClear === true ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="clear filter"
            onClick={() => onChange("")}
          >
            ×
          </Button>
        ) : null}
      </div>
    );
  },
);
SettingsSearch.displayName = "SettingsSearch";
