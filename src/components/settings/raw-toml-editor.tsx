/**
 * <RawTomlEditor /> — plain-textarea raw-TOML editor surface.
 * Phase 3 Plan 03-06 §Part C.
 *
 * Spec: 03-UI-SPEC §S1b Raw-TOML editor surface
 *   - Meta row (source path left / last-modified ISO right) above the editor
 *   - Editor frame: `border border-border bg-popover flex` two-column grid
 *     with the gutter on the left and the textarea on the right
 *   - Plain `<textarea>` (NOT contenteditable, NOT a rich editor — D-14):
 *     `font-code text-sm leading-[22px] bg-popover text-foreground p-3
 *      resize-none w-full min-h-[400px]`
 *   - `spellCheck={false}`, `wrap="off"`
 *   - Inline error rows below the editor — `font-code text-xs
 *     text-destructive leading-[22px] pl-12` (indented past the gutter)
 *   - Click a gutter `⚠` marker → cursor to (line, column), focus textarea
 *   - Save button uses the SAME `[ Save ]` / `[ Saving… ]` / `[ Saved ]`
 *     label grammar as the form sections (per UI-SPEC §Primary CTAs)
 *   - Unparseable-fallback banner (D-14 / UI-SPEC §Raw-TOML section copy):
 *     `Couldn't parse TOML returned by daemon.`
 *
 * Save flow (D-12):
 *   - Buffer is the textarea contents VERBATIM — no assembleToml here.
 *   - useRawTomlSave handles dry_run -> real save -> refetch -> toast.
 *   - On reject, errors[] populates the gutter ⚠ + inline `col {c}: {msg}`.
 *
 * Brand rules:
 *   - Zero radius. font-mono / font-code typography only.
 *   - bg-popover surface; no literal palette colors.
 *
 * W1 contract: NO listen(...) calls. callDaemon (request/response) only.
 *
 * Bang-free per project policy.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RawTomlGutter } from "./raw-toml-gutter";
import { useSettingsConfig } from "@/hooks/use-settings-config";
import { useRawTomlSave } from "@/hooks/use-raw-toml-save";
import { useConfigValidation } from "@/hooks/use-config-validation";
import { parseToml } from "@/lib/config/parse-toml";

/**
 * Convert a 1-based (line, column) pair into a 0-based character offset
 * inside the `text` string. Used by the gutter-click handler to move the
 * textarea cursor to the daemon-reported error position (D-14).
 *
 * - `line` is clamped against `lines.length`; out-of-range lines fall
 *   back to the start of the closest valid line.
 * - `column` is clamped to `>= 1`; columns past the end of a line clamp
 *   to the line's last character (TextArea handles this gracefully).
 */
function offsetOfLineCol(text: string, line: number, column: number): number {
  const lines = text.split("\n");
  const targetLine = Math.min(Math.max(line, 1), lines.length);
  let off = 0;
  for (let i = 0; i < targetLine - 1; i++) {
    const lineText = lines[i] ?? "";
    off += lineText.length + 1; // +1 for the \n
  }
  return off + Math.max(0, column - 1);
}

export function RawTomlEditor() {
  const { raw, sourcePath, lastModified } = useSettingsConfig();
  const { state, errors: saveErrors, save } = useRawTomlSave();
  const [buffer, setBuffer] = useState<string>(raw);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync local buffer when a fresh `raw` arrives (after save refetch).
  // The textarea is uncontrolled-by-effect: edits stay in `buffer`, and
  // a successful save's refetch trickles `raw` back here.
  useEffect(() => {
    setBuffer(raw);
  }, [raw]);

  // Live validation — disabled while a save is in flight so the post-save
  // error rows aren't visually contested by the live checker.
  const validationEnabled = state !== "saving" && state !== "saved";
  // `status` exposed by useConfigValidation drives optional "checking…"
  // UI; we don't surface it today (the gutter ⚠ is feedback enough), so
  // pull just the errors.
  const { errors: liveErrors } = useConfigValidation(buffer, validationEnabled);

  // Save errors win when present (post-Save reject is more authoritative
  // than client-side schema check); otherwise show whatever the live
  // validator just decided.
  const errors = saveErrors.length > 0 ? saveErrors : liveErrors;

  const lineCount = useMemo(() => buffer.split("\n").length, [buffer]);
  const errorLines = useMemo(
    () => new Set(errors.map((e) => e.line)),
    [errors],
  );
  const dirty = buffer !== raw;

  // D-14 fallback banner — surface ONLY when the daemon-returned `raw`
  // itself fails to parse client-side AND the user hasn't started
  // editing AND there are no daemon errors yet. Once the user types,
  // the banner gets out of the way; once daemon errors arrive, those
  // tell a more specific story.
  const parseCheck = useMemo(() => parseToml(buffer), [buffer]);
  const unparseable =
    parseCheck.ok === false && errors.length === 0 && dirty === false;

  const onErrorClick = (line: number): void => {
    const ta = taRef.current;
    if (ta === null) return;
    const err = errors.find((e) => e.line === line);
    const offset = offsetOfLineCol(buffer, line, err?.column ?? 1);
    ta.focus();
    ta.setSelectionRange(offset, offset);
  };

  const saveLabel =
    state === "saving"
      ? "[ Saving… ]"
      : state === "saved"
        ? "[ Saved ]"
        : "[ Save ]";
  const saveDisabled =
    state === "saving" || state === "saved" || dirty === false;

  return (
    <div>
      {unparseable === true && (
        <div className="mb-3 p-3 border border-border bg-popover font-mono text-sm">
          <p className="text-destructive">
            Couldn&apos;t parse TOML returned by daemon.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 font-mono">
        <span>source: {sourcePath}</span>
        <span>last modified {lastModified}</span>
      </div>

      <div className="border border-border bg-popover flex">
        <RawTomlGutter
          lineCount={lineCount}
          errorLines={errorLines}
          onErrorClick={onErrorClick}
        />
        <textarea
          ref={taRef}
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
          spellCheck={false}
          wrap="off"
          aria-label="raw pim.toml configuration"
          className="font-code text-sm leading-[22px] bg-popover text-foreground p-3 resize-none w-full min-h-[400px] outline-none"
        />
      </div>

      {errors.length > 0 && (
        <ul role="list" aria-live="polite" className="mt-2">
          {errors.map((err, i) => (
            <li
              key={`${err.line}-${err.column}-${i}`}
              className="font-code text-xs text-destructive leading-[22px] pl-12"
            >
              line {err.line} col {err.column}: {err.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {dirty === true && (
          <span
            aria-label="unsaved changes"
            role="img"
            className="text-primary font-mono"
          >
            ·
          </span>
        )}
        <Button
          type="button"
          variant="default"
          disabled={saveDisabled}
          aria-busy={state === "saving" ? true : undefined}
          onClick={() => void save(buffer)}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
