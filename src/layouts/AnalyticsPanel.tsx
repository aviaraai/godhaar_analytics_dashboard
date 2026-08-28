import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SearchXIcon } from "lucide-react";
import {
  getAnalytics,
  UnauthorizedError,
  type AnalyticsResult,
} from "@/lib/api";
import { EMPTY_FILTERS, toSearchFilters } from "@/lib/filters";
import type { FilterFormValues } from "@/lib/types";
import DashboardTable from "./DashboardTable";
import ErrorAlert from "./ErrorAlert";
import FilterOptions from "./FilterOptions";
import LoadingSpinner from "./LoadingSpinner";

const ANALYTICS_KEY = "analytics";

type Snapshot = {
  rows: AnalyticsResult;
  filters: FilterFormValues;
};

/** Per-user counts from the live database, filtered by place and date range. */
export default function AnalyticsPanel() {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<FilterFormValues>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterFormValues | null>(null);
  const [dismissedErrorAt, setDismissedErrorAt] = useState(0);

  const query = useQuery({
    queryKey: [ANALYTICS_KEY, applied],
    queryFn: () => getAnalytics(toSearchFilters(applied ?? EMPTY_FILTERS)),
    enabled: applied !== null,
  });

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  if (query.isSuccess && applied && query.data !== snapshot?.rows) {
    setSnapshot({ rows: query.data, filters: applied });
  }

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
    queryClient.removeQueries({ queryKey: [ANALYTICS_KEY] });
  }

  const showError =
    query.isError &&
    !(query.error instanceof UnauthorizedError) &&
    query.errorUpdatedAt > dismissedErrorAt;

  return (
    <>
      <FilterOptions
        values={draft}
        onChange={setDraft}
        onSearch={handleSearch}
        onClearCache={handleClearCache}
        onResetAll={() => setDraft(EMPTY_FILTERS)}
        busy={query.isFetching}
      />

      <section className="rounded-xl border bg-card">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-medium">
            <span className="h-4 w-1 rounded-full bg-green-600" />
            Results
          </h2>
          {query.isFetching && <LoadingSpinner label="Fetching analytics…" />}
        </div>
        <div className="px-4 pb-4">
          {snapshot === null && !query.isFetching ? (
            <EmptyResults />
          ) : snapshot === null && query.isFetching ? (
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

      {showError && (
        <ErrorAlert
          message={query.error?.message ?? "Something went wrong."}
          onDismiss={() => setDismissedErrorAt(Date.now())}
        />
      )}
    </>
  );
}

function EmptyResults() {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600">
        <SearchXIcon className="h-7 w-7" />
      </span>
      <div>
        <p className="font-medium">No records loaded yet.</p>
        <p className="text-sm text-muted-foreground">
          Apply filters and click on "Load data" to view results.
        </p>
      </div>
    </div>
  );
}