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
    title: "Camera not reachable right now",
    hint: "No clip could be pulled from this goshala's camera — it is offline, unreachable, or has nothing recorded. Worth trying again.",
    canRetry: true,
  },
  CCTV_ANALYSIS_FAILED: {
    title: "The model rejected the recording",
    hint: "The clip was corrupt or in a format the model does not accept. This is terminal for this recording — another run pulls the same clip and fails the same way.",
    canRetry: false,
  },
  CCTV_STORAGE_FAILED: {
    title: "A file could not be stored",
    hint: "Our storage failed part-way through — nothing you did caused it, and nothing about this goshala makes it more likely. Try again.",
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
    title: "The analysis service lost track of the job",
    // Two very different causes share this one code: a genuine version mismatch
    // between the API and the inference server, and — far more often — the
    // analysis service restarting mid-run, which drops the job from its
    // in-memory table. Retry is offered because the second case is both common
    // and fixed by simply running it again; if it is really a mismatch, the
    // retry fails identically and the message below is what remains.
    hint: "The analysis service most likely restarted while this was running. Running it again usually works — if it does not, the two services disagree about their contract and the team needs to look.",
    canRetry: true,
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
  // Not an `ApiError` means no verdict ever arrived: the transport failed, our
  // own abort fired, or — much more likely — the API's two-minute `WriteTimeout`
  // cut the connection on an analysis still legitimately running. The row was
  // opened before any work started and every exit path writes a terminal status,
  // so the outcome is in the history whatever happened here. Offering "try
  // again" would start a second camera pull competing with a run that is
  // probably about to succeed, which is why this one cannot be retried.
  if (!(error instanceof ApiError)) {
    return {
      code: null,
      title: "Lost contact while the analysis was running",
      hint: "The connection dropped, but the run itself is recorded and most likely still finishing. Refresh the history in a minute rather than starting another analysis.",
      canRetry: false,
      message:
        error instanceof Error
          ? error.message
          : "The connection to the server was lost.",
    };
  }

  return {
    code: error.code,
    ...(error.code ? (ADVICE[error.code] ?? GENERIC) : GENERIC),
    message: error.message,
    requestId: detailsSchema.parse(error.details).request_id,
  };
}
