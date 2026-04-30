/**
 * Compile-only contract assertions for the config library. Runs via
 * `tsc --noEmit` (no vitest dep). Drift catches at typecheck time.
 *
 * Pattern matches `src/lib/rpc-types.test.ts` from Phase 1.
 */
import { SECTION_IDS, SECTION_SCHEMAS, type SectionId } from "./section-schemas";
import { parseToml, type ParseResult } from "./parse-toml";
import { assembleToml } from "./assemble-toml";
import {
  diffSectionsAgainstSchema,
  type SectionRawWinsMap,
} from "./schema-diff";

// Assert thirteen section ids (exactly) — "about" was promoted to its
// own ⌘7 screen, no longer a settings collapsible section. The
// thirteenth slot is "bluetooth_rfcomm" added alongside "bluetooth".
type AssertThirteenSections = typeof SECTION_IDS extends readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]
  ? true
  : false;
const _s: AssertThirteenSections = true;
void _s;

// Assert every SectionId has a schema entry (exhaustive Record<SectionId, …>).
const _exhaustive: Record<SectionId, unknown> = SECTION_SCHEMAS;
void _exhaustive;

// Assert parseToml is callable with a string and returns ParseResult.
const _parsed: ParseResult = parseToml("");
if (_parsed.ok) {
  const _v: Record<string, unknown> = _parsed.value;
  void _v;
} else {
  const _e: string = _parsed.error.message;
  void _e;
}

// Assert assembleToml returns string.
const _out: string = assembleToml({}, {});
void _out;

// Assert diffSectionsAgainstSchema returns SectionRawWinsMap.
const _map: SectionRawWinsMap = diffSectionsAgainstSchema({});
void _map;
