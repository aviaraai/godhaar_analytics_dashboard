/**
 * Digit grouping only — React renders a bare number fine. Totals across a whole
 * state reach five and six figures, which are hard to compare at a glance in a
 * dense right-aligned column. Uses the browser locale, so an en-IN admin gets
 * the lakh grouping they expect: "1,24,318".
 */
export const formatCount = (value: number) => value.toLocaleString();

/**
 * A debug record's `created_at`, in the reader's own timezone. The wire value
 * is UTC; a reviewer correlating a spike against "when we shipped 2.4.1" is
 * thinking in local time, so converting is the whole point of formatting it.
 *
 * An unparseable value is passed through rather than shown as "Invalid Date" —
 * on a diagnostic screen the raw string is the more useful of the two.
 */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Similarity scores and their derived measures, at the three decimals that
 * separate one verdict from the next. Fixed width so a column of them lines up
 * and an outlier is visible without reading every digit.
 */
export const formatScore = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : value.toFixed(3);

const BYTE_UNITS = ["B", "KB", "MB", "GB"];

/**
 * A file size, at the unit a person would say it in.
 *
 * Binary units, because the backend's 512 MB cap is 536,870,912 bytes and every
 * message about it is a comparison against that number — a file shown as
 * "537 MB" beside a "512 MB limit" it does not actually exceed would be worse
 * than no number at all. One decimal below ten so "1.2 GB" and "980 MB" are
 * both readable, none above it because nobody needs "537.4 MB".
 */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? value : Number(value.toFixed(value < 10 ? 1 : 0));
  return `${rounded} ${BYTE_UNITS[unit]}`;
}

/**
 * Elapsed time, for a wait measured in minutes. Seconds are kept all the way
 * up because the number is watched while it climbs — a counter that stops
 * moving looks like a counter that has hung.
 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
