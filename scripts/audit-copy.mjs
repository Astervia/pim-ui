#!/usr/bin/env node
/**
 * Phase 4 D-27 / D-28: voice-contract audit.
 *
 * Source of truth: docs/COPY.md §3 (banned phrases) and §4 (soft warnings).
 * Falls back to a hardcoded list when docs/COPY.md is missing or its
 * sections cannot be parsed.
 *
 * Scope: src/{**,*}.{ts,tsx} excluding *.test.ts (tests may legitimately
 * reference banned strings as fixtures).
 *
 * Hard fails (exit 1):
 *   - Exclamation mark inside a string literal in production source.
 *   - Exclamation mark inside JSX text (between > and <).
 *   - Any banned phrase from docs/COPY.md §3.
 *
 * Soft warns (printed; exit 0 unless other errors):
 *   - Hedge words from docs/COPY.md §4 found inside string literals.
 *
 * Ignored heuristically:
 *   - Lines beginning with `//`, `/*`, `*` (comments).
 *   - Lines beginning with `import`.
 *   - Block comments stripped wholesale before per-line scanning.
 *   - Operators `!=` and `!==` (not exclamations in user-visible copy).
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Fallback lists (used when docs/COPY.md cannot be parsed).
let BANNED_PHRASES = [
  "Add your first peer",
  "Welcome to pim",
  "Get started",
  "Connecting…",
  "Oops",
  "Whoops",
];
let SOFT_WARNINGS = ["maybe", "please", "try to", "we'll", "kinda", "should"];

/**
 * Try to override BANNED_PHRASES + SOFT_WARNINGS from docs/COPY.md.
 * The doc's §3 entries are bullet-list items "- {phrase}". §4 same.
 * On any parse failure, keep the hardcoded fallback.
 */
async function loadFromCopyDoc() {
  let md;
  try {
    md = await readFile("docs/COPY.md", "utf8");
  } catch {
    return; // docs/COPY.md not present yet — use fallback.
  }
  const sec3 = md.match(/## 3\. Banned phrases\s*\n([\s\S]*?)(?=\n## )/);
  const sec4 = md.match(/## 4\. Soft warnings[^\n]*\n([\s\S]*?)(?=\n## )/);
  if (sec3 !== null) {
    const phrases = [...sec3[1].matchAll(/^- (.+)$/gm)]
      .map((m) => m[1].trim())
      .filter(
        (s) =>
          s.length > 0
          && s.startsWith("any string") === false
          && s.startsWith("any ") === false,
      );
    if (phrases.length > 0) BANNED_PHRASES = phrases;
  }
  if (sec4 !== null) {
    const words = [...sec4[1].matchAll(/^- (.+)$/gm)]
      .map((m) => m[1].trim())
      .filter((s) => s.length > 0);
    if (words.length > 0) SOFT_WARNINGS = words;
  }
}

/** Recursively yield every .ts / .tsx file under `dir`, skipping *.test.ts. */
async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory() === true) {
      yield* walk(p);
    } else if (
      (p.endsWith(".ts") === true || p.endsWith(".tsx") === true)
      && p.endsWith(".test.ts") === false
    ) {
      yield p;
    }
  }
}

/**
 * Scan a single file's text for violations and warnings.
 *
 * Returns `{ violations: string[], warnings: string[] }`. Each entry is
 * a printable `path:line: detail` string.
 */
function scan(file, text) {
  const violations = [];
  const warnings = [];

  // Strip /* ... */ block comments wholesale to reduce false positives.
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = stripped.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip pure comments and import lines.
    if (trimmed.startsWith("//") === true) continue;
    if (trimmed.startsWith("*") === true) continue;
    if (trimmed.startsWith("import ") === true) continue;
    if (trimmed.startsWith("import{") === true) continue;

    // ── Exclamation in string literals ────────────────────────────────
    // Match "..." or '...' or `...` containing '!' anywhere inside.
    // Per-quote regex avoids cross-quote false matches.
    for (const quote of ['"', "'", "`"]) {
      const escapedQuote = quote === "`" ? "\\`" : quote;
      const re = new RegExp(
        `${escapedQuote}([^${escapedQuote}\\n]*?)!([^${escapedQuote}\\n]*?)${escapedQuote}`,
        "g",
      );
      const matches = [...line.matchAll(re)];
      for (const m of matches) {
        // Skip operator forms: text immediately before/after the bang
        // forming "!=" or "!==" inside a literal is not a violation
        // because it is not user-visible copy.
        const before = m[1];
        const after = m[2];
        if (after.startsWith("=") === true) continue; // "!=", "!=="
        if (before.endsWith("=") === true) continue; // "==!" pattern (rare)
        violations.push(
          `${file}:${i + 1}: '!' in ${quote}-quoted string: ${m[0]}`,
        );
      }
    }

    // ── Exclamation in JSX text ───────────────────────────────────────
    // Pattern: >TEXT< on the same line, where TEXT contains an exclamation
    // and at least one non-whitespace character on each side.
    const jsxMatches = [...line.matchAll(/>([^<>{}\n]*?!.+?)</g)];
    for (const m of jsxMatches) {
      // Require at least one alphabetic character to avoid matching
      // operators like "/>!{...}" or other pure-syntax cases.
      if (/[a-z]/i.test(m[1]) === true) {
        violations.push(`${file}:${i + 1}: '!' in JSX text: ${m[1]}`);
      }
    }

    // ── Banned phrases (substring match in line) ──────────────────────
    for (const banned of BANNED_PHRASES) {
      if (line.includes(banned) === true) {
        violations.push(`${file}:${i + 1}: banned phrase '${banned}'`);
      }
    }

    // ── Soft warnings (only inside quoted strings) ────────────────────
    for (const soft of SOFT_WARNINGS) {
      // Build a per-quote regex that requires the soft-warning word to
      // appear inside the same quote pair as a word boundary.
      for (const quote of ['"', "'", "`"]) {
        const escapedQuote = quote === "`" ? "\\`" : quote;
        const re = new RegExp(
          `${escapedQuote}[^${escapedQuote}\\n]*\\b${soft}\\b[^${escapedQuote}\\n]*${escapedQuote}`,
          "i",
        );
        if (re.test(line) === true) {
          warnings.push(
            `${file}:${i + 1}: soft warning '${soft}': ${line.trim()}`,
          );
          break;
        }
      }
    }
  }

  return { violations, warnings };
}

async function main() {
  await loadFromCopyDoc();
  const allViolations = [];
  const allWarnings = [];
  for await (const f of walk("src")) {
    const text = await readFile(f, "utf8");
    const { violations, warnings } = scan(f, text);
    allViolations.push(...violations);
    allWarnings.push(...warnings);
  }
  for (const w of allWarnings) console.log(`WARN: ${w}`);
  for (const v of allViolations) console.log(`FAIL: ${v}`);
  if (allViolations.length > 0) {
    console.log(
      `\naudit:copy: ${allViolations.length} hard violations, ${allWarnings.length} soft warnings`,
    );
    process.exit(1);
  }
  console.log(
    `audit:copy: 0 hard violations, ${allWarnings.length} soft warnings`,
  );
}

main().catch((e) => {
  console.log(`audit:copy crashed: ${e.message}`);
  process.exit(1);
});
