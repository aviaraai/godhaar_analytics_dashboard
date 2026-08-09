import { DownloadIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CctvRequest, CctvStatus } from "@/lib/api";
import { displayStatus, isPlayableInBrowser } from "@/lib/cctv";
import { formatCount, formatDuration, formatTimestamp } from "@/lib/format";
import CctvVideo from "./CctvVideo";

type CctvRequestCardProps = {
  row: CctvRequest;
  onRefresh: () => void;
  /** The run just started from this screen, rather than one read from history. */
  fresh?: boolean;
  /**
   * This row came straight back from `POST /analyse`, which leaves
   * `requested_at`, `completed_at` and `requested_by_email` zero-valued. The
   * footer is suppressed rather than rendering a 1st-of-January-year-1 stamp;
   * the same run gains all three once the history refetch lands.
   */
  fromAnalyse?: boolean;
};

/**
 * One analysis, whether it has just finished or is being read back out of the
 * history — the two are the same object on the wire, so they get the same
 * renderer and cannot drift apart.
 */
export default function CctvRequestCard({
  row,
  onRefresh,
  fresh,
  fromAnalyse,
}: CctvRequestCardProps) {
  const now = useNowWhileRunning(row.status);
  const status = displayStatus(row, now);
  const place = [
    row.goshala.village,
    row.goshala.mandal,
    row.goshala.district,
    row.goshala.state,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-heading text-sm font-medium">
            {row.goshala.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {place || "Location not recorded"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {fresh && <Badge variant="secondary">just run</Badge>}
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground">
            #{row.request_id}
          </span>
        </div>
      </header>

      {status === "succeeded" && <Counts row={row} />}

      {status === "failed" && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Did not finish</span>
          {row.error_code && (
            <Badge variant="destructive" className="font-mono">
              {row.error_code}
            </Badge>
          )}
        </p>
      )}

      {status === "running" && (
        // Elapsed rather than a bare "running": inside the thirty-minute window
        // a dead run and a live one are genuinely indistinguishable from here,
        // and how long it has been going is the only thing that helps a reader
        // judge which they are looking at.
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner role="presentation" aria-label={undefined} />
          Still running
          {Number.isFinite(Date.parse(row.requested_at)) &&
            ` · ${formatDuration(now - Date.parse(row.requested_at))}`}
        </p>
      )}

      {status === "interrupted" && (
        // `running` past the server's own ceiling means nobody is coming back
        // for it: there is no reaper, so the row would spin forever otherwise.
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          Interrupted — this run was never finished, and no result will arrive
          for it now.
        </p>
      )}

      {row.annotated_video_url && (
        <Videos row={row} onRefresh={onRefresh} />
      )}

      {!fromAnalyse && (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Requested {formatTimestamp(row.requested_at)}</span>
          {row.completed_at && (
            <span>Finished {formatTimestamp(row.completed_at)}</span>
          )}
          <Elapsed row={row} />
          {row.requested_by_email && <span>by {row.requested_by_email}</span>}
        </footer>
      )}
    </article>
  );
}

/**
 * A clock, but only for the rows whose meaning changes with it.
 *
 * `displayStatus` turns a stale `running` row into `interrupted` once it passes
 * the server's thirty-minute ceiling, and it reads the current time to do it —
 * so without something re-rendering, that reclassification never happens and a
 * dead run shows a live spinner for as long as the page stays open. Everything
 * terminal is already final, so it does not tick and this returns a constant.
 *
 * Deliberately *not* a refetch: pulling the history again would mint a fresh set
 * of presigned URLs every minute and reload any video on screen. The row cannot
 * change on the server anyway — nothing sweeps stranded rows up — so the only
 * thing that needs to move is this side's reading of the clock.
 */
function useNowWhileRunning(status: CctvStatus): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  return now;
}

