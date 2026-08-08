import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  ApiError,
  getDebugSearches,
  verifySearch,
  type DebugSearchCardData,
  type VerifiedState,
} from "@/lib/api";
import {
  filtersFromParams,
  matchesSearchFilters,
  paramsForFilters,
  type SearchViewFilters,
} from "@/lib/debug";
import { formatCount } from "@/lib/format";
import ErrorAlert from "./ErrorAlert";
import DebugErrorPanel from "./DebugErrorPanel";
import DebugSearchCard from "./DebugSearchCard";
import DebugSearchFilters from "./DebugSearchFilters";
import LoadingSpinner from "./LoadingSpinner";

const SEARCHES_KEY = "debug-searches";

/**
 * The point of the whole feature. A search that confidently returns the wrong
 * animal looks identical to a correct one from the server's side, so the only
 * thing that can tell them apart is a person comparing the query photos with
 * the animal that was matched — which is what this screen is for.
 */
export default function DebugSearchesPanel() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);

  // Verifying a row normally removes it from the backlog view immediately,
  // which would make the reversibility the contract insists on unreachable.
  // Rows touched in this sitting stay on screen until the filters change.
  const [justReviewed, setJustReviewed] = useState<string[]>([]);

  const query = useQuery({
    queryKey: [SEARCHES_KEY],
    queryFn: getDebugSearches,
    // Shorter than the app-wide defaults because the rows carry presigned URLs
    // that die after fifteen minutes. A cached listing must not outlive its
    // own images, and `gcTime` is the ceiling on how long one can.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const verify = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: VerifiedState }) =>
      verifySearch(id, verified),
    onMutate: async ({ id, verified }) => {
      await queryClient.cancelQueries({ queryKey: [SEARCHES_KEY] });
      const previous = queryClient.getQueryData<DebugSearchCardData[]>([
        SEARCHES_KEY,
      ]);
      queryClient.setQueryData<DebugSearchCardData[]>([SEARCHES_KEY], (rows) =>
        rows?.map((row) => (row.search_id === id ? { ...row, verified } : row)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData([SEARCHES_KEY], context.previous);
      }
    },
    // The endpoint answers with the full detail shape, so the card is patched
    // from it rather than the listing being invalidated — refetching would mint
    // a fresh set of presigned URLs and reload every photo on screen mid-review.
    // Only the fields a card actually has are copied across; `thumbnail_url` is
    // not among them, and taking the record wholesale would blank it.
    onSuccess: (record) => {
      queryClient.setQueryData<DebugSearchCardData[]>([SEARCHES_KEY], (rows) =>
        rows?.map((row) =>
          row.search_id === record.search_id
            ? {
                ...row,
                decision: record.decision,
                verified: record.verified,
                score: record.score,
                error_code: record.error_code,
                godhaar_id: record.godhaar_id,
              }
            : row,
        ),
      );
      // The opened record, if any, is now stale in the same way.
      queryClient.setQueryData(["debug-search", record.search_id], record);
    },
  });

  function handleVerify(id: string, verified: VerifiedState) {
    setJustReviewed((seen) => (seen.includes(id) ? seen : [...seen, id]));
    verify.mutate({ id, verified });
  }

  function handleFilters(next: SearchViewFilters) {
    // Replace rather than push: typing in the ID box would otherwise leave a
    // history entry per keystroke for the back button to walk out of.
    setParams(paramsForFilters(next), { replace: true });
    setJustReviewed([]);
  }

  const rows = query.data ?? [];
  const visible = rows.filter(
    (row) =>
      matchesSearchFilters(row, filters) || justReviewed.includes(row.search_id),
  );

  const backlog = rows.filter(
    (row) => row.decision === "MATCH" && row.verified === "not_verified",
  ).length;

  if (query.isError) {
    return (
      <DebugErrorPanel
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      <DebugSearchFilters
        filters={filters}
        onChange={handleFilters}
        onRefresh={() => void query.refetch()}
        busy={query.isFetching}
        backlog={backlog}
        total={rows.length}
      />

      <div className="flex min-h-6 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {query.isPending
            ? "Loading searches…"
            : `Showing ${formatCount(visible.length)} of ${formatCount(rows.length)} searches, newest first.`}
        </p>
        {query.isFetching && !query.isPending && (
          <LoadingSpinner label="Refreshing…" />
        )}
      </div>

      {query.isPending ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          Loading searches…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No searches have been recorded yet."
            : "No searches match these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((row) => (
            <li key={row.search_id}>
              <DebugSearchCard
                row={row}
                onVerify={(verified) => handleVerify(row.search_id, verified)}
                pending={
                  verify.isPending && verify.variables?.id === row.search_id
                }
                justReviewed={justReviewed.includes(row.search_id)}
              />
            </li>
          ))}
        </ul>
      )}

      {verify.isError && (
        <ErrorAlert
          title="Could not save your verdict"
          message={
            verify.error instanceof ApiError && verify.error.status === 404
              ? "That record no longer exists. Refresh the listing."
              : verify.error.message
          }
          onDismiss={() => verify.reset()}
        />
      )}
    </>
  );
}
