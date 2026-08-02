import {
  hashKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getAnalytics,
  getTotals,
  UnauthorizedError,
  type AnalyticsResult,
} from "@/lib/api";
import { EMPTY_FILTERS, toSearchFilters } from "@/lib/filters";
import { signOut as endSession } from "@/lib/session";
import type { FilterFormValues } from "@/lib/types";
import DashboardTable from "./DashboardTable";
import ErrorAlert from "./ErrorAlert";
import FilterOptions from "./FilterOptions";
import Footer from "./Footer";
import Header from "./Header";
import LoadingSpinner from "./LoadingSpinner";
import TotalsSummary from "./TotalsSummary";

const ANALYTICS_KEY = "analytics";
const TOTALS_KEY = "analytics-totals";

type Snapshot = {
  rows: AnalyticsResult;
  filters: FilterFormValues;
};

type DashboardProps = {
  email: string;
};

export default function Dashboard({ email }: DashboardProps) {
  const queryClient = useQueryClient();

  // `draft` is what the form holds right now; `applied` is what the last button
  // press submitted. Keeping them apart is what stops editing a filter from
  // firing a request.
  const [draft, setDraft] = useState<FilterFormValues>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterFormValues | null>(null);
  const [dismissedErrorAt, setDismissedErrorAt] = useState(0);
  const [clearedAt, setClearedAt] = useState(0);

  const query = useQuery({
    queryKey: [ANALYTICS_KEY, applied],
    queryFn: () => getAnalytics(toSearchFilters(applied ?? EMPTY_FILTERS)),
    enabled: applied !== null,
  });

  // No `enabled` gate and no button: this component only mounts once the admin
  // is signed in, so the counts are on screen from the moment the page opens.
  // They also barely move, hence the much longer staleTime than the table.
  const totals = useQuery({
    queryKey: [TOTALS_KEY],
    queryFn: getTotals,
    staleTime: 15 * 60 * 1000,
  });

  // The table renders the last result that actually arrived rather than
  // `query.data`, so it survives both the next request and a failure of it.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  if (query.isSuccess && applied && query.data !== snapshot?.rows) {
    setSnapshot({ rows: query.data, filters: applied });
  }

  useEffect(() => {
    if (clearedAt === 0) return;
    // Evicting has to wait until `applied` has gone null: removing a query that
    // still has an enabled observer makes react-query refetch it immediately,
    // which is the backend call this button exists to avoid.
    queryClient.removeQueries({ queryKey: [ANALYTICS_KEY] });
    // Totals get the opposite treatment on purpose. They are never allowed to
    // be absent from the page, so they are invalidated rather than removed —
    // which does refetch, and that refetch is the point.
    void queryClient.invalidateQueries({ queryKey: [TOTALS_KEY] });
  }, [clearedAt, queryClient]);

  const signOut = useMutation({
    mutationFn: endSession,
    // Settled, not success: revoking the session with Supabase can fail — the
    // network is out, the token is already dead — and none of that should leave
    // the last admin's numbers sitting in the cache for the next one to read.
    // The local token is cleared either way, so the gate closes regardless.
    onSettled: () => queryClient.removeQueries(),
  });

  function handleSearch() {
    if (query.isFetching) return;
    if (
      applied &&
      hashKey([ANALYTICS_KEY, draft]) === hashKey([ANALYTICS_KEY, applied])
    ) {
      // Unchanged filters would just re-read the cache and the button would
      // feel dead, so treat the press as an explicit refresh.
      void query.refetch();
      return;
    }
    setApplied(draft);
  }

  function handleClearCache() {
    setDraft(EMPTY_FILTERS);
    setApplied(null);
    setSnapshot(null);
    setDismissedErrorAt(Date.now());
    setClearedAt(Date.now());
  }

  // An expired session is already being handled globally by flipping back to
  // the login screen; a dialog about it on the way out is just noise.
  const showError =
    query.isError &&
    !(query.error instanceof UnauthorizedError) &&
    query.errorUpdatedAt > dismissedErrorAt;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header
        email={email}
        onSignOut={() => signOut.mutate()}
        signingOut={signOut.isPending}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <TotalsSummary
          totals={totals.data}
          isPending={totals.isPending}
          isError={totals.isError}
          onRetry={() => void totals.refetch()}
        />

        <FilterOptions
          values={draft}
          onChange={setDraft}
          onSearch={handleSearch}
          onClearCache={handleClearCache}
          busy={query.isFetching}
        />

        <section className="rounded-xl border bg-card">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="font-heading text-sm font-medium">Results</h2>
            {query.isFetching && <LoadingSpinner label="Fetching analytics…" />}
          </div>
          <div className="px-4 pb-4">
            {snapshot === null && query.isFetching ? (
              <p className="px-2 py-12 text-center text-sm text-muted-foreground">
                Loading analytics…
              </p>
            ) : (
              <DashboardTable
                data={snapshot?.rows ?? null}
                filters={snapshot?.filters ?? null}
              />
            )}
          </div>
        </section>
      </main>

      <Footer />

      {showError && (
        <ErrorAlert
          message={query.error?.message ?? "Something went wrong."}
          onDismiss={() => setDismissedErrorAt(Date.now())}
        />
      )}
    </div>
  );
}
