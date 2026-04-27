/**
 * <RawWinsBanner /> — verbatim CONF-07 banner. Phase 3 Plan 03-04 §Part D.
 *
 * Spec: ROADMAP.md §Phase 3 success criterion 4 + CONF-07 + 03-CONTEXT D-15.
 *
 * Copy contract (LOAD-BEARING — verbatim per ROADMAP):
 *   `Raw is source of truth — form view shows a subset`
 *
 * Renders at the TOP of any section whose schema-diff scan flipped
 * rawWins=true (i.e. the parsed TOML has at least one key under that
 * section's prefix that isn't covered by SECTION_SCHEMAS.tomlKeys). The
 * `[ Open Advanced ]` action smooth-scrolls to the Advanced section
 * anchor (`settings-section-advanced` — Plan 03-06 populates the body,
 * Plan 03-04's CollapsibleCliPanel already uses that id pattern via the
 * `<section id={`settings-section-${id}`}>` wrapper).
 *
 * Brand rules:
 *   - Zero radius. bg-popover surface. border-border outline.
 *   - font-mono throughout — banner role is chrome.
 *   - No literal palette colors — text-foreground / text-muted-foreground.
 */

import { Button } from "@/components/ui/button";

/**
 * Anchor id for the Advanced section. The CollapsibleCliPanel renders
 * each section as `<section id="settings-section-{id}">` so this string
 * matches the Advanced panel container automatically.
 */
const ADVANCED_ANCHOR_ID = "settings-section-advanced";

export function RawWinsBanner() {
  const openAdvanced = () => {
    const el = document.getElementById(ADVANCED_ANCHOR_ID);
    if (el !== null) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return (
    <div className="mb-4 p-3 border border-border bg-popover font-mono text-sm">
      <p className="text-foreground">
        Raw is source of truth — form view shows a subset
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={openAdvanced}
      >
        [ Open Advanced ]
      </Button>
    </div>
  );
}
