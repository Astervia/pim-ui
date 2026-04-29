/**
 * LogSearchInput — text-search input for the Logs tab (D-21).
 *
 * Renders the bordered prompt-style Input with a `▸ ` prefix and the
 * verbatim placeholder copy from 03-UI-SPEC §Logs tab completion copy.
 *
 * Post-redesign: the redundant external `search:` label was dropped —
 * the Input's own prompt-prefix already signals the field's purpose,
 * and the input lives at the top of the Logs panel where its role is
 * obvious. Stacking a label outside AND a prompt inside read as two
 * affordances for one job.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { Input } from "@/components/ui/input";
import { useLogFilters } from "@/hooks/use-log-filters";

export function LogSearchInput() {
  const { searchText, setSearchText } = useLogFilters();
  return (
    <Input
      type="text"
      prompt="▸ "
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      placeholder="search messages, sources, peers…"
      spellCheck={false}
      aria-label="search logs"
      className="w-full"
    />
  );
}
