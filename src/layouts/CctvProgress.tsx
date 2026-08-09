import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { UploadProgress } from "@/lib/api";
import { formatDuration } from "@/lib/format";

type CctvProgressProps = {
  goshalaName: string;
  /**
   * `null` for a camera pull, which has no upload phase to report, and for the
   * moment before the first progress event of an upload.
   */
  progress: UploadProgress | null;
  /** Offered only where there is something to abort — the upload path. */
  onStopWaiting?: () => void;
};

/**
 * The wait, shown as honestly as it can be.
 *
 * Only the first half of an upload is measurable. Once the last byte is sent
 * the model takes over, and there is no percentage to report — the job model is
 * deliberately hidden behind a single blocking call, so nothing knows how far
 * along it is. A bar left sitting at 100% for that half would read as a hang,
 * which is why it is replaced by a spinner rather than pinned full.
 *
 * The elapsed counter is what stands in: it says nothing about how much is
 * left, but it does say the wait is still alive, which is the question anyone
 * staring at a spinner is actually asking.
 *
 * Mounted only while the request is in flight, so mounting is the start time.
 */
export default function CctvProgress({
  goshalaName,
  progress,
  onStopWaiting,
}: CctvProgressProps) {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed(Date.now() - startedAt),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const uploading = progress?.phase === "uploading";

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-10 text-center"
    >
      {uploading ? (
        <UploadBar percent={progress.percent} />
      ) : (
        <Spinner role="presentation" aria-label={undefined} className="size-6" />
      )}

      <p className="text-sm font-medium">
        {uploading ? "Uploading to" : "Analysing"} {goshalaName} ·{" "}
        {formatDuration(elapsed)}
      </p>

      <p className="max-w-md text-sm text-balance text-muted-foreground">
        {uploading
          ? "Sending the clip. The analysis starts once the whole file has arrived."
          : progress
            ? "The model is counting the animals and drawing the annotated video. This takes roughly as long as the clip itself."
            : "The server pulls the clip from the camera, runs the model over it and stores the annotated video before it answers."}
      </p>

      <p className="max-w-md text-xs text-balance text-muted-foreground">
        {uploading
          ? "Nothing is recorded until the upload finishes, so stopping now leaves no trace."
          : "The analysis is already recorded, so it will appear in the history below even if you close this page."}
      </p>

      {onStopWaiting && (
        // Two different acts under one control. Before the last byte is sent,
        // stopping genuinely cancels — the server has no whole request yet.
        // After it, nothing here can reach the run: it finishes either way and
        // lands in the history, so the button only ends the waiting and must
        // not claim otherwise.
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onStopWaiting}
        >
          {uploading ? "Cancel upload" : "Stop waiting"}
        </Button>
      )}
    </section>
  );
}

/**
 * Determinate when the browser knows the body's length, which it does for a
 * `FormData` built from a real file, and indeterminate when it does not —
 * rather than a bar that guesses.
 */
function UploadBar({ percent }: { percent: number | null }) {
  return (
    <div
      role="progressbar"
      aria-label="Upload progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-valuetext={percent === null ? "Uploading" : `${percent}%`}
      className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted"
    >
      <div
        className={
          percent === null
            ? "h-full w-1/3 animate-pulse rounded-full bg-primary"
            : "h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        }
        style={percent === null ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
