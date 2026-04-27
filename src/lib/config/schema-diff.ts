/**
 * Raw-is-source-of-truth detection (CONF-07 / D-15).
 *
 * After every successful save the Settings screen re-fetches config
 * and calls diffSectionsAgainstSchema(parsed) to learn which sections
 * have TOML keys the form view cannot represent. Those sections render
 * the banner `Raw is source of truth — form view shows a subset` on
 * next open (verbatim per ROADMAP §Phase 3 success criterion 4).
 */
import type { ParsedConfig } from "./parse-toml";
import { type SectionId, SECTION_IDS, SECTION_SCHEMAS } from "./section-schemas";

export type SectionRawWinsMap = Record<SectionId, boolean>;

function flatten(source: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(source)) {
    const path = prefix === "" ? k : `${prefix}.${k}`;
    if (v !== null && typeof v === "object" && Array.isArray(v) === false) {
      keys.push(...flatten(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/**
 * For each section, return true iff parsed TOML contains at least one
 * key that starts with a section prefix (loose: e.g. "transport.*")
 * but is NOT listed in that section's SECTION_SCHEMAS.tomlKeys.
 *
 * Section prefix derivation: the shortest common prefix across the
 * section's tomlKeys. Sections with empty tomlKeys (gateway, advanced,
 * about) always return false — nothing to diff.
 */
export function diffSectionsAgainstSchema(
  parsed: ParsedConfig,
): SectionRawWinsMap {
  const flatKeys = flatten(parsed);
  const result = {} as SectionRawWinsMap;
  for (const id of SECTION_IDS) {
    const schema = SECTION_SCHEMAS[id];
    if (schema.tomlKeys.length === 0) {
      result[id] = false;
      continue;
    }
    // Prefix = first dotted segment of the first schema key.
    const firstKey = schema.tomlKeys[0] as string;
    const prefix = firstKey.split(".")[0] as string;
    const schemaKeySet = new Set(schema.tomlKeys);
    const sectionKeys = flatKeys.filter(
      (k) => k === prefix || k.startsWith(`${prefix}.`),
    );
    result[id] = sectionKeys.some((k) => schemaKeySet.has(k) === false);
  }
  return result;
}
