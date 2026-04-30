/**
 * Helpers shared by the Conversations screen for time + preview
 * formatting. Pure functions — kept outside React tree so the screens
 * stay declarative.
 */

const PAD = (n: number, w = 2): string => n.toString().padStart(w, "0");

/** Render a Unix-ms timestamp as `HH:MM` (24h, no seconds). */
export function formatTimeOfDay(timestampMs: number | null | undefined): string {
  if (timestampMs === null || timestampMs === undefined) return "";
  const d = new Date(timestampMs);
  return `${PAD(d.getHours())}:${PAD(d.getMinutes())}`;
}

/**
 * Sidebar timestamp: shows `HH:MM` for today, `Mon DD` for the same year,
 * and `YYYY-MM-DD` for older. Mirrors common CLI mailbox conventions.
 */
export function formatRelativeDate(timestampMs: number | null | undefined): string {
  if (timestampMs === null || timestampMs === undefined) return "";
  const now = new Date();
  const d = new Date(timestampMs);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay === true) return formatTimeOfDay(timestampMs);
  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear === true) {
    const month = d.toLocaleString("en", { month: "short" }).toLowerCase();
    return `${month} ${PAD(d.getDate())}`;
  }
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

/**
 * Single-character lifecycle marker shown next to outbound messages so
 * the user sees delivery progress without parsing icons.
 */
export function statusGlyph(
  status:
    | "pending"
    | "sent"
    | "delivered"
    | "read"
    | "failed"
    | undefined
    | null,
): string {
  switch (status) {
    case "pending":
      return "·";
    case "sent":
      return "›";
    case "delivered":
      return "✓";
    case "read":
      return "✓✓";
    case "failed":
      return "✗";
    default:
      return "";
  }
}

/** Truncate a body for sidebar previews. */
export function truncatePreview(s: string | null | undefined, max = 48): string {
  if (s === null || s === undefined) return "";
  const collapsed = s.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1)}…`;
}
