import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  analyseGoshala,
  analyseGoshalaVideo,
  getCctvRequests,
  getGoshalas,
  UnauthorizedError,
  type UploadProgress,
} from "@/lib/api";
import {
  describeCctvFailure,
  validateVideoFile,
  type CctvFailure,
} from "@/lib/cctv";
import CctvProgress from "./CctvProgress";
import CctvRequestCard from "./CctvRequestCard";
import CctvUpload from "./CctvUpload";
import GoshalaPicker from "./GoshalaPicker";
import LoadingSpinner from "./LoadingSpinner";

const GOSHALAS_KEY = "cctv-goshalas";
const REQUESTS_KEY = "cctv-requests";

/**
 * Which of the two ways in a run was started. The distinction lives only on
 * this side: both endpoints do the same analysis, write the same history row
 * and answer with the same object, and the response does not say which was
 * used — so nothing downstream of the mutation needs to know.
 */
type AnalyseInput =
  | { source: "camera"; goshalaPublicId: string }
  | { source: "upload"; goshalaPublicId: string; file: File };

/**
 * Pick a goshala, run the model over a clip from it, read the history back.
 *
 * Upload is the way in that works everywhere; the camera is offered second
 * because it is not wired up in every environment. Either way the analysis is
 * one blocking call rather than a job id to poll — the server holds the request
 * open until the model answers — so there is no polling here and `CctvProgress`
 * stands in for the wait. Thirty minutes is the server's own ceiling; past that
 * `displayStatus` reports the row as interrupted rather than running, which is
 * why an abandoned run never shows a live spinner.
 */
export default function CctvPanel() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  // The clip belongs to the goshala it was recorded at, so it is held beside
  // the selection and dropped whenever that changes. There is no house clip
  // that stands in for every goshala.
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const abort = useRef<AbortController | null>(null);

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
    mutationFn: (input: AnalyseInput) => {
      if (input.source === "camera") return analyseGoshala(input.goshalaPublicId);
      const controller = new AbortController();
      abort.current = controller;
      return analyseGoshalaVideo(input, {
        onProgress: setProgress,
        signal: controller.signal,
      });
    },
    // Seeded rather than left null so the first paint of an upload is already a
    // bar: `null` is what tells `CctvProgress` there is no upload phase at all,
    // and the first progress event can be a second or more away on a big file.
    onMutate: (input) => {
      setProgress(
        input.source === "upload" ? { phase: "uploading", percent: null } : null,
      );
    },
    // A clip that has been analysed should not sit in the input still armed —
    // a stray second press is another full upload and another history row.
    onSuccess: () => setFile(null),
    // Settled, not success: a run that failed is still a row in the history,
    // and the failure card points at it by id.
    onSettled: () => {
      abort.current = null;
      void queryClient.invalidateQueries({ queryKey: [REQUESTS_KEY] });
    },
  });

  function pickFile(next: File | null) {
    setFile(next);
    setFileError(next ? validateVideoFile(next) : null);
    // The previous attempt's verdict was about the previous clip. Only an error
    // is cleared: a result worth reading stays on screen while the next file is
    // chosen.
    if (analyse.isError) analyse.reset();
  }

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

  // What was last sent, kept whole so a retry repeats it exactly — including
  // the `File`, which is still in memory and does not need picking again.
  const lastInput = analyse.variables;

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
          // The previous run's outcome belongs to the previous goshala, and so
          // does the clip that was picked for it.
          setFile(null);
          setFileError(null);
          analyse.reset();
        }}
        disabled={analyse.isPending}
        isPending={goshalas.isPending}
        isError={goshalas.isError}
        errorMessage={goshalas.error?.message}
        onRetry={() => void goshalas.refetch()}
      />

      {/* Deliberately gated on the selection rather than merely disabled: a clip
          is footage from one goshala, and an upload control offered before one
          is chosen invites picking the file first and the subject afterwards. */}
      {selectedGoshala ? (
        <CctvUpload
          goshala={selectedGoshala}
          file={file}
          onPick={pickFile}
          error={fileError}
          busy={analyse.isPending}
          onAnalyse={() => {
            if (file && !fileError) {
              analyse.mutate({
                source: "upload",
                goshalaPublicId: selectedGoshala.public_id,
                file,
              });
            }
          }}
          onUseCamera={() =>
            analyse.mutate({
              source: "camera",
              goshalaPublicId: selectedGoshala.public_id,
            })
          }
        />
      ) : (
        <section className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Choose a goshala above to upload footage from it.
        </section>
      )}

      {analyse.isPending && selectedGoshala && (
        <CctvProgress
          goshalaName={selectedGoshala.name}
          progress={progress}
          // Only the upload path holds something abortable. A camera pull is
          // already committed by the time the request is out.
          onStopWaiting={
            lastInput?.source === "upload"
              ? () => abort.current?.abort()
              : undefined
          }
        />
      )}

      {failure && (
        <FailureCard
          failure={failure}
          onRetry={
            // The same input again, whichever way it was started — including
            // the same file, which means a second full upload. Never automatic.
            lastInput && failure.canRetry
              ? () => analyse.mutate(lastInput)
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
