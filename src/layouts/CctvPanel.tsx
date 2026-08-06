import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { analyseGoshala, getCctvRequests, getGoshalas, type CctvRequest } from "@/lib/api";
import { describeCctvFailure, type CctvFailure } from "@/lib/cctv";
import { cn } from "@/lib/utils";
import CctvProgress from "./CctvProgress";
import CctvRequestCard from "./CctvRequestCard";
import GoshalaPicker from "./GoshalaPicker";
import LoadingSpinner from "./LoadingSpinner";

const GOSHALAS_KEY = "cctv-goshalas";
const REQUESTS_KEY = "cctv-requests";

/**
 * The one CCTV screen. Pick a goshala, press the button, wait — the request
 * blocks for the whole analysis, which is minutes — then see both the fresh
 * result and every attempt ever made.
 *
 * `POST /cctv/analyse` currently answers `CCTV_SOURCE_UNAVAILABLE` on every
 * call: the camera integration is a deliberate blank, not a bug. That failure
 * is shown as the calm, expected state it is rather than as a red error —
 * everything else here (the goshala list, the run, the history) is real.
 */
export default function CctvPanel() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  // The result of the run just made from this screen, kept apart from history
  // so it can be shown labelled "just run" even before the history refetch
  // that follows it lands.
  const [fresh, setFresh] = useState<CctvRequest | null>(null);

  const goshalas = useQuery({
    queryKey: [GOSHALAS_KEY],
    queryFn: getGoshalas,
    staleTime: 5 * 60 * 1000,
  });

  const requests = useQuery({
    queryKey: [REQUESTS_KEY],
    queryFn: () => getCctvRequests(),
    // The rows carry 15-minute presigned video URLs, so a cached listing must
    // not outlive its own links.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const analyse = useMutation({
    mutationFn: analyseGoshala,
    onSuccess: setFresh,
    // A row is written the moment the button is pressed, so even a failed or
    // timed-out attempt belongs in the history — settled covers every outcome.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: [REQUESTS_KEY] }),
  });

  const selectedGoshala = goshalas.data?.find((g) => g.public_id === selected) ?? null;
  const failure = analyse.isError ? describeCctvFailure(analyse.error) : null;

  function handleRun() {
    if (!selected || analyse.isPending) return;
    setFresh(null);
    analyse.mutate(selected);
  }

  const history = (requests.data ?? []).filter(
    (row) => row.request_id !== fresh?.request_id,
  );

  return (
    <div className="flex flex-col gap-6">
      <GoshalaPicker
        goshalas={goshalas.data ?? []}
        selected={selected}
        onSelect={(id) => {
          setSelected(id);
          setFresh(null);
          analyse.reset();
        }}
        disabled={analyse.isPending}
        isPending={goshalas.isPending}
        isError={goshalas.isError}
        errorMessage={goshalas.isError ? goshalas.error.message : undefined}
        onRetry={() => void goshalas.refetch()}
      />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {selectedGoshala ? (
            <>
              Ready to analyse{" "}
              <span className="font-medium text-foreground">
                {selectedGoshala.name}
              </span>
              .
            </>
          ) : (
            "Choose a goshala above, then run the camera analysis."
          )}
        </p>
        {/* Every press is a real camera pull, model run and two video
            uploads — disabled while one is in flight so a double-click
            cannot start a second one. */}
        <Button
          type="button"
          onClick={handleRun}
          disabled={!selected || analyse.isPending}
        >
          <PlayIcon data-icon="inline-start" />
          {analyse.isPending ? "Analysing…" : "Run analysis"}
        </Button>
      </section>

      {analyse.isPending && selectedGoshala && (
        <CctvProgress goshalaName={selectedGoshala.name} />
      )}

      {failure && (
        <CctvFailurePanel
          failure={failure}
          onRetry={handleRun}
          onDismiss={() => analyse.reset()}
        />
      )}

      {fresh && !analyse.isPending && (
        <CctvRequestCard
          row={fresh}
          onRefresh={() => void requests.refetch()}
          fresh
        />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-medium">History</h2>
          <div className="flex items-center gap-3">
            {requests.isFetching && !requests.isPending && (
              <LoadingSpinner label="Refreshing…" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void requests.refetch()}
              disabled={requests.isFetching}
            >
              <RotateCwIcon data-icon="inline-start" />
              {requests.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {requests.isError ? (
          <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
            {requests.error.message}
          </p>
        ) : requests.isPending ? (
          <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
            Loading history…
          </p>
        ) : history.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
            No analyses have been run yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {history.map((row) => (
              <li key={row.request_id}>
                <CctvRequestCard
                  row={row}
                  onRefresh={() => void requests.refetch()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * `CCTV_SOURCE_UNAVAILABLE` gets the muted treatment — it is the expected
 * state until the camera integration lands, not a fault in this dashboard.
 * Everything else keeps the destructive styling an unexpected failure earns.
 */
function CctvFailurePanel({
  failure,
  onRetry,
  onDismiss,
}: {
  failure: CctvFailure;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        failure.expected
          ? "border-border bg-muted/40"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlertIcon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            failure.expected ? "text-muted-foreground" : "text-destructive",
          )}
        />
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-sm font-medium">{failure.title}</h3>
          <p className="text-sm text-muted-foreground">{failure.message}</p>
          {failure.hint && (
            <p className="text-xs text-balance text-muted-foreground">
              {failure.hint}
            </p>
          )}
          {failure.requestId && (
            <p className="text-xs text-muted-foreground">
              Recorded as request #{failure.requestId} in the history below.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Never wired to fire on its own — a press is the only thing that
            calls this. See the contract: retrying `CCTV_TIMEOUT` automatically
            would start a second analysis on a machine already busy with the
            first. */}
        {failure.canRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}
