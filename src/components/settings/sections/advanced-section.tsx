/**
 * <AdvancedSection /> — ADVANCED — RAW CONFIG settings panel (CONF-06).
 * Phase 3 Plan 03-06 §Part D.
 *
 * Spec:
 *   - 03-UI-SPEC §S1 (collapsed summary `{n} lines · last saved {ts relative}`)
 *   - 03-UI-SPEC §S1b Raw-TOML editor surface (RawTomlEditor body)
 *   - 03-CONTEXT D-14 (raw-TOML editor — plain textarea, NOT CodeMirror /
 *     Monaco / Prism)
 *   - 03-CONTEXT D-15 (raw-is-source-of-truth — Advanced is the destination
 *     of every section's `[ Open Advanced ]` scroll action; the
 *     CollapsibleCliPanel chrome already renders `<section
 *     id="settings-section-advanced">` which is the scroll anchor used by
 *     RawWinsBanner.openAdvanced)
 *
 * No save footer here — RawTomlEditor owns its own `[ Save ]` button per
 * D-12 (raw save is verbatim-buffer + dry_run-first; not the form-section
 * orchestration which uses assembleToml).
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { CollapsibleCliPanel } from "@/components/settings/collapsible-cli-panel";
import { RawTomlEditor } from "@/components/settings/raw-toml-editor";
import { useSettingsConfig } from "@/hooks/use-settings-config";

/**
 * Format an ISO-8601 timestamp as a relative string ("just now", "3m ago",
 * "5h ago", "2d ago") for the collapsed-section summary. Empty / invalid
 * timestamps return "" so the surrounding template renders cleanly.
 */
function relative(iso: string): string {
  if (iso === "") return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t) === true) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export interface AdvancedSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdvancedSection({ open, onOpenChange }: AdvancedSectionProps) {
  const { raw, lastModified } = useSettingsConfig();
  const lineCount = raw === "" ? 0 : raw.split("\n").length;
  const rel = relative(lastModified);
  const summary = (
    <span className="font-mono text-xs text-muted-foreground">
      {lineCount} lines{rel === "" ? "" : ` · last saved ${rel}`}
    </span>
  );

  return (
    <CollapsibleCliPanel
      id="advanced"
      title="ADVANCED — RAW CONFIG"
      summary={summary}
      open={open}
      onOpenChange={onOpenChange}
    >
      {/* The CollapsibleCliPanel's outer <section> already carries
          id="settings-section-advanced" — RawWinsBanner.openAdvanced
          targets that anchor. The inner div below is a redundant
          target so smoothScroll resolves even if the outer panel
          implementation later changes its anchor strategy. */}
      <div id="settings-section-advanced-anchor">
        <RawTomlEditor />
      </div>
    </CollapsibleCliPanel>
  );
}
