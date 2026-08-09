import { z } from "zod";
import {
  ApiError,
  UploadInterruptedError,
  WaitAbandonedError,
  type CctvRequest,
} from "@/lib/api";
import { formatBytes } from "@/lib/format";

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
/* The file being uploaded                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 536,870,912 bytes, and a backstop rather than a working limit: a thirty-second
 * clip is a few tens of megabytes, three orders of magnitude short of this. A
 * file that hits it is almost always the wrong file.
 */
export const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

/**
 * What the API accepts. The extension is not a formality — it decides how the
 * clip is stored and how it is served back — so it is checked rather than
 * trusted to the file dialog.
 */
export const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
];

/** Filters the file dialog. Not a guarantee: anything can still be chosen. */
export const VIDEO_ACCEPT = VIDEO_EXTENSIONS.join(",");

/**
 * Containers no browser will play in a `<video>` element. They upload and
 * analyse perfectly well — the annotated result is always MP4 — but the
 * *original* clip in one of these can only be downloaded, and offering a player
 * that fails is how a working analysis gets mistaken for a broken one.
 */
const UNPLAYABLE_EXTENSIONS = [".mkv", ".avi"];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Everything the server would reject, caught before a byte is sent. The same
 * verdict from the server costs a full upload and a round trip first, which on
 * a mis-picked half-gigabyte file is minutes spent to be told no.
 *
 * Returns the reason, or `null` when the file is fine.
 */
export function validateVideoFile(file: File): string | null {
  const extension = extensionOf(file.name);
  if (!VIDEO_EXTENSIONS.includes(extension)) {
    return `${extension || "That file"} cannot be analysed. Choose an MP4, MOV, M4V, WebM, MKV or AVI.`;
  }
  // Checked here as well as on the server because an empty file is usually a
  // copy that has not finished, and saying so now saves finding out later.
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_VIDEO_BYTES) {
    return `That video is ${formatBytes(file.size)}, over the ${formatBytes(MAX_VIDEO_BYTES)} limit. Check you picked the right file.`;
  }
  return null;
}

/**
 * Read off the URL's path, since the presigned query string is not part of the
 * filename. Only the two known-unplayable containers are refused: an unfamiliar
 * or missing extension keeps the player, where `CctvVideo`'s own error handling
 * catches it, rather than sending a perfectly playable MP4 to a download link.
 */
export function isPlayableInBrowser(url: string): boolean {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // A relative or malformed URL still has a path-shaped tail worth reading.
  }
  return !UNPLAYABLE_EXTENSIONS.includes(extensionOf(pathname));
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
    hint: "The clip was corrupt or in a format the model does not accept. This is terminal for this recording — another run reads the same clip and fails the same way.",
    canRetry: false,
  },
  CCTV_VIDEO_REQUIRED: {
    title: "No video reached the server",
    hint: "Choose a video file and run the analysis again.",
    canRetry: false,
  },
  CCTV_VIDEO_TOO_LARGE: {
    // The local check normally catches this first, so arriving here means the
    // browser and the server disagree about the cap — worth saying plainly.
    title: "That video is over the size limit",
    hint: `The limit is ${formatBytes(MAX_VIDEO_BYTES)}, far more than a normal clip needs, so this usually means the wrong file was picked.`,
    canRetry: false,
  },
  CCTV_VIDEO_UNSUPPORTED_FORMAT: {
    title: "That file format is not accepted",
    hint: `Accepted formats are ${VIDEO_EXTENSIONS.join(", ")}.`,
    canRetry: false,
  },
  CCTV_VIDEO_UNREADABLE: {
    title: "The video arrived unreadable",
    hint: "The file reached the server empty or truncated, which points at the upload being cut short rather than at anything wrong with the file. Worth sending it again.",
    canRetry: true,
  },
  CCTV_RESULT_NOT_SAVED: {
    // Emphatically not "nothing happened": the model ran and the videos exist.
    title: "The analysis ran, but its result was not saved",
    hint: "The model finished and the videos were stored — only the history row failed to write, so the counts from this run are lost. Running it again is safe.",
    canRetry: true,
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

/**
 * `request_id`, so a failed run can be pointed at in the history, plus the two
 * values the upload handler sends with its rejections.
 */
const detailsSchema = z
  .object({
    request_id: z.number().optional().catch(undefined),
    max_bytes: z.number().optional().catch(undefined),
    allowed_extensions: z.array(z.string()).optional().catch(undefined),
  })
  .catch({});

type Details = z.infer<typeof detailsSchema>;

/**
 * The cap and the format list are the backend's to change, so wherever it sends
 * its own the wording above defers to them — a dashboard confidently quoting a
 * limit that moved last week is worse than one quoting no limit at all.
 */
function liveHint(code: string | null, details: Details): string | undefined {
  if (code === "CCTV_VIDEO_TOO_LARGE" && details.max_bytes !== undefined) {
    return `The limit is ${formatBytes(details.max_bytes)}, far more than a normal clip needs, so this usually means the wrong file was picked.`;
  }
  if (
    code === "CCTV_VIDEO_UNSUPPORTED_FORMAT" &&
    details.allowed_extensions?.length
  ) {
    return `Accepted formats are ${details.allowed_extensions.join(", ")}.`;
  }
  return undefined;
}

export function describeCctvFailure(error: unknown): CctvFailure {
  // Nothing was analysed and nothing was recorded, because the request never
  // arrived whole. The only CCTV failure where retrying is straightforwardly
  // the right advice.
  if (error instanceof UploadInterruptedError) {
    return {
      code: null,
      title: "The upload did not finish",
      hint: "The video never reached the server, so no analysis was started and nothing was recorded. Try again.",
      canRetry: true,
      message: error.message,
    };
  }

  // A deliberate walk-away, not a fault. The run carries on regardless — the
  // only thing that stopped was this page listening for the answer.
  if (error instanceof WaitAbandonedError) {
    return {
      code: null,
      title: "You stopped waiting",
      hint: "The analysis is still running on the server and will finish on its own. Refresh the history in a minute to see how it went.",
      canRetry: false,
      message: error.message,
    };
  }

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

  const details = detailsSchema.parse(error.details);
  const advice = error.code ? (ADVICE[error.code] ?? GENERIC) : GENERIC;

  return {
    code: error.code,
    ...advice,
    hint: liveHint(error.code, details) ?? advice.hint,
    message: error.message,
    requestId: details.request_id,
  };
}
