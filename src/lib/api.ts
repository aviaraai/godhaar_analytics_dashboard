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

/**
 * The verdict on a response, given its status and whatever body came with it —
 * `null` when there is nothing wrong with it.
 *
 * Split out because two transports reach the same API: `fetch` for everything
 * ordinary, and `XMLHttpRequest` for the one call that needs upload progress.
 * What a 401 means, and when a 502 is the API talking rather than a proxy
 * talking over it, must not depend on which of the two was used.
 */
function refusalFor(status: number, data: unknown): Error | null {
  const problem = problemFrom(data);

  // Both classes carry a sensible default, so pass the server's wording only
  // when there is some â€” `new UnauthorizedError(undefined)` keeps the default.
  if (status === 401) return new UnauthorizedError(problem.message);
  if (status === 403) return new ForbiddenError(problem.message);

  // A backend that is down behind a proxy does not fail the connection: Caddy
  // and Vite's dev proxy both answer for it with a gateway status and a body
  // that is not our JSON. Same situation as a transport failure from the user's
  // side, so say the same thing rather than "something went wrong".
  //
  // Checked *after* the body, and only when there is no body of ours, because
  // these three statuses are also real answers: the CCTV handlers use 502, 503
  // and 504 for a version mismatch, an unreachable model and a timeout, and
  // swallowing those would hide the codes the dashboard has to branch on.
  const spokenFor = problem.message !== undefined || problem.code !== undefined;
  if (!spokenFor && [502, 503, 504].includes(status)) {
    return new Error("Could not reach the server. It may be down or restarting.");
  }

  if (status >= 200 && status < 300) return null;

  // Shown verbatim in the error dialog, with no prefix of ours. Echo's
  // messages already describe themselves, and prepending one turned the
  // handlers' own "server error" into "Server error, server error".
  return new ApiError(
    problem.message ?? "Something went wrong. Please try again.",
    status,
    problem.code ?? null,
    problem.details,
  );
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
      // Unset for ordinary calls: `fetch` imposes no deadline of its own, which
      // is what `/cctv/analyse` needs — it blocks for the length of the
      // analysis, and any default short enough for a normal request would
      // abandon a run that is still going to complete.
      signal:
        timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs),
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
  const refusal = refusalFor(response.status, data);
  if (refusal) throw refusal;

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
    // The breed name verbatim, matched against the column. Sent only when one
    // is picked — the loop below drops empty values, which is what keeps
    // "no breed filter" distinct from "breed is the empty string".
    breed: filters.breed,
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
  // Presigned, 15 minutes, and an empty string when signing that one photo
  // failed — never null and never absent. A goshala without a usable photo is
  // still selectable, so this never removes a row.
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
  // Both null unless the run succeeded. Two independent measurements, and
  // explicitly *not* a subset and its total: `total_clear_animals` is not
  // bounded by `total_animals`, because a clip panning across a herd can track
  // more distinct animals than were ever in one frame at once. Nothing may
  // render them as a pair or derive a percentage from them.
  total_animals: cctvNullableNumber,
  total_clear_animals: cctvNullableNumber,
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
 *
 * Three fields come back zero-valued here and must not be rendered from this
 * response: `requested_by_email` is `""`, `requested_at` is `0001-01-01`, and
 * `completed_at` is null even on success. `getCctvRequests` is authoritative
 * for all three — hence `fromAnalyse` on the card.
 *
 * ⚠️ The API's own `WriteTimeout` is two minutes, well under the thirty the
 * analysis is allowed. Any clip taking longer has its connection cut server-side
 * *even though the run completes and is recorded*, so a transport failure here
 * means "read the history", never "it failed". `describeCctvFailure` says so.
 *
 * The camera is not wired up in every environment — where it is not, this
 * answers `503 CCTV_SOURCE_UNAVAILABLE` and `analyseGoshalaVideo` is the way
 * in. The two produce the same run, the same history row and the same response.
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

/* -------------------------------------------------------------------------- */
/* CCTV analysis from an uploaded clip                                         */
/* -------------------------------------------------------------------------- */

