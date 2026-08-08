import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, RotateCwIcon, TriangleAlertIcon, VideoIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  analyseGoshala,
  getCctvRequests,
  getGoshalas,
  UnauthorizedError,
} from "@/lib/api";
import { describeCctvFailure, type CctvFailure } from "@/lib/cctv";
import CctvProgress from "./CctvProgress";
import CctvRequestCard from "./CctvRequestCard";
import GoshalaPicker from "./GoshalaPicker";
import LoadingSpinner from "./LoadingSpinner";

const GOSHALAS_KEY = "cctv-goshalas";
const REQUESTS_KEY = "cctv-requests";

/**
 * Pick a goshala, run the model over its camera feed, read the history back.
 *
 * The analysis is one blocking call rather than a job id to poll — the server
 * holds the request open until the model answers — so there is no polling here
 * and `CctvProgress` stands in for the wait. Thirty minutes is the server's own
 * ceiling; past that `displayStatus` reports the row as interrupted rather than
 * running, which is why an abandoned run never shows a live spinner.
 */
export default function CctvPanel() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const goshalas = useQuery({
    queryKey: [GOSHALAS_KEY],
    queryFn: getGoshalas,
    // The list is small and barely moves; the photos in it are presigned for
    // fifteen minutes, so this stops short of that to avoid serving dead URLs.
    staleTime: 10 * 60 * 1000,
  });

  // Scoped to the selection once there is one. Before that it is every run ever
  // made, which is the right thing to land on: the most common reason to open
  // this tab is to check whether something already ran.
  const history = useQuery({
    queryKey: [REQUESTS_KEY, selected],
    queryFn: () => getCctvRequests(selected ?? undefined),
  });

  const analyse = useMutation({
    mutationFn: analyseGoshala,
    // Settled, not success: a run that failed is still a row in the history,
    // and the failure card points at it by id.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [REQUESTS_KEY] });
    },
  });

  const selectedGoshala =
    goshalas.data?.find((goshala) => goshala.public_id === selected) ?? null;

  const rows = history.data ?? [];
  const freshId = analyse.data?.request_id ?? null;
  // The invalidation above normally brings the new row back in the history, so
  // rendering `analyse.data` unconditionally would show it twice. Marking the
  // matching row instead keeps one card and one source of truth.
  const historyHasFresh =
    freshId !== null && rows.some((row) => row.request_id === freshId);

  // Expiry is already handled globally by flipping to the login screen; a
  // failure card about it on the way out is noise.
  const failure: CctvFailure | null =
    analyse.isError && !(analyse.error instanceof UnauthorizedError)
      ? describeCctvFailure(analyse.error)
      : null;

  function refreshHistory() {
    void queryClient.invalidateQueries({ queryKey: [REQUESTS_KEY] });
  }

  return (
    <>
      <GoshalaPicker
        goshalas={goshalas.data ?? []}
        selected={selected}
        onSelect={(publicId) => {
          setSelected(publicId);
          // The previous run's outcome belongs to the previous goshala.
          analyse.reset();
        }}
        disabled={analyse.isPending}
        isPending={goshalas.isPending}
        isError={goshalas.isError}
        errorMessage={goshalas.error?.message}
        onRetry={() => void goshalas.refetch()}
      />

      <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-sm font-medium">Camera analysis</h2>
          <p className="text-xs text-muted-foreground">
            {selectedGoshala
              ? `Ready to analyse ${selectedGoshala.name}.`
              : "Choose a goshala above to enable this."}
          </p>
        </div>
        <Button
          type="button"
          className="ml-auto"
          disabled={!selected || analyse.isPending}
          onClick={() => {
            if (selected) analyse.mutate(selected);
          }}
        >
          <VideoIcon data-icon="inline-start" />
          {analyse.isPending ? "Analysing…" : "Run analysis"}
        </Button>
      </section>

      {analyse.isPending && selectedGoshala && (
        <CctvProgress goshalaName={selectedGoshala.name} />
      )}

      {failure && (
        <FailureCard
          failure={failure}
          onRetry={
            selected && failure.canRetry
              ? () => analyse.mutate(selected)
              : undefined
          }
        />
      )}

      {analyse.data && !historyHasFresh && (
        <CctvRequestCard
          row={analyse.data}
          onRefresh={refreshHistory}
          fresh
          fromAnalyse
        />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-medium">
            {selectedGoshala ? `History · ${selectedGoshala.name}` : "History"}
          </h2>
          <div className="flex items-center gap-2">
            {history.isFetching && <LoadingSpinner label="Loading history…" />}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshHistory}
              disabled={history.isFetching}
            >
              <RotateCwIcon data-icon="inline-start" />
              Refresh
            </Button>
          </div>
        </div>

        {history.isError ? (
          <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {history.error instanceof UnauthorizedError
              ? "Your session has expired."
              : (history.error?.message ?? "The history could not be loaded.")}
          </p>
        ) : history.isPending ? (
          <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Loading history…
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {selectedGoshala
              ? "No analysis has been run for this goshala yet."
              : "No analysis has been run yet."}
          </p>
        ) : (
          rows.map((row) => (
            <CctvRequestCard
              key={row.request_id}
              row={row}
              onRefresh={refreshHistory}
              fresh={row.request_id === freshId}
            />
          ))
        )}
      </section>
    </>
  );
}

/**
 * A dropped connection is not a failure and must not be dressed as one: the API
 * cuts the socket at two minutes while the analysis is allowed thirty, so the
 * run is very likely still going and already recorded. That case arrives with
 * no `code`, which is what separates the calm presentation from the red one.
 */
function FailureCard({
  failure,
  onRetry,
}: {
  failure: CctvFailure;
  onRetry?: () => void;
}) {
  const dropped = failure.code === null;
  const Icon = dropped ? InfoIcon : TriangleAlertIcon;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <Icon
          className={
            dropped
              ? "mt-0.5 size-4 shrink-0 text-muted-foreground"
              : "mt-0.5 size-4 shrink-0 text-destructive"
          }
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-sm font-medium">{failure.title}</h3>
          <p className="text-sm text-muted-foreground">{failure.message}</p>
          {failure.hint && (
            <p className="text-xs text-muted-foreground">{failure.hint}</p>
          )}
          {failure.requestId !== undefined && (
            <p className="text-xs text-muted-foreground">
              Recorded in the history as #{failure.requestId}.
            </p>
          )}
        </div>
      </div>
      {onRetry && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}
