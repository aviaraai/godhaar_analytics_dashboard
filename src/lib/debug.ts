import { z } from "zod";
import type { DebugDevice, Decision, VerifiedState } from "@/lib/api";
import { startOfDayUtc, startOfNextDayUtc } from "@/lib/date";

/**
 * The parts of a search a filter may read. Structural rather than the card type
 * itself, so the same predicates serve an opened detail record — which carries
 * these fields too — without either module importing the other's shape.
 */
type SearchCardFields = {
  decision: Decision;
  verified: VerifiedState;
  godhaar_id: string | null;
  created_at: string;
};

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Both listings carry `created_at` as RFC3339 and nothing else to filter dates
 * on, so the range is applied here rather than asked of the backend — which
 * takes no query parameters at all.
 *
 * Half-open, `>= from` and `< day after to`, which is both the convention the
 * Go handlers use elsewhere and the only reading that includes the whole of the
 * end day. `startOfDayUtc` resolves the picked calendar day in the *reader's*
 * timezone, which is what someone triaging "the spike on the 6th" means by it.
 *
 * An empty bound is unbounded, and a row whose timestamp will not parse is kept
 * rather than dropped: a diagnostic screen hiding a record because its date is
 * malformed would suppress exactly the row worth looking at.
 */
export function withinDateRange(
  createdAt: string,
  from: string,
  to: string,
): boolean {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return true;

  const start = startOfDayUtc(from || undefined);
  if (start && at < Date.parse(start)) return false;

  const end = startOfNextDayUtc(to || undefined);
  if (end && at >= Date.parse(end)) return false;

  return true;
}

/* -------------------------------------------------------------------------- */
/* The `detail` blob                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `detail` is free-form JSONB written by whatever produced the verdict, so it
 * is read rather than validated: every field is independently recoverable and
 * the whole thing falls back to empty. A diagnostic blob that can take a screen
 * down when one of its keys changes shape is worse than no blob at all.
 *
 * Only documented keys are lifted out, and only to *display* them — the raw
 * object is still rendered verbatim underneath. Nothing here decides what the
 * app does, with the single exception the contract itself asks for: the
 * `_attribute_shifted` filter, which cannot exist without reading `reason`.
 */
const optionalText = z.string().optional().catch(undefined);
const optionalNumber = z.number().optional().catch(undefined);

const failureSchema = z
  .object({
    slot: optionalText,
    stage: optionalText,
    error_code: optionalText,
    reason: optionalText,
  })
  .catch({});

const detailSchema = z
  .object({
    // On a search verdict.
    reason: optionalText,
    adjusted_score: optionalNumber,
    gap: optionalNumber,
    agreement: optionalNumber,
    top_candidate: optionalText,
    top_k: optionalNumber,
    radius_km: optionalNumber,
    // On a rejection.
    class: optionalText,
    upstream_status: optionalNumber,
    internal_error: optionalText,
    matched_godhaar_id: optionalText,
    inference: z
      .object({ failures: z.array(failureSchema).optional().catch(undefined) })
      .optional()
      .catch(undefined),
  })
  .catch({});

export type DebugDetail = z.infer<typeof detailSchema>;
export type InferenceFailure = z.infer<typeof failureSchema>;

export function readDetail(detail: unknown): DebugDetail {
  return detailSchema.parse(detail);
}

/** True once the blob holds anything at all worth showing collapsed. */
export function hasDetail(detail: unknown): boolean {
  return (
    typeof detail === "object" &&
    detail !== null &&
    Object.keys(detail).length > 0
  );
}

/* -------------------------------------------------------------------------- */
/* Reasons                                                                     */
/* -------------------------------------------------------------------------- */

const REASON_LABELS: Record<string, string> = {
  high_score_clear_gap: "Confident, well clear of the runner-up",
  high_score_ambiguous_gap: "High score but a close runner-up",
  mid_range_score: "Between the review and match thresholds",
  below_review_threshold: "Nothing scored well enough",
  no_candidates: "No registered animal within the radius — the model never ran",
};

const ATTRIBUTE_SHIFTED = "_attribute_shifted";

/**
 * The colour/horn comparison changed the outcome — the decision itself, or
 * which animal ranked top. Matched by `includes` rather than `endsWith`
 * because that is how the contract words the filter it asks for.
 */
export function isAttributeShifted(reason: string | undefined): boolean {
  return reason?.includes(ATTRIBUTE_SHIFTED) ?? false;
}

/** The reason with any `_attribute_shifted` marker taken off. */
export function baseReason(reason: string | undefined): string | undefined {
  return reason?.replace(ATTRIBUTE_SHIFTED, "");
}

/** Plain English for a reason code, or the code itself if it is a new one. */
export function describeReason(reason: string | undefined): string | undefined {
  const base = baseReason(reason);
  if (!base) return undefined;
  return REASON_LABELS[base] ?? base;
}

/* -------------------------------------------------------------------------- */
/* Devices                                                                     */
/* -------------------------------------------------------------------------- */

export type DeviceField = { label: string; value: string | null };

/**
 * Missing values stay `null` all the way to the renderer, which prints "not
 * reported". A blank cell reads as "no device involved"; what actually
 * happened is that an older app build never sent the field.
 */
