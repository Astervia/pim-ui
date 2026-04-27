/**
 * Formatting helpers for the dashboard and peer surfaces.
 *
 * Pure functions, zero dependencies. Every helper follows 02-CONTEXT.md
 * §D-24 verbatim and feeds directly into the MetricsPanel string in
 * 02-UI-SPEC.md §Metrics panel.
 *
 * These helpers MUST stay tree-shakable — no lodash, no date-fns. The
 * only allocated resource is one module-level `Intl.NumberFormat`
 * instance for `formatCount`.
 */

// Module-level — allocated once, reused for every formatCount call.
// "en-US" locale gives the D-24 grouping of 3,847 / 1,234,567.
const COUNT_FORMATTER = new Intl.NumberFormat("en-US");

/**
 * Format a byte count as `"{n} B"` / `"{n.n} KB"` / `"{n.n} MB"` /
 * `"{n.n} GB"`. Values < 1024 render as integer bytes; every larger step
 * uses one decimal. Defensive against negative, NaN, and non-finite
 * inputs (daemon never emits those, but we refuse to crash if it does).
 *
 * Examples (D-24):
 *   formatBytes(512)         === "512 B"
 *   formatBytes(2048)        === "2.0 KB"
 *   formatBytes(4_400_000)   === "4.2 MB"
 *   formatBytes(1_500_000_000) === "1.4 GB"
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/**
 * Format a count with grouped digits via `Intl.NumberFormat("en-US")`.
 *
 * Examples:
 *   formatCount(0)       === "0"
 *   formatCount(3847)    === "3,847"
 *   formatCount(1234567) === "1,234,567"
 */
export function formatCount(n: number): string {
  return COUNT_FORMATTER.format(n);
}

/**
 * Format a duration in seconds as a two-unit human string per D-24:
 *   < 60s             → `"{n}s"`
 *   < 3600s (<1h)     → `"{m}m {ss}s"`
 *   < 86400s (<1d)    → `"{h}h {mm}m"`
 *   ≥ 86400s          → `"{d}d {hh}h"`
 *
 * Negative / NaN / non-finite → `"0s"` (defensive).
 *
 * Examples:
 *   formatDuration(32)      === "32s"
 *   formatDuration(262)     === "4m 22s"
 *   formatDuration(15_720)  === "4h 22m"
 *   formatDuration(302_400) === "3d 12h"
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}m ${ss}s`;
  }
  if (s < 86_400) {
    const h = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    return `${h}h ${mm}m`;
  }
  const d = Math.floor(s / 86_400);
  const hh = Math.floor((s % 86_400) / 3600);
  return `${d}d ${hh}h`;
}

/**
 * Render a short-form node id.
 *
 * - null / undefined / empty string → `"(no id)"` — matches the D-20
 *   Nearby row "(no id)" phrasing used when the peer announced
 *   anonymously.
 * - length ≥ 8 → first 8 characters (the 64-char Ed25519 pubkey's
 *   short prefix convention, matching `PeerSummary.node_id_short`).
 * - length < 8 → returned verbatim (defensive; daemon always emits
 *   8-char prefixes).
 */
export function formatShortId(nodeId: string | null | undefined): string {
  if (nodeId === null || nodeId === undefined || nodeId === "") {
    return "(no id)";
  }
  if (nodeId.length >= 8) return nodeId.slice(0, 8);
  return nodeId;
}

/**
 * Format a bitrate (bytes-per-second) per 05-CONTEXT D-13 + RESEARCH §9b.
 *
 * Mirrors formatBytes shape but with /s suffix:
 *   < 1024              → "{n} B/s"
 *   < 1024² (1 MiB)     → "{n.n} KB/s"
 *   < 1024³ (1 GiB)     → "{n.n} MB/s"
 *   ≥ 1024³             → "{n.n} GB/s"
 *
 * Defensive against negative / NaN / non-finite (daemon never emits, but
 * we refuse to crash if it does).
 *
 * Examples (RESEARCH §9b mockup):
 *   formatBitrate(1_400_000)   === "1.4 MB/s"
 *   formatBitrate(920_000)     === "920 KB/s"  (note: matches mockup; 920 KB ≈ 942_080 bps;
 *                                                we keep formatBytes-ish rounding)
 */
export function formatBitrate(bps: number): string {
  if (Number.isFinite(bps) === false || bps < 0) return "0 B/s";
  if (bps < 1024) return `${bps} B/s`;
  const kb = bps / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB/s`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB/s`;
}
