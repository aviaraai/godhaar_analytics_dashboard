import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ApiError,
  getDebugSearches,
  verifySearch,
  type DebugSearch,
  type VerifiedState,
} from "@/lib/api";
import {
  ALL_SEARCHES,
  DEFAULT_SEARCH_FILTERS,
  isAttributeShifted,
  matchesSearchFilters,
  readDetail,
  type SearchViewFilters,
} from "@/lib/debug";
import { formatCount } from "@/lib/format";
import type { AnimalJump } from "./DebugLayout";
import ErrorAlert from "./ErrorAlert";
import DebugErrorPanel from "./DebugErrorPanel";
import DebugSearchCard from "./DebugSearchCard";
import DebugSearchFilters from "./DebugSearchFilters";
import LoadingSpinner from "./LoadingSpinner";

const SEARCHES_KEY = "debug-searches";

type DebugSearchesPanelProps = {
  /** Set by a card elsewhere in the debug section that named this animal. */
  jump: AnimalJump | null;
  onJumpHandled: () => void;
  onNavigateToAnimal: (animal: string) => void;
};

/**
 * The point of the whole feature. A search that confidently returns the wrong
 * animal looks identical to a correct one from the server's side, so the only
 * thing that can tell them apart is a person comparing the query photos with
 * the animal that was matched — which is what this screen is for.
 */
export default function DebugSearchesPanel({
  jump,
  onJumpHandled,
  onNavigateToAnimal,
}: DebugSearchesPanelProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SearchViewFilters>(
    DEFAULT_SEARCH_FILTERS,
  );

  // Verifying a row normally removes it from the backlog view immediately,
  // which would make the reversibility the contract insists on unreachable.
  // Rows touched in this sitting stay on screen until the filters change.
  const [justReviewed, setJustReviewed] = useState<number[]>([]);

  // A registration or search card elsewhere named this animal — show every
  // other record touching it, the same way a filter change would.
  useEffect(() => {
    if (!jump) return;
    setFilters({ ...ALL_SEARCHES, animal: jump.animal });
    setJustReviewed([]);
    onJumpHandled();
  }, [jump, onJumpHandled]);

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
    mutationFn: ({ id, verified }: { id: number; verified: VerifiedState }) =>
      verifySearch(id, verified),
    onMutate: async ({ id, verified }) => {
      await queryClient.cancelQueries({ queryKey: [SEARCHES_KEY] });
      const previous = queryClient.getQueryData<DebugSearch[]>([SEARCHES_KEY]);
      queryClient.setQueryData<DebugSearch[]>([SEARCHES_KEY], (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, verified } : row)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData([SEARCHES_KEY], context.previous);
      }
    },
    // The endpoint answers with the whole updated record, so the row is
    // replaced rather than invalidated. Refetching would mint a fresh set of
    // presigned URLs and reload every photo on screen mid-review.
    onSuccess: (record) => {
      queryClient.setQueryData<DebugSearch[]>([SEARCHES_KEY], (rows) =>
        rows?.map((row) => (row.id === record.id ? record : row)),
      );
    },
  });

  function handleVerify(id: number, verified: VerifiedState) {
    setJustReviewed((seen) => (seen.includes(id) ? seen : [...seen, id]));
    verify.mutate({ id, verified });
  }

  function handleFilters(next: SearchViewFilters) {
    setFilters(next);
    setJustReviewed([]);
  }

  const rows = query.data ?? [];
  const visible = rows.filter(
    (row) =>
      matchesSearchFilters(row, filters) || justReviewed.includes(row.id),
  );

  const backlog = rows.filter(
    (row) => row.decision === "MATCH" && row.verified === "not_verified",
  ).length;
  const drift = rows.filter(
    (row) =>
      row.verified === "no" && isAttributeShifted(readDetail(row.detail).reason),
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
        drift={drift}
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
            <li key={row.id}>
              <DebugSearchCard
                row={row}
                onVerify={(verified) => handleVerify(row.id, verified)}
                pending={
                  verify.isPending && verify.variables?.id === row.id
                }
                onRefresh={() => void query.refetch()}
                justReviewed={justReviewed.includes(row.id)}
                onNavigateToAnimal={onNavigateToAnimal}
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
