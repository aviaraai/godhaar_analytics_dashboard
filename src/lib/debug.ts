import { z } from "zod";
import {
  type DebugDevice,
  type DebugSearch,
  type Decision,
  type VerifiedState,
} from "@/lib/api";

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
  /** Only rows whose `reason` carries the `_attribute_shifted` marker. */
  attributeShifted: boolean;
  /** Godhaar ID to narrow to, set by following a link from another row. */
  animal: string;
};

/**
 * The unreviewed backlog. This is the screen's whole purpose, and there is a
 * partial index on the backend for exactly this query.
 */
export const DEFAULT_SEARCH_FILTERS: SearchViewFilters = {
  decision: "MATCH",
  verified: "not_verified",
  attributeShifted: false,
  animal: "",
};

export const ALL_SEARCHES: SearchViewFilters = {
  decision: "all",
  verified: "all",
  attributeShifted: false,
  animal: "",
};

/**
 * The correlation the contract calls the most actionable thing here: a run of
 * attribute-shifted decisions that reviewers then marked wrong is direct
 * evidence the colour or horn classifier has drifted.
 */
export const ATTRIBUTE_DRIFT: SearchViewFilters = {
  decision: "all",
  verified: "no",
  attributeShifted: true,
  animal: "",
};

export function matchesSearchFilters(
  row: DebugSearch,
  filters: SearchViewFilters,
): boolean {
  if (filters.decision !== "all" && row.decision !== filters.decision) {
    return false;
  }
  if (filters.verified !== "all" && row.verified !== filters.verified) {
    return false;
  }
  if (
    filters.attributeShifted &&
    !isAttributeShifted(readDetail(row.detail).reason)
  ) {
    return false;
  }
  if (filters.animal) {
    const detail = readDetail(row.detail);
    const ids = [
      row.matched_animal?.godhaar_id,
      detail.top_candidate,
      detail.matched_godhaar_id,
    ];
    const needle = filters.animal.toLowerCase();
    if (!ids.some((id) => id?.toLowerCase().includes(needle))) return false;
  }
  return true;
}

/** Whether two filter sets would show the same rows — used to light presets. */
export const sameFilters = (a: SearchViewFilters, b: SearchViewFilters) =>
  a.decision === b.decision &&
  a.verified === b.verified &&
  a.attributeShifted === b.attributeShifted &&
  a.animal === b.animal;

/**
 * Only a `MATCH` asserts an identification, so only a `MATCH` can be confirmed
 * or refuted. Anything else answers 409 — a client bug, not a user error —
 * which is why this gates the controls rather than handling the failure.
 */
export const isVerifiable = (row: DebugSearch) => row.decision === "MATCH";

/* -------------------------------------------------------------------------- */
/* Registration filters                                                        */
/* -------------------------------------------------------------------------- */

export type RegistrationViewFilters = {
  /** `undefined` for every code. */
  errorCode: string | undefined;
  /** `undefined` for every device; `null` for rows that reported no model. */
  deviceModel: string | null | undefined;
};

export const ALL_REGISTRATIONS: RegistrationViewFilters = {
  errorCode: undefined,
  deviceModel: undefined,
};

export function matchesRegistrationFilters(
  row: { error_code: string; device: DebugDevice | null },
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
