/**
 * Build a full TOML document from the parsed base config + per-section
 * form values. The base is the last `config.get` response parsed; the
 * overrides are the react-hook-form values for each section.
 *
 * Contract (D-10):
 *   - Every key in the base that is NOT listed in a SECTION_SCHEMAS
 *     entry is preserved verbatim — this is the "unmapped fields live
 *     through" guarantee that enables raw-is-source-of-truth detection.
 *   - Keys in SECTION_SCHEMAS are overwritten with the form value iff
 *     that section's form values are passed in (partial object).
 *   - Output is @iarna/toml.stringify(mergedObject).
 */
import TOML, { type JsonMap } from "@iarna/toml";
import type { ParsedConfig } from "./parse-toml";
import { type SectionId, SECTION_SCHEMAS } from "./section-schemas";

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  if (parts.length === 0) return;
  let node: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as string;
    const next = node[key];
    if (
      next === undefined ||
      next === null ||
      typeof next !== "object" ||
      Array.isArray(next)
    ) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1] as string;
  node[lastKey] = value;
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let node: unknown = source;
  for (const key of parts) {
    if (
      node === null ||
      node === undefined ||
      typeof node !== "object" ||
      Array.isArray(node)
    ) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

export function assembleToml(
  base: ParsedConfig,
  sectionValues: Partial<Record<SectionId, Record<string, unknown>>>,
): string {
  // Deep-clone via JSON round-trip (ParsedConfig is plain JSON shape).
  const merged = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  for (const [sectionId, values] of Object.entries(sectionValues)) {
    if (values === undefined || values === null) continue;
    const schema = SECTION_SCHEMAS[sectionId as SectionId];
    for (const tomlKey of schema.tomlKeys) {
      // The form object stores values keyed by the fully-qualified path
      // (e.g. "transport.listen_port"), matching the schema key. The
      // form registration in Plan 03-04 provides values keyed this way.
      if (tomlKey in values) {
        setPath(merged, tomlKey, values[tomlKey]);
      }
    }
  }
  return TOML.stringify(merged as JsonMap);
}

// Re-export getPath for the section components that need to seed form
// defaultValues from the parsed base.
export { getPath };
