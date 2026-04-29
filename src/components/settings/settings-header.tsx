/**
 * SettingsHeader — top control band for the Settings page.
 *
 * Composes:
 *   - Page title `settings` (mono, uppercase, brand-tier)
 *   - One-line subtitle: visible/total section counts + provenance line
 *   - Search input (delegates to <SettingsSearch />)
 *   - Explicit `[ collapse all ]` / `[ expand all ]` actions — the
 *     ⌘F / collapse-all / expand-all keyboard shortcuts already exist
 *     in app-shell.tsx but discoverability via visible buttons is
 *     better than discoverability-only-via-shortcut for the casual
 *     persona (UX-PLAN P2 — "main surface defaults match a first-timer").
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SettingsSearch } from "./settings-search";

export interface SettingsHeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  visibleCount: number;
  totalCount: number;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  /** True iff at least one section is currently expanded. */
  anyOpen: boolean;
  /** True iff every section is currently expanded. */
  allOpen: boolean;
  /** Where the config is coming from. `"disk"` means daemon is
   *  stopped and we're reading pim.toml directly — saves disabled. */
  source: "rpc" | "disk" | null;
}

const TOOLBAR_BTN = cn(
  "inline-flex items-center justify-center h-8 px-3",
  "font-mono text-[11px] uppercase tracking-wider",
  "border border-border bg-transparent text-text-secondary",
  "hover:border-primary hover:text-primary",
  "transition-colors duration-100 ease-linear",
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
  "disabled:opacity-40 disabled:cursor-default disabled:hover:border-border disabled:hover:text-text-secondary",
);

export const SettingsHeader = forwardRef<HTMLInputElement, SettingsHeaderProps>(
  (
    {
      query,
      onQueryChange,
      visibleCount,
      totalCount,
      onCollapseAll,
      onExpandAll,
      anyOpen,
      allOpen,
      source,
    },
    ref,
  ) => {
    const filtered = visibleCount !== totalCount;
    const sourceCopy =
      source === "disk"
        ? "reading pim.toml from disk · daemon stopped · saves apply on next start"
        : source === "rpc"
          ? "backed by pim-daemon · saves are atomic per section"
          : "loading…";
    return (
      <header className="flex flex-col gap-3 pb-4 border-b border-border">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="font-mono text-xl uppercase tracking-[0.2em] text-foreground">
            settings
          </h1>
          <p className="font-code text-[11px] text-text-secondary">
            <span className={cn("tabular-nums", filtered && "text-accent")}>
              {visibleCount}
            </span>
            <span className="text-muted-foreground"> / </span>
            <span className="tabular-nums">{totalCount}</span>
            <span className="text-muted-foreground"> sections</span>
            <span aria-hidden className="text-muted-foreground"> · </span>
            <span
              className={cn(
                source === "disk"
                  ? "text-accent"
                  : "text-muted-foreground",
              )}
            >
              {sourceCopy}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <SettingsSearch
              ref={ref}
              value={query}
              onChange={onQueryChange}
            />
          </div>

          <button
            type="button"
            onClick={onCollapseAll}
            disabled={anyOpen === false}
            className={TOOLBAR_BTN}
            aria-label="collapse every section"
          >
            <span aria-hidden className="mr-1.5">▸</span>
            collapse all
          </button>
          <button
            type="button"
            onClick={onExpandAll}
            disabled={allOpen === true}
            className={TOOLBAR_BTN}
            aria-label="expand every section"
          >
            <span aria-hidden className="mr-1.5">▾</span>
            expand all
          </button>
        </div>
      </header>
    );
  },
);
SettingsHeader.displayName = "SettingsHeader";