/**
 * The two halves of the wait, which are nothing alike: the first is bytes
 * leaving this machine and can be measured, the second is the model working and
 * cannot. Reporting them as one number would mean a bar sitting at 100% for
 * most of the wait, which reads as a hang.
 */
export type UploadProgress =
  | { phase: "uploading"; percent: number | null }
  | { phase: "analysing" };

/**
 * The connection failed while the file was still going up, so the server never
 * received a whole request: nothing ran, and nothing was recorded.
 *
 * Worth its own class because it is the one CCTV failure where "try again" is
 * plainly right. Losing the connection *after* the upload finished means the
 * opposite — the analysis is underway and a retry would start a second one.
 */
export class UploadInterruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadInterruptedError";
  }
}

/**
 * The admin pressed "Stop waiting". Nothing here can stop the server: the run
 * continues, finishes and lands in the history, which is why this is reported
 * as a wait that ended rather than as an analysis that failed.
 */
export class WaitAbandonedError extends Error {
  constructor() {
    super("You stopped waiting. The analysis is still running on the server.");
    this.name = "WaitAbandonedError";
  }
}

/**
 * How long the upload may go without a single byte being acknowledged before it
 * is treated as dead. Deliberately a measure of *silence* rather than of total
 * time — a large file on a slow link is slow, not broken, and a plain deadline
 * would punish exactly the uploads that need the most patience.
 */
const UPLOAD_STALL_MS = 2 * 60 * 1000;

/**
 * The ceiling on the second half, from the moment the last byte is sent.
 *
 * Analysis runs at roughly 0.75× the clip's length, so the normal thirty-second
 * clip answers in about twenty seconds and this is six minutes of slack. It is
 * far below the server's own thirty-minute ceiling on purpose: nothing that
 * reaches that is healthy, and the API cuts the connection at two minutes
 * regardless, so waiting half an hour would only ever be waiting for nothing.
 */
const UPLOAD_ANALYSE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * A 413 can be rejected at the transport layer, before the handler that would
 * have attached `CCTV_VIDEO_TOO_LARGE` is ever reached — arriving as a bare
 * `{"message": "Request Entity Too Large"}`, or with no body at all. On this
 * endpoint the status alone is unambiguous, so the code is filled in here and
 * every reader downstream branches on the code like any other failure.
 */
function withSizeCode(error: Error): Error {
  if (error instanceof ApiError && error.status === 413 && error.code === null) {
    return new ApiError(
      "That video is over the size limit.",
      413,
      "CCTV_VIDEO_TOO_LARGE",
      error.details,
    );
  }
  return error;
}

type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  /** Stops this side waiting. It does not stop the analysis. */
  signal?: AbortSignal;
};

/**
 * `XMLHttpRequest` rather than `fetch`, for the one thing `fetch` cannot do:
 * report how much of the request body has gone out. Everything else about the
 * response — the token, the status codes, the error shape — is handed back to
 * `refusalFor` so this path and the ordinary one cannot disagree.
 */
