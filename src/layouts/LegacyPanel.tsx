import { hashKey, keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getLegacyAnalytics, UnauthorizedError } from "@/lib/api";
import { EMPTY_LEGACY_FILTERS, hasLegacyFilters } from "@/lib/legacy";
import type { LegacyFilters } from "@/lib/types";
import ErrorAlert from "./ErrorAlert";
import LegacyFilterOptions from "./LegacyFilterOptions";
import LegacyTable from "./LegacyTable";
import LoadingSpinner from "./LoadingSpinner";
import TotalsSummary from "./TotalsSummary";

const LEGACY_KEY = "analytics-legacy";

/**
 * The legacy tab. Same shape as the current-data tab — totals strip, filters,
 * results — over a pre-aggregated snapshot of the old database.
 */
export default function LegacyPanel() {
  // `draft` is what the form holds, `applied` is what the last press submitted,
  // exactly as on the current-data tab. Unlike that tab, `applied` starts as the
  // empty filter rather than null: the unfiltered rows are fetched anyway for the
  // totals strip, so opening on an empty table would be hiding data already in
  // hand behind a button press.
  const [draft, setDraft] = useState<LegacyFilters>(EMPTY_LEGACY_FILTERS);
  const [applied, setApplied] = useState<LegacyFilters>(EMPTY_LEGACY_FILTERS);
  const [dismissedErrorAt, setDismissedErrorAt] = useState(0);

  const query = useQuery({
    queryKey: [LEGACY_KEY, applied],
    queryFn: () => getLegacyAnalytics(applied),
    // A frozen snapshot of a database nothing writes to any more, so a result
    // that arrived once is good for the rest of the session. There are only ~26
    // reachable filter combinations, so the whole thing ends up cached.
    staleTime: Infinity,
    // Each combination is a distinct key, so loading a new one would otherwise
    // blank the table on the way. Safe to keep showing the previous rows because
    // `LegacyTable` labels itself from its rows rather than from the filters.
    placeholderData: keepPreviousData,
  });

  // Whole-dataset counts, so the strip means the same thing here as it does on
  // the other tab. No `/analytics/legacy/totals` endpoint behind this: the whole
  // legacy table is 23 rows, so the unfiltered request already carries every
  // number needed to sum them. This key is identical to the table's whenever no
  // filter is applied, which makes it a second observer on one cache entry
  // rather than a second request.
  const totals = useQuery({
    queryKey: [LEGACY_KEY, EMPTY_LEGACY_FILTERS],
    queryFn: () => getLegacyAnalytics(EMPTY_LEGACY_FILTERS),
    staleTime: Infinity,
  });

  const wholeDataset = totals.data?.reduce(
    (acc, row) => ({
      total_farmers: acc.total_farmers + row.farmer_count,
      total_animals: acc.total_animals + row.animal_count,
    }),
    { total_farmers: 0, total_animals: 0 },
  );

  function handleSearch() {
    if (query.isFetching) return;
    if (hashKey([LEGACY_KEY, draft]) === hashKey([LEGACY_KEY, applied])) {
      // Unchanged filters would just re-read a cache entry that never expires,
      // so the button would feel dead. Treat the press as an explicit refresh —
      // the only way to re-pull the snapshot without reloading the page.
      void query.refetch();
      return;
    }
    setApplied(draft);
  }

  function handleClear() {
    // Resets and loads in one press. Nothing to evict the way the current-data
    // tab does: these entries are a few hundred bytes and cannot go stale.
    setDraft(EMPTY_LEGACY_FILTERS);
    setApplied(EMPTY_LEGACY_FILTERS);
    setDismissedErrorAt(Date.now());
  }

  // Same reasoning as the current-data tab: an expired session already sends the
  // app back to the login screen, so a dialog about it on the way out is noise.
  const showError =
    query.isError &&
    !(query.error instanceof UnauthorizedError) &&
    query.errorUpdatedAt > dismissedErrorAt;

  return (
    <>
      <TotalsSummary
        totals={wholeDataset}
        isPending={totals.isPending}
        isError={totals.isError}
        onRetry={() => void totals.refetch()}
        title="All legacy records"
        description="Whole legacy dataset — no filters applied."
      />

      <LegacyFilterOptions
        values={draft}
        onChange={setDraft}
        onSearch={handleSearch}
        onClear={handleClear}
        canClear={hasLegacyFilters(draft) || hasLegacyFilters(applied)}
        busy={query.isFetching}
      />

      <section className="rounded-xl border bg-card">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-heading text-sm font-medium">Results</h2>
          {query.isFetching && (
            <LoadingSpinner label="Fetching legacy records…" />
          )}
        </div>
        <div className="px-4 pb-4">
          <LegacyTable data={query.data ?? null} />
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