export function deviceFields(device: DebugDevice | null): DeviceField[] {
  return [
    { label: "App", value: device?.app_version ?? null },
    { label: "OS", value: device?.os_version ?? null },
    { label: "Model", value: device?.device_model ?? null },
    { label: "Make", value: device?.device_manufacturer ?? null },
  ];
}

/** How rows are bucketed on the registrations screen. */
export const deviceModel = (device: DebugDevice | null): string | null =>
  device?.device_model ?? null;

/* -------------------------------------------------------------------------- */
/* Search filters                                                              */
/* -------------------------------------------------------------------------- */

export type SearchViewFilters = {
  decision: Decision | "all";
  verified: VerifiedState | "all";
  /** Godhaar ID to narrow to, set by following a link from another row. */
  animal: string;
  /** Calendar days, inclusive of both ends. Empty means unbounded. */
  from: string;
  to: string;
};

/**
 * The unreviewed backlog. This is the screen's whole purpose, and there is a
 * partial index on the backend for exactly this query.
 *
 * Undated on purpose: the backlog is everything still unreviewed, and defaulting
 * it to today would hide the part of it that has been waiting longest.
 */
export const DEFAULT_SEARCH_FILTERS: SearchViewFilters = {
  decision: "MATCH",
  verified: "not_verified",
  animal: "",
  from: "",
  to: "",
};

export const ALL_SEARCHES: SearchViewFilters = {
  decision: "all",
  verified: "all",
  animal: "",
  from: "",
  to: "",
};

/**
 * Every filterable value is on the card, which is what keeps filtering local
 * and free. The `_attribute_shifted` view that used to live here is gone with
 * it: that marker is inside `detail.reason`, the listing no longer carries
 * `detail`, and reinstating it would mean a detail fetch per row to answer a
 * question about the set. The marker is still surfaced on each opened record.
 *
 * `animal` narrows on `godhaar_id`, so it only ever matches a `MATCH` — the
 * near miss on a `REVIEW` is likewise a detail-only field.
 */
export function matchesSearchFilters(
  row: SearchCardFields,
  filters: SearchViewFilters,
): boolean {
  if (filters.decision !== "all" && row.decision !== filters.decision) {
    return false;
  }
  if (filters.verified !== "all" && row.verified !== filters.verified) {
    return false;
  }
  if (filters.animal) {
    const needle = filters.animal.toLowerCase();
    if (!row.godhaar_id?.toLowerCase().includes(needle)) return false;
  }
  if (!withinDateRange(row.created_at, filters.from, filters.to)) return false;
  return true;
}

/** Whether two filter sets would show the same rows — used to light presets. */
export const sameFilters = (a: SearchViewFilters, b: SearchViewFilters) =>
  a.decision === b.decision &&
  a.verified === b.verified &&
  a.animal === b.animal &&
  a.from === b.from &&
  a.to === b.to;

/**
 * Only a `MATCH` asserts an identification, so only a `MATCH` can be confirmed
 * or refuted. Anything else answers 409 — a client bug, not a user error —
 * which is why this gates the controls rather than handling the failure.
 */
export const isVerifiable = (row: { decision: Decision }) =>
  row.decision === "MATCH";

/* -------------------------------------------------------------------------- */
/* Registration filters                                                        */
/* -------------------------------------------------------------------------- */

export type RegistrationViewFilters = {
  /** `undefined` for every code. */
  errorCode: string | undefined;
  /** `undefined` for every device; `null` for rows that reported no model. */
  deviceModel: string | null | undefined;
  /** Calendar days, inclusive of both ends. Empty means unbounded. */
  from: string;
  to: string;
};

export const ALL_REGISTRATIONS: RegistrationViewFilters = {
  errorCode: undefined,
  deviceModel: undefined,
  from: "",
  to: "",
};

/** True when anything is narrowing the view — drives the clear-filters button. */
export const hasRegistrationFilters = (filters: RegistrationViewFilters) =>
  filters.errorCode !== undefined ||
  filters.deviceModel !== undefined ||
  Boolean(filters.from) ||
  Boolean(filters.to);

export function matchesRegistrationFilters(
  row: {
    error_code: string;
    device: DebugDevice | null;
    created_at: string;
  },
  filters: RegistrationViewFilters,
): boolean {
  if (filters.errorCode !== undefined && row.error_code !== filters.errorCode) {
    return false;
  }
  if (
    filters.deviceModel !== undefined &&
    deviceModel(row.device) !== filters.deviceModel
  ) {
    return false;
  }
  if (!withinDateRange(row.created_at, filters.from, filters.to)) return false;
  return true;
}

/* -------------------------------------------------------------------------- */
/* Grouping                                                                    */
/* -------------------------------------------------------------------------- */

export type Bucket = { key: string | null; count: number };

/**
 * Counts by key, biggest first — the shape both "why are registrations
 * failing" questions are answered in. `null` keys survive as their own bucket:
 * "how many rows did not report a device model" is itself a finding.
 */
export function countBy<T>(rows: T[], key: (row: T) => string | null): Bucket[] {
  const counts = new Map<string | null, number>();
  for (const row of rows) {
    const value = key(row);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}