async function postVideo(
  path: string,
  form: FormData,
  { onProgress, signal }: UploadOptions,
): Promise<unknown> {
  // Read per request rather than per session, exactly as `request` does: the
  // SDK rotates the access token roughly hourly.
  const token = await accessToken();
  if (!token) throw new UnauthorizedError();

  return new Promise<unknown>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new WaitAbandonedError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_ROOT}${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // No `Content-Type`: `multipart/form-data` carries a boundary that only the
    // browser knows, and setting the header by hand strips it and makes the
    // body unparseable — which surfaces as a baffling 400.

    // Set only where the abort is ours, so `onabort` can say which of the three
    // reasons it was instead of reporting a bare cancellation.
    let abortedBecause: "stall" | "timeout" | "abandoned" | null = null;
    let uploaded = false;
    let timer: number | undefined;

    const arm = (ms: number, reason: "stall" | "timeout") => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        abortedBecause = reason;
        xhr.abort();
      }, ms);
    };

    const abandon = () => {
      abortedBecause = "abandoned";
      xhr.abort();
    };
    signal?.addEventListener("abort", abandon);

    xhr.upload.onprogress = (event) => {
      // Re-armed on every chunk: the deadline measures a connection that has
      // stopped moving, not a link that is merely slow.
      arm(UPLOAD_STALL_MS, "stall");
      onProgress?.({
        phase: "uploading",
        percent: event.lengthComputable
          ? Math.round((event.loaded / event.total) * 100)
          : null,
      });
    };

    xhr.upload.onload = () => {
      // The bar has nowhere left to go; everything after this is the model, and
      // the deadline changes from "is the link alive" to "is the run alive".
      uploaded = true;
      onProgress?.({ phase: "analysing" });
      arm(UPLOAD_ANALYSE_TIMEOUT_MS, "timeout");
    };

    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText) as unknown;
      } catch {
        // A proxy answering for the API sends HTML, and a request refused at
        // the transport layer may send nothing at all. `refusalFor` reads the
        // status in that case, which is the whole of what those two say.
      }
      const refusal = refusalFor(xhr.status, data);
      if (refusal) reject(withSizeCode(refusal));
      else resolve(data);
    };

    // A dropped connection means two different things either side of the last
    // byte, and this is the only place that still knows which side it was on.
    xhr.onerror = () =>
      reject(
        uploaded
          ? new Error(
              "The connection to the server was lost while the analysis was running.",
            )
          : new UploadInterruptedError(
              "The connection dropped while the video was uploading.",
            ),
      );

    xhr.onabort = () => {
      if (abortedBecause === "abandoned") {
        reject(new WaitAbandonedError());
      } else if (abortedBecause === "timeout") {
        reject(
          new Error(
            "Gave up waiting for the server to answer. The analysis may still be running — check the history before starting it again.",
          ),
        );
      } else {
        reject(
          new UploadInterruptedError(
            "The upload stopped part-way and made no further progress.",
          ),
        );
      }
    };

    xhr.onloadend = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abandon);
    };

    arm(UPLOAD_STALL_MS, "stall");
    xhr.send(form);
  });
}

/**
 * Runs the model over a clip the admin picked, rather than one pulled off the
 * goshala's camera. Same analysis, same history, same response as
 * `analyseGoshala` — only the way it is started differs, and the response does
 * not record which way that was.
 *
 * The goshala is still required with no camera involved: it is what the run is
 * filed against and what the history filters by. Footage belongs to the goshala
 * it was recorded at, so the file is picked per goshala and never reused across
 * them.
 *
 * Blocks for the upload *and* the whole analysis, and the three zero-valued
 * fields called out on `analyseGoshala` are zero-valued here too.
 */
