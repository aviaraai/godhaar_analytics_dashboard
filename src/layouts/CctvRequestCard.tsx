import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CctvRequest } from "@/lib/api";
import { displayStatus, hasCountAnomaly } from "@/lib/cctv";
import { formatCount, formatDuration, formatTimestamp } from "@/lib/format";
import CctvVideo from "./CctvVideo";

type CctvRequestCardProps = {
  row: CctvRequest;
  onRefresh: () => void;
  /** The run just started from this screen, rather than one read from history. */
  fresh?: boolean;
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
}: CctvRequestCardProps) {
  const status = displayStatus(row);
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
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner role="presentation" aria-label={undefined} />
          Still running.
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

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Requested {formatTimestamp(row.requested_at)}</span>
        {row.completed_at && (
          <span>Finished {formatTimestamp(row.completed_at)}</span>
        )}
        <Elapsed row={row} />
        {row.requested_by_email && <span>by {row.requested_by_email}</span>}
      </footer>
    </article>
  );
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
 * Both numbers, always, each labelled with what it measures. They are two
 * different measurements and not a measurement plus a correction: peak-in-frame
 * undercounts a camera panning across a herd, and tracked-distinct overcounts a
 * static one whenever the tracker re-acquires an animal as a new ID. The
 * backend does not know which kind of camera it was looking at, so the
 * judgement is left to whoever is reading.
 */
function Counts({ row }: { row: CctvRequest }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Count
          label="Cattle in view (peak)"
          value={row.cattle_in_view}
          hint="Most animals visible in any single frame. The honest number for a fixed camera."
        />
        <Count
          label="Cattle observed (tracked)"
          value={row.cattle_observed}
          hint="Distinct animals the tracker followed. The honest number for a panning camera."
        />
      </div>
      {hasCountAnomaly(row) && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          Fewer animals tracked than were visible at once, which should not
          happen — treat this as a tracking anomaly rather than a display error.
        </p>
      )}
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
      <CctvVideo url={url} onRefresh={onRefresh} />
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
