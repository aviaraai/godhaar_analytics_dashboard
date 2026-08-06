import { z } from "zod";
import { accessToken } from "@/lib/session";
import type { LegacyFilters, SearchFilters } from "@/lib/types";

const API_ROOT = "/api/web/v1";

/**
 * No token, or the backend rejected it. Handled centrally in `main.tsx` by
 * signing out, which drops the app back to the login screen â€” so callers
 * rarely need to catch this themselves.
 */
export class UnauthorizedError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Authenticated, but the account is not an admin. */
export class ForbiddenError extends Error {
  constructor(message = "This account is not authorized to use the dashboard.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Any other refused request. Carries the machine-readable `code` as well as the
 * status, because that is what callers are meant to branch on — the wording of
 * `message` is for people and is free to change. `code` is null when the
 * backend did not send one, and an unrecognised code must degrade to a generic
 * failure rather than fall through a switch.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    details: unknown = undefined,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Read leniently, field by field: an error body is the last thing that should
 * fail to parse, and a missing `code` on one handler must not cost us the
 * `message` on the same response.
 */
const errorSchema = z
  .object({
    message: z.string().optional().catch(undefined),
    code: z.string().optional().catch(undefined),
    details: z.unknown().optional(),
  })
  .catch({});

/** Not every response carries JSON â€” 204s and proxy-level errors don't. */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid response from server");
  return parsed.data;
}

/** The backend's own wording and code, so a refusal can explain itself. */
function problemFrom(data: unknown) {
  return errorSchema.parse(data);
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  /** Serialised as JSON. Omit it and no request body or content type is sent. */
  body?: unknown;
  /**
   * Abort after this long. Left unset for ordinary calls, where the browser's
   * own limits are the right ones; set only where a request is expected to run
   * for minutes and needs an explicit ceiling well above the server's.
   */
  timeoutMs?: number;
};

/**
 * Single door to the backend, so the bearer token, the auth status codes and
 * the error message shape are decided in exactly one place.
 */
async function request(
  path: string,
  { method = "GET", body, timeoutMs }: RequestOptions = {},
): Promise<unknown> {
  // Read per request rather than per session: the SDK rotates the access token
  // roughly hourly, and a captured one would start failing mid-session.
  const token = await accessToken();
  if (!token) throw new UnauthorizedError();

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined
          ? undefined
          : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // Our own ceiling rather than the network's, so it deserves its own words:
    // the work is probably still running on the server, which makes "try again"
    // exactly the wrong advice.
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(
        "Gave up waiting for the server to answer. The work may still be running — check the history before starting it again.",
      );
    }
    // fetch only rejects on transport failure â€” a 500 still resolves.
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const data = await readBody(response);
  const problem = problemFrom(data);

  // Both classes carry a sensible default, so pass the server's wording only
  // when there is some â€” `new UnauthorizedError(undefined)` keeps the default.
  if (response.status === 401) throw new UnauthorizedError(problem.message);
  if (response.status === 403) throw new ForbiddenError(problem.message);

  // A backend that is down behind a proxy does not fail the connection: Caddy
  // and Vite's dev proxy both answer for it with a gateway status and a body
  // that is not our JSON. Same situation as the transport branch above from the
  // user's side, so say the same thing rather than "something went wrong".
  //
  // Checked *after* the body, and only when there is no body of ours, because
  // these three statuses are also real answers: the CCTV handlers use 502, 503
  // and 504 for a version mismatch, an unreachable model and a timeout, and
  // swallowing those would hide the codes the dashboard has to branch on.
  const spokenFor = problem.message !== undefined || problem.code !== undefined;
  if (!spokenFor && [502, 503, 504].includes(response.status)) {
    throw new Error("Could not reach the server. It may be down or restarting.");
  }

