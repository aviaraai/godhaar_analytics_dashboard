import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import DashboardTable from "./layouts/DashboardTable";
import ErrorAlert from "./layouts/ErrorAlert";
import FilterOptions from "./layouts/FilterOptions";
import Footer from "./layouts/Footer";
import Header from "./layouts/Header";
import LoadingSpinner from "./layouts/LoadingSpinner";
import { getAnalytics, type AnalyticsResult } from "./lib/api";
import { EMPTY_FILTERS, toSearchFilters } from "./lib/filters";
import type { FilterFormValues } from "./lib/types";

const ANALYTICS_KEY = "analytics";

type Snapshot = {
  rows: AnalyticsResult;
  filters: FilterFormValues;
};

export default function App() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<FilterFormValues>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterFormValues | null>(null);
  const [dismissedErrorAt, setDismissedErrorAt] = useState(0);
  const [clearedAt, setClearedAt] = useState(0);

  const query = useQuery({
    queryKey: [ANALYTICS_KEY, applied],
    queryFn: () => getAnalytics(toSearchFilters(applied ?? EMPTY_FILTERS)),
    enabled: applied !== null,
  });

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  if (query.isSuccess && applied && query.data !== snapshot?.rows) {
    setSnapshot({ rows: query.data, filters: applied });
  }

  useEffect(() => {
    if (clearedAt === 0) return;
    queryClient.removeQueries({ queryKey: [ANALYTICS_KEY] });
  }, [clearedAt, queryClient]);

  function handleSearch() {
    if (query.isFetching) return;
    if (
      applied &&
      hashKey([ANALYTICS_KEY, draft]) === hashKey([ANALYTICS_KEY, applied])
    ) {
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

  const showError = query.isError && query.errorUpdatedAt > dismissedErrorAt;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <FilterOptions
          values={draft}
          onChange={setDraft}
          onSearch={handleSearch}
          onClearCache={handleClearCache}
          busy={query.isFetching}
        />

        <section className="mt-6 rounded-xl border bg-card">
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
