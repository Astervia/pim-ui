/**
 * <SaveAllBar /> — sticky footer that surfaces "save every dirty
 * section" when at least one section has unsaved edits.
 *
 * Visibility rule: render only when `useDirtySections().anyDirty` is
 * true. Sliding it in/out of the layout based on dirty-state means the
 * page chrome stays calm in the steady state and the affordance only
 * appears when there's actually something to save — matches UX-PLAN §1
 * P2 ("only show what's relevant right now").
 *
 * Save flow (sequential, not parallel):
 *   - Read every registered section save callback from the save registry.
 *   - For each currently-dirty section, await its callback in turn so
 *     each save sees a freshly-refetched `base` from the previous one.
 *     Parallel saves would clobber each other because each section's
 *     `assembleToml(base, { [id]: values })` preserves OTHER sections
 *     verbatim from the pre-save base.
 *   - Toast aggregate result (`Saved 3 sections.` / first failure msg).
 *
 * Brand: 1px border, no radius, no shadows, no literal palette colors.
 * Mirrors SectionSaveFooter's button anatomy so the visual language
 * stays consistent across per-section and global save.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDirtySections } from "@/hooks/use-dirty-sections";
import { getRegisteredSaves } from "@/hooks/use-save-registry";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { cn } from "@/lib/utils";

export function SaveAllBar() {
  const { dirtyIds, anyDirty, sections } = useDirtySections();
  const { snapshot } = useDaemonState();
  const offline = snapshot.state === "running" ? false : true;
  const [saving, setSaving] = useState<boolean>(false);

  if (anyDirty === false) {
    return null;
  }

  const totalDirtyFields = dirtyIds.reduce(
    (acc, id) => acc + sections[id].dirtyFieldCount,
    0,
  );
  const sectionsLabel =
    dirtyIds.length === 1 ? "1 section" : `${dirtyIds.length} sections`;
  const fieldsLabel =
    totalDirtyFields === 1 ? "1 field" : `${totalDirtyFields} fields`;

  const onSaveAll = async (): Promise<void> => {
    setSaving(true);
    const registry = getRegisteredSaves();
    const ids = [...dirtyIds];
    let savedCount = 0;
    try {
      for (const id of ids) {
        const fn = registry.get(id);
        if (fn === undefined) continue;
        await fn();
        savedCount += 1;
      }
      // Each section save already surfaces its own toast (success or
      // error). Add a single aggregate confirmation when everything
      // landed, so the user gets one clear summary line.
      if (savedCount > 0) {
        const dest = offline === true ? " to disk" : "";
        toast.success(
          `Saved ${savedCount} ${savedCount === 1 ? "section" : "sections"}${dest}.`,
          { duration: 2500 },
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="save all dirty sections"
      className={cn(
        "sticky bottom-0 z-20 mt-3",
        "border-t border-border bg-background/95 backdrop-blur-sm",
        "px-2 py-3",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-code text-xs flex items-center gap-2 text-accent">
          <span aria-hidden className="phosphor-pulse">
            ◆
          </span>
          <span>
            {sectionsLabel} dirty · {fieldsLabel}
            {offline === true ? " · will write to disk" : ""}
          </span>
        </div>
        <Button
          type="button"
          variant="default"
          disabled={saving === true}
          aria-busy={saving === true ? true : undefined}
          onClick={() => {
            void onSaveAll();
          }}
        >
          {saving === true ? "[ SAVING ALL… ]" : "[ SAVE ALL ]"}
        </Button>
      </div>
    </div>
  );
}
