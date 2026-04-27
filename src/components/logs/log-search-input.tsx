/**
 * LogSearchInput — Phase 3 03-03 row-2 of the Logs filter bar (D-21).
 *
 * Spec: 03-UI-SPEC §S6 row 2 + §Logs tab completion copy.
 *
 * Behavior:
 *   - Value bound to the live searchText atom (updates on every
 *     keystroke so the input feels responsive).
 *   - Debounce (300 ms) lives in useLogFilters.setSearchText — the
 *     consumer of `searchTextDebounced` is the filter chain in
 *     useFilteredLogs.
 *   - Placeholder copy `search messages, sources, peers…` is verbatim
 *     from 03-UI-SPEC §Logs tab completion copy.
 *   - Layout: w-full max-w-xl, prefixed by `search:` label in
 *     muted-foreground (matches `level:` and `peer:` prefix convention
 *     from Phase 2 row 1 + row 3).
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { Input } from "@/components/ui/input";
import { useLogFilters } from "@/hooks/use-log-filters";

export function LogSearchInput() {
  const { searchText, setSearchText } = useLogFilters();
  return (
    <div className="flex items-center gap-2 w-full max-w-xl">
      <span className="font-code text-sm text-muted-foreground">search:</span>
      <Input
        type="text"
        prompt="▸ "
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="search messages, sources, peers…"
        spellCheck={false}
        aria-label="search logs"
        className="flex-1"
      />
    </div>
  );
}
