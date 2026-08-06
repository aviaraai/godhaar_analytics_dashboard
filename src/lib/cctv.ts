import { z } from "zod";
import { ApiError, type CctvRequest } from "@/lib/api";

/**
 * A row is written the moment the button is pressed, so an attempt is recorded
 * even when it never finishes — which is the point, a run that died is exactly
 * what history should show. The consequence is that a server killed mid-analysis
 * leaves its row `running` forever, and nothing sweeps them up.
 *
 * So past the server's own thirty-minute ceiling, `running` stops meaning "in
 * progress" and starts meaning "abandoned". Showing a live spinner for a job
 * that will never report back is the one thing this must not do.
 */
export const ABANDONED_AFTER_MS = 30 * 60 * 1000;

export type CctvDisplayStatus = "succeeded" | "failed" | "running" | "interrupted";

export function displayStatus(
  row: CctvRequest,
  now: number = Date.now(),
): CctvDisplayStatus {
  if (row.status !== "running") return row.status;
  const started = Date.parse(row.requested_at);
  if (!Number.isFinite(started)) return "running";
  return now - started > ABANDONED_AFTER_MS ? "interrupted" : "running";
}

/**
 * `cattle_observed` counts distinct animals the tracker followed and is
 * normally at least `cattle_in_view`, the most visible in any one frame. When
 * it is smaller the tracker has done something odd — which is worth saying out
 * loud rather than quietly rendering two numbers that disagree.
 */
export function hasCountAnomaly(row: CctvRequest): boolean {
  return (
    row.cattle_in_view !== null &&
    row.cattle_observed !== null &&
    row.cattle_observed < row.cattle_in_view
  );
}

/* -------------------------------------------------------------------------- */
/* Failures                                                                    */
/* -------------------------------------------------------------------------- */

export type CctvFailure = {
  code: string | null;
  title: string;
  /** The backend's own wording, which is written for the person reading it. */
  message: string;
  hint?: string;
  /** Whether to offer a retry button at all. Never an automatic one. */
  canRetry: boolean;
  /** The history row this failure was recorded as, when there is one. */
  requestId?: number;
  /** Expected for now rather than broken — presented calmly, not in red. */
  expected?: boolean;
};

type Advice = Omit<CctvFailure, "code" | "message" | "requestId">;

/**
 * Branching happens on `code` and never on `message`: the wording is free to
 * change and is not a contract. Anything not listed here — including codes
 * added after this was written — falls through to the generic case, which is
 * why the lookup is a table rather than a switch with a default that lies.
 */
const ADVICE: Record<string, Advice> = {
  GOSHALA_REQUIRED: {
    title: "No goshala was sent",
    hint: "That is a bug in this dashboard rather than anything you did.",
    canRetry: false,
  },
  GOSHALA_NOT_FOUND: {
    title: "That goshala no longer exists",
    hint: "It may have been removed, or it is no longer marked as a goshala. Refresh the list and choose again.",
    canRetry: false,
  },
  CCTV_SOURCE_UNAVAILABLE: {
    title: "Camera integration is not live yet",
    hint: "Everything else on this tab is real — the goshala list and the history come from the live database. Analysis will start working when the camera integration lands, with no change needed here.",
    canRetry: false,
    expected: true,
  },
  CCTV_ANALYSIS_FAILED: {
    title: "The model rejected the recording",
    hint: "The clip was corrupt or in a format the model does not accept. Running it again is unlikely to help.",
    canRetry: true,
  },
  CCTV_TIMEOUT: {
    title: "Analysis ran past thirty minutes",
    hint: "The server stopped waiting, but the job is most likely still running. Check the history before starting another — a second analysis competes with the first for the same machine, which makes a timeout more likely, not less.",
    canRetry: true,
  },
  INFERENCE_UNAVAILABLE: {
    title: "The model server could not be reached",
    hint: "Try again in a few minutes.",
    canRetry: true,
  },
  INFERENCE_INTERNAL: {
    title: "The model server errored",
    hint: "Try again in a few minutes.",
    canRetry: true,
  },
  INFERENCE_CONTRACT: {
    title: "Our services disagree about their contract",
    hint: "A version mismatch between the API and the inference server. The team is already alerted and retrying will not help.",
    canRetry: false,
  },
};

const GENERIC: Advice = {
  title: "The analysis could not be completed",
  canRetry: true,
};

/** `details.request_id`, so a failed run can be pointed at in the history. */
const detailsSchema = z
  .object({ request_id: z.number().optional().catch(undefined) })
  .catch({});

export function describeCctvFailure(error: unknown): CctvFailure {
  if (!(error instanceof ApiError)) {
    return {
      code: null,
      ...GENERIC,
      message:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    };
  }

  return {
    code: error.code,
    ...(error.code ? (ADVICE[error.code] ?? GENERIC) : GENERIC),
    message: error.message,
    requestId: detailsSchema.parse(error.details).request_id,
  };
}