export async function analyseGoshalaVideo(
  { goshalaPublicId, file }: { goshalaPublicId: string; file: File },
  options: UploadOptions = {},
): Promise<CctvRequest> {
  const form = new FormData();
  form.append("goshala_public_id", goshalaPublicId);
  form.append("video", file);

  return parse(
    cctvRequestSchema,
    await postVideo("/cctv/analyse/upload", form, options),
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
 * A stored photo. `slot` is `front` or `muzzle` on anything the app captured;
 * a registered animal can also have `left` and `right`. An object key the
 * backend could not read degrades to `{slot: "unknown", sequence: 0}` rather
 * than failing the request, so neither field is a closed set here.
 */
const debugImageSchema = z.object({
  slot: z.string(),
  sequence: z.number(),
  url: z.string(),
});

export type DebugImage = z.infer<typeof debugImageSchema>;

/**
 * Resolved by join at read time rather than copied into the debug row, so it
 * always reflects the animal now.
 *
 * Identity and photos, and deliberately nothing else: breed, age, owner and
 * location say nothing about whether the model was right, and the photos side
 * by side are what settles that. `deleted` means the id no longer resolves —
 * `images` is empty in that case, and the id is still shown because the record
 * stands as evidence of what the model said.
 *
 * Which slots arrive depends on what the verdict was decided on: all four from
 * a search, `front` and `muzzle` only from a refused registration. Read `slot`
 * rather than counting. An animal registered without photos is also empty, so
 * `deleted` is the only thing that tells those two cases apart.
 */
const matchedAnimalSchema = z.object({
  godhaar_id: z.string(),
  images: z.array(debugImageSchema),
  deleted: z.boolean(),
  // Whether the model asserted this animal (MATCH) or merely ranked it first
  // without claiming it (REVIEW). Both come with photos, because a reviewer
  // needs them either way — but they are not the same statement. Defaulted to
  // true so an older server, which only ever sent claimed matches, keeps
  // reading correctly.
  claimed: z.boolean().nullish().transform((v) => v ?? true),
});

export type MatchedAnimal = z.infer<typeof matchedAnimalSchema>;

/**
 * The closed vocabulary shared by refused registrations and `FAILED` searches,
 * enforced by a database `CHECK` and an allowlist in the inference client.
 *
 * Exported for grouping and filter chips, but *not* parsed as an enum: a
 * diagnostic screen that refuses to render because one row carries a code added
 * last week is worse than one showing the code raw.
 */
export const IDENTIFICATION_ERROR_CODES = [
  "DUPLICATE_ANIMAL",
  "NO_ANIMAL_DETECTED",
  "POOR_IMAGE_QUALITY",
  "IMAGE_TOO_BLURRY",
  "IMAGE_BAD_EXPOSURE",
  "IMAGE_TOO_SMALL",
  "IMAGE_UNREADABLE",
  "BODY_COLOR_INCONSISTENT",
  "MUZZLE_COLOR_INCONSISTENT",
] as const;

export const DECISIONS = ["MATCH", "REVIEW", "UNKNOWN", "FAILED"] as const;
export const VERIFIED_STATES = ["yes", "no", "not_verified"] as const;

export type Decision = (typeof DECISIONS)[number];
export type VerifiedState = (typeof VERIFIED_STATES)[number];

/**
 * Both listings are split from their detail views, and the split is the point:
 * a card carries one thumbnail, while a detail carries every photo, the matched
 * animal's photos and the decision working. Loading a hundred cards must not
 * pay for a hundred galleries — so the listing deliberately cannot render one,
 * and the card types below have no `images` or `detail` to reach for.
 *
 * The four `decision` values and the three `verified` values are enum columns
 * with DB constraints behind them, so they are parsed as closed sets — an
 * unrecognised one is a contract change worth failing loudly on, not a string
 * to render raw.
 */
const searchCardSchema = z.object({
  search_id: z.string(),
  decision: z.enum(DECISIONS),
  verified: z.enum(VERIFIED_STATES),
  // Null only on FAILED, where the model never produced a verdict. This is the
  // model's own similarity score, unmodified; the internally-adjusted value
  // used for ranking lives in the detail view and is deliberately not here.
  score: nullableNumber,
  // FAILED only.
  error_code: nullableString,
  // MATCH only — the one decision that CLAIMS an animal. A REVIEW's top
  // candidate is deliberately not here; it arrives on the detail view.
  godhaar_id: nullableString,
  // Whether this row can be given a human verdict: a MATCH, or a REVIEW that
  // ranked a candidate. Server-computed with the same predicate that guards the
  // update, so a button rendered from this cannot answer 409. Never re-derive
  // it from `decision` — a REVIEW's candidate lives in `detail`, which the
  // listing does not carry. Defaulted for older servers that omit the field.
  verifiable: z.boolean().nullish().transform((v) => v ?? false),
  // The first captured photo. Null when the record kept no images.
  thumbnail_url: nullableString,
  device: nullableDevice,
  created_by_email: nullableString,
  created_at: z.string(),
});

const searchCardsSchema = z.array(searchCardSchema);

export type DebugSearchCardData = z.infer<typeof searchCardSchema>;

/** The card's fields minus the thumbnail, plus everything it deliberately omits. */
const searchDetailSchema = searchCardSchema
  .omit({ thumbnail_url: true })
  .extend({
    images: z.array(debugImageSchema),
    // The animal this search landed on, with its stored photos, so they can be
    // shown beside the query's — which is the only way a human can answer
    // "same animal?". Present on a MATCH (claimed) and on a REVIEW that ranked
    // a candidate (NOT claimed — read `claimed` to tell them apart, and never
    // render a REVIEW's candidate as though the model asserted it). Null on
    // UNKNOWN and FAILED, which name no animal at all.
    matched_animal: matchedAnimalSchema
      .nullish()
      .transform((value) => value ?? null),
    detail: detailSchema,
  });

export type DebugSearchDetail = z.infer<typeof searchDetailSchema>;

/**
 * Every search attempt, successful or not — successes included because a
 * confident match on the wrong animal is indistinguishable from a correct one
 * without a human looking at both sets of photos.
 *
 * Unpaginated and newest first, on the backend's own assurance that these
 * tables stay small. The filters on the screen are applied in memory for the
 * same reason: the endpoint takes no query parameters at all.
 */
export async function getDebugSearches(): Promise<DebugSearchCardData[]> {
  return parse(searchCardsSchema, await request("/debug/searches"));
}

/** The photos and the decision working, fetched only when a card is opened. */
export async function getDebugSearch(
  searchId: string,
): Promise<DebugSearchDetail> {
  return parse(
    searchDetailSchema,
    await request(`/debug/searches/${encodeURIComponent(searchId)}`),
  );
}

const registrationCardSchema = z.object({
  registration_id: z.string(),
  error_code: z.string(),
  // The first captured photo, always a front shot. Null when the record kept no
  // images — the upload can fail without sinking the capture itself.
  thumbnail_url: nullableString,
  device: nullableDevice,
  created_by_email: nullableString,
  created_at: z.string(),
});

const registrationCardsSchema = z.array(registrationCardSchema);

export type DebugRegistrationCardData = z.infer<typeof registrationCardSchema>;

const registrationDetailSchema = registrationCardSchema
  .omit({ thumbnail_url: true })
  .extend({
    // Only `front` and `muzzle` ever appear. Left and right photos are validated
    // but never stored for a refused registration: the upload step runs after
    // inference succeeds, which by definition it did not.
    images: z.array(debugImageSchema),
    // The animal this capture was refused in favour of, on a `DUPLICATE_ANIMAL`
    // and nothing else — no other verdict is a claim about *which* animal this
    // is. Null even on a duplicate when the FAISS id the inference server named
    // is not in the candidate set this server sent, so it cannot be mapped back
    // to a godhaar id.
    //
    // `front` and `muzzle` only, unlike a search: those are the two slots a
    // duplicate is decided on, and the animal's side photos are deliberately
    // withheld rather than invite a reviewer to weigh evidence the model was
    // never shown.
    matched_animal: matchedAnimalSchema
      .nullish()
      .transform((value) => value ?? null),
    detail: detailSchema,
  });

export type DebugRegistrationDetail = z.infer<typeof registrationDetailSchema>;

/**
 * Registrations the model refused. Successful ones are absent because they are
 * already recorded as real animals, and network failures and version mismatches
 * are absent because the photos played no part in them — so a gap here during
 * an outage is expected rather than a bug.
 */
export async function getDebugRegistrations(): Promise<
  DebugRegistrationCardData[]
> {
  return parse(registrationCardsSchema, await request("/debug/registrations"));
}

export async function getDebugRegistration(
  registrationId: string,
): Promise<DebugRegistrationDetail> {
  return parse(
    registrationDetailSchema,
    await request(`/debug/registrations/${encodeURIComponent(registrationId)}`),
  );
}

/**
 * Records a human's verdict on a match, and answers with the full detail shape
 * so the card that was just acted on can be replaced without a refetch.
 *
 * Freely reversible in every direction — a reviewer revising a call is normal.
 * Only a `MATCH` can be verified at all; anything else answers 409, which is
 * why the controls are rendered on nothing else.
 */
export async function verifySearch(
  searchId: string,
  verified: VerifiedState,
): Promise<DebugSearchDetail> {
  return parse(
    searchDetailSchema,
    await request(`/debug/searches/${encodeURIComponent(searchId)}/verify`, {
      method: "PATCH",
      body: { verified },
    }),
  );
}