function StatusBadge({ status }: { status: ReturnType<typeof displayStatus> }) {
  if (status === "succeeded") return <Badge variant="success">succeeded</Badge>;
  if (status === "failed") return <Badge variant="destructive">failed</Badge>;
  if (status === "interrupted") {
    return <Badge variant="warning">interrupted</Badge>;
  }
  return <Badge variant="muted">running</Badge>;
}

/**
 * Both numbers, always, each labelled with what it measures — and deliberately
 * side by side rather than as a total and its subset. `total_clear_animals` is
 * *not* bounded by `total_animals`: they are measured differently, and a clip
 * panning across a herd legitimately tracks more distinct animals than were
 * ever in one frame at once. So there is no anomaly to flag when the second
 * exceeds the first, and no percentage that would mean anything.
 */
function Counts({ row }: { row: CctvRequest }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      <Count
        label="Animals detected"
        value={row.total_animals}
        hint="Every animal the model observed, clear or not — the peak count in any single frame."
      />
      <Count
        label="Clearly tracked"
        value={row.total_clear_animals}
        hint="The close-by animals seen clearly enough to follow as distinct individuals."
      />
    </div>
  );
}

function Count({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string;
}) {
  return (
    <div className="flex max-w-64 flex-col gap-0.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-heading text-2xl font-semibold tabular-nums">
        {value === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatCount(value)
        )}
      </span>
      <span className="text-xs text-balance text-muted-foreground">{hint}</span>
    </div>
  );
}

/** The annotated clip is the deliverable; the raw one is the before to its after. */
function Videos({
  row,
  onRefresh,
}: {
  row: CctvRequest;
  onRefresh: () => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const url =
    showSource && row.source_video_url
      ? row.source_video_url
      : row.annotated_video_url;

  if (!url) return null;

  // An uploaded MKV or AVI is stored and served under its own extension, and no
  // browser will play either. The annotated clip is always MP4, so this only
  // ever affects the original — and it has to be caught by extension, because
  // handing it to `<video>` fails the same way an expired link does and would
  // be reported as one.
  const playable = isPlayableInBrowser(url);

  return (
    <div className="flex flex-col gap-2">
      {/* `source_video_url` can be null even on success, so the toggle only
          exists when there is something to toggle to. */}
      {row.source_video_url && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant={showSource ? "outline" : "default"}
            onClick={() => setShowSource(false)}
          >
            Annotated
          </Button>
          <Button
            type="button"
            size="xs"
            variant={showSource ? "default" : "outline"}
            onClick={() => setShowSource(true)}
          >
            Original
          </Button>
        </div>
      )}
      {playable ? (
        <CctvVideo url={url} onRefresh={onRefresh} />
      ) : (
        <DownloadOnly url={url} />
      )}
    </div>
  );
}

/**
 * A container the browser cannot play. Not a failure — the clip analysed fine
 * and the annotated version above plays — so this offers the file rather than
 * an error.
 *
 * The link is presigned and short-lived, which is worth saying: an admin who
 * leaves the tab open and comes back to it will find it dead, and knowing that
 * is what sends them to Refresh instead of reporting a broken download.
 */
function DownloadOnly({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
      <DownloadIcon className="size-5 text-muted-foreground" />
      <p className="max-w-md text-sm text-balance text-muted-foreground">
        This is an MKV or AVI recording, which no browser will play. The
        annotated version above plays normally.
      </p>
      <Button
        variant="outline"
        size="sm"
        render={<a href={url} target="_blank" rel="noreferrer" />}
      >
        <DownloadIcon data-icon="inline-start" />
        Download the original
      </Button>
      <p className="text-xs text-muted-foreground">
        The link works for about fifteen minutes.
      </p>
    </div>
  );
}

function Elapsed({ row }: { row: CctvRequest }) {
  if (!row.completed_at) return null;
  const started = Date.parse(row.requested_at);
  const finished = Date.parse(row.completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(finished)) return null;
  return <span>took {formatDuration(finished - started)}</span>;
}
