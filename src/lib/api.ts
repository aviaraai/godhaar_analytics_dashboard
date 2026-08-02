import { z } from "zod";
import { accessToken } from "@/lib/session";
import type { SearchFilters } from "@/lib/types";

const API_ROOT = "/api/web/v1";

/**
 * No token, or the backend rejected it. Handled centrally in `main.tsx` by
 * signing out, which drops the app back to the login screen — so callers
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

const errorSchema = z.object({ message: z.string() });

/** Not every response carries JSON — 204s and proxy-level errors don't. */
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

/** The backend's own wording when it sent one, so 401/403 can explain itself. */
function messageFrom(data: unknown): string | undefined {
  const parsed = errorSchema.safeParse(data);
  return parsed.success ? parsed.data.message : undefined;
}

/**
 * Single door to the backend, so the bearer token, the auth status codes and
 * the error message shape are decided in exactly one place.
 */
async function request(path: string): Promise<unknown> {
  // Read per request rather than per session: the SDK rotates the access token
  // roughly hourly, and a captured one would start failing mid-session.
  const token = await accessToken();
  if (!token) throw new UnauthorizedError();

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // fetch only rejects on transport failure — a 500 still resolves.
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  // A backend that is down behind a proxy does not fail the connection: Caddy
  // and Vite's dev proxy both answer for it with a gateway status and a body
  // that is not our JSON. Same situation as the branch above from the user's
  // side, so say the same thing rather than "something went wrong".
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new Error("Could not reach the server. It may be down or restarting.");
  }

  const data = await readBody(response);

  // Both classes carry a sensible default, so pass the server's wording only
  // when there is some — `new UnauthorizedError(undefined)` keeps the default.
  if (response.status === 401) throw new UnauthorizedError(messageFrom(data));
  if (response.status === 403) throw new ForbiddenError(messageFrom(data));

  if (!response.ok) {
    // Shown verbatim in the error dialog, with no prefix of ours. Echo's
    // messages already describe themselves, and prepending one turned the
    // handlers' own "server error" into "Server error, server error".
    throw new Error(messageFrom(data) ?? "Something went wrong. Please try again.");
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

const analyticsSchemaRow = z.object({
  user_id: z.string(),
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