  if (!response.ok) {
    // Shown verbatim in the error dialog, with no prefix of ours. Echo's
    // messages already describe themselves, and prepending one turned the
    // handlers' own "server error" into "Server error, server error".
    throw new ApiError(
      problem.message ?? "Something went wrong. Please try again.",
      response.status,
      problem.code ?? null,
      problem.details,
    );
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

const analyticsSchemaRow = z.object({
  user_email: z.string(),
  total_farmers: z.number(),
  total_animals: z.number(),
  total_assigned: z.number(),
  total_unassigned: z.number(),
});

const analyticsSchema = z.array(analyticsSchemaRow);

export type AnalyticsResult = z.infer<typeof analyticsSchema>;

export async function getAnalytics(
  filters: SearchFilters,
): Promise<AnalyticsResult> {
  const searchParams = new URLSearchParams();
  const params: Record<string, string | undefined> = {
    state: filters.state,
    district: filters.district,
    mandal: filters.mandal,
    from_date: filters.fromDate,
    to_date: filters.toDate,
  };
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();

  return parse(
    analyticsSchema,
    await request(`/analytics${query ? `?${query}` : ""}`),
  );
}

const totalsSchema = z.object({
  total_farmers: z.number(),
  total_animals: z.number(),
});

export type AnalyticsTotals = z.infer<typeof totalsSchema>;

/**
 * Whole-dataset counts, deliberately unfiltered. Separate from `getAnalytics`
 * so it stays two `COUNT(*)`s rather than the grouped join, and so its cache,
 * loading state and failures are independent of whatever the table is doing.
 */
export async function getTotals(): Promise<AnalyticsTotals> {
  return parse(totalsSchema, await request("/analytics/totals"));
}

/* -------------------------------------------------------------------------- */
/* Legacy analytics                                                            */
/* -------------------------------------------------------------------------- */

const legacyRowSchema = z.object({
  state: z.string(),
  district: z.string(),
  mandal: z.string(),
  farmer_count: z.number(),
  animal_count: z.number(),
});

const legacySchema = z.array(legacyRowSchema);

export type LegacyRow = z.infer<typeof legacyRowSchema>;
export type LegacyResult = z.infer<typeof legacySchema>;

/**
 * Pre-aggregated counts carried over from the old database, one flat row per
 * mandal. Deliberately unlike `getAnalytics`: no date range (the source rows
 * have no timestamps), names instead of ids, and 23 rows in the whole table â€”
 * so there is nothing to paginate and the totals are summed on the client.
 *
 * Arrives sorted by animals desc, then farmers desc, then mandal asc. The table
 * renders it in the order given rather than re-sorting.
 */
export async function getLegacyAnalytics(
  filters: LegacyFilters,
): Promise<LegacyResult> {
  const searchParams = new URLSearchParams();
  for (const key of ["state", "district", "mandal"] as const) {
    const value = filters[key];
    if (value) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();

  return parse(
    legacySchema,
    await request(`/analytics/legacy${query ? `?${query}` : ""}`),
  );
}

/* -------------------------------------------------------------------------- */
/* CCTV analysis                                                               */
/* -------------------------------------------------------------------------- */

const cctvNullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const cctvNullableNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null);

const goshalaSchema = z.object({
  // What `/cctv/analyse` takes. The numeric id is internal and never exposed.
  public_id: z.string(),
  name: z.string(),
  village: cctvNullableString,
  mandal: cctvNullableString,
  district: cctvNullableString,
  state: cctvNullableString,
  latitude: cctvNullableNumber,
  longitude: cctvNullableNumber,
  // Presigned, 15 minutes, and an empty string when signing failed. A goshala
  // without a usable photo is still selectable, so this never removes a row.
  photo_url: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
});

const goshalasSchema = z.array(goshalaSchema);

export type Goshala = z.infer<typeof goshalaSchema>;

/** Farmers whose type is `goshala`, sorted by name. */
export async function getGoshalas(): Promise<Goshala[]> {
  return parse(goshalasSchema, await request("/cctv/goshalas"));
}

export const CCTV_STATUSES = ["succeeded", "failed", "running"] as const;

export type CctvStatus = (typeof CCTV_STATUSES)[number];

const cctvRequestSchema = z.object({
  request_id: z.number(),
  status: z.enum(CCTV_STATUSES),
  goshala: z.object({
    public_id: z.string(),
    name: z.string(),
    village: cctvNullableString,
    mandal: cctvNullableString,
    district: cctvNullableString,
    state: cctvNullableString,
  }),
  // Both null unless the run succeeded. Two different measurements rather than
  // one measurement and a correction — see `lib/cctv.ts`.
  cattle_in_view: cctvNullableNumber,
  cattle_observed: cctvNullableNumber,
  // The deliverable: boxes and per-animal IDs drawn on every frame. Presigned,
  // 15 minutes. `source_video_url` is the untouched clip and may be null even
  // on success; the annotated one being absent would itself be a failure.
  annotated_video_url: cctvNullableString,
  source_video_url: cctvNullableString,
  error_code: cctvNullableString,
  requested_by_email: cctvNullableString,
  requested_at: z.string(),
  completed_at: cctvNullableString,
});

const cctvRequestsSchema = z.array(cctvRequestSchema);

export type CctvRequest = z.infer<typeof cctvRequestSchema>;

/**
 * Comfortably past the thirty minutes the server waits for the model, so the
 * server's own `CCTV_TIMEOUT` — which says something useful — wins the race
 * against our abort, which cannot say anything except that we stopped
 * listening. This exists to stop a wedged connection hanging forever, not to
 * impose a deadline of our own.
 */
export const ANALYSE_TIMEOUT_MS = 35 * 60 * 1000;

/**
 * Pulls a clip from the goshala's camera, runs the model over it, stores both
 * videos and answers — **blocking for the whole analysis**, which is minutes.
 * There is no job id to poll and no progress to report: the job model is
 * deliberately hidden behind this one call.
 *
 * Every call is a real camera pull, a real model run and two video uploads, so
 * the caller is responsible for making a second press impossible while one is
 * in flight.
 */
export async function analyseGoshala(
  goshalaPublicId: string,
): Promise<CctvRequest> {
  return parse(
    cctvRequestSchema,
    await request("/cctv/analyse", {
      method: "POST",
      body: { goshala_public_id: goshalaPublicId },
      timeoutMs: ANALYSE_TIMEOUT_MS,
    }),
  );
}

/**
 * Every attempt ever made, newest first, optionally for one goshala. Same
 * object as `analyseGoshala` returns, so one renderer serves both — and since
 * the row is written when the button is pressed, a run that died is in here
 * too rather than vanishing.
 */
export async function getCctvRequests(
  goshalaPublicId?: string,
): Promise<CctvRequest[]> {
  const query = goshalaPublicId
    ? `?goshala_public_id=${encodeURIComponent(goshalaPublicId)}`
    : "";
  return parse(cctvRequestsSchema, await request(`/cctv/requests${query}`));
}

/* -------------------------------------------------------------------------- */
/* Identification debug                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `null` for absent, never `undefined`, so rendering has one case to handle
 * rather than two. `nullish` on the way in because a Go handler that omits a
 * key and one that sends `null` mean the same thing here.
 */
const nullableString = z.string().nullish().transform((value) => value ?? null);
const nullableNumber = z.number().nullish().transform((value) => value ?? null);

/** Every field is nullable — older app builds do not send them. */
const deviceSchema = z.object({
  app_version: nullableString,
  os_version: nullableString,
  device_model: nullableString,
  device_manufacturer: nullableString,
});

const nullableDevice = deviceSchema
  .nullish()
  .transform((value) => value ?? null);

export type DebugDevice = z.infer<typeof deviceSchema>;

/**
 * Free-form JSONB, so it is carried untyped and read defensively at the point
 * of display (see `lib/debug.ts`). Validating it here would let one unexpected
 * value in one row take down the whole listing, which is the opposite of what
 * a diagnostic blob is for.
 */
const detailSchema = z.unknown();

/**
 * Resolved by join at read time rather than copied into the debug row, so it
 * always reflects the animal now. On `deleted` only `godhaar_id` survives —
 * hence every other field being nullable.
 */
const matchedAnimalSchema = z.object({
  godhaar_id: z.string(),
  animal_type: nullableString,
  breed: nullableString,
  gender: nullableString,
  age: nullableNumber,
  body_color: nullableString,
  muzzle_color: nullableString,
  horn_shape: nullableString,
  village: nullableString,
  mandal: nullableString,
  district: nullableString,
  state: nullableString,
  image_url: nullableString,
  deleted: z.boolean(),
});

export type MatchedAnimal = z.infer<typeof matchedAnimalSchema>;

export const DECISIONS = ["MATCH", "REVIEW", "UNKNOWN", "FAILED"] as const;
export const VERIFIED_STATES = ["yes", "no", "not_verified"] as const;

export type Decision = (typeof DECISIONS)[number];
export type VerifiedState = (typeof VERIFIED_STATES)[number];

/**
 * The four `decision` values and the three `verified` values are enum columns
 * with DB constraints behind them, so they are parsed as closed sets — an
 * unrecognised one is a contract change worth failing loudly on, not a string
 * to render raw.
 */
const searchSchema = z.object({
  id: z.number(),
  decision: z.enum(DECISIONS),
  // Null only on FAILED, where the model never produced a verdict.
  score: nullableNumber,
  // Set only on FAILED. Same vocabulary as the mobile API, so it stays a string.
  error_code: nullableString,
  verified: z.enum(VERIFIED_STATES),
  // Null on everything but MATCH: a scored near-miss is not a claim about an
  // animal, so the contract refuses to present it as one.
  matched_animal: matchedAnimalSchema
    .nullish()
    .transform((value) => value ?? null),
  image_urls: z.array(z.string()),
  detail: detailSchema,
  device: nullableDevice,
  created_by: nullableString,
  created_at: z.string(),
});

const searchesSchema = z.array(searchSchema);

export type DebugSearch = z.infer<typeof searchSchema>;

/**
 * Every search attempt, successful or not — successes included because a
 * confident match on the wrong animal is indistinguishable from a correct one
 * without a human looking at both sets of photos.
 *
 * Unpaginated and newest first, on the backend's own assurance that these
 * tables stay small. The filters on the screen are applied in memory for the
 * same reason: the endpoint takes no query parameters.
 */
export async function getDebugSearches(): Promise<DebugSearch[]> {
  return parse(searchesSchema, await request("/debug/searches"));
}

const registrationSchema = z.object({
  id: z.number(),
  error_code: z.string(),
  // Empty when the upload itself failed. The row is still written, because the
  // failure record matters more than its images.
  image_urls: z.array(z.string()),
  detail: detailSchema,
  device: nullableDevice,
  created_by: nullableString,
  created_at: z.string(),
});

const registrationsSchema = z.array(registrationSchema);

export type DebugRegistration = z.infer<typeof registrationSchema>;

/**
 * Registrations the model refused. Successful ones are absent because they are
 * already recorded as real animals, and network failures and version mismatches
 * are absent because the photos played no part in them — so a gap here during
 * an outage is expected rather than a bug.
 */
export async function getDebugRegistrations(): Promise<DebugRegistration[]> {
  return parse(registrationsSchema, await request("/debug/registrations"));
}

/**
 * Records a human's verdict on a match, and returns the whole updated record.
 *
 * Freely reversible in both directions — a reviewer revising a call is normal.
 * Only a `MATCH` can be verified at all; anything else answers 409, which is
 * why the controls are rendered on nothing else.
 */
export async function verifySearch(
  id: number,
  verified: VerifiedState,
): Promise<DebugSearch> {
  return parse(
    searchSchema,
    await request(`/debug/searches/${id}/verify`, {
      method: "PATCH",
      body: { verified },
    }),
  );
}
