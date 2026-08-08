import { useQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { getDebugRegistrations } from "@/lib/api";
import {
  ALL_REGISTRATIONS,
  countBy,
  deviceModel,
  hasRegistrationFilters,
  matchesRegistrationFilters,
  paramsForRegistrationFilters,
  registrationFiltersFromParams,
  withinDateRange,
} from "@/lib/debug";
import { formatCount } from "@/lib/format";
import DebugBreakdown from "./DebugBreakdown";
import DebugDateRange from "./DebugDateRange";
import DebugErrorPanel from "./DebugErrorPanel";
import DebugRegistrationCard from "./DebugRegistrationCard";
import LoadingSpinner from "./LoadingSpinner";

const REGISTRATIONS_KEY = "debug-registrations";

/**
 * Registrations the model refused, and the two breakdowns that answer why:
 * a spike in one `error_code`, or in one device model, is the signal. Both
 * breakdowns double as the filter, so following a spike to the records behind
 * it is a single click.
 */
export default function DebugRegistrationsPanel() {
  const [params, setParams] = useSearchParams();
  const filters = registrationFiltersFromParams(params);

  const query = useQuery({
    queryKey: [REGISTRATIONS_KEY],
    queryFn: getDebugRegistrations,
    // The rows carry presigned URLs that die after fifteen minutes, so a
    // cached listing is not allowed to outlive its own images.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const rows = query.data ?? [];

  // Counted over the whole listing rather than the filtered view: picking one
  // code should not redraw the chart that told you to pick it.
  //
  // The date range is the exception, and deliberately so — narrowing to the day
  // a spike happened is asking *which code spiked then*, so the breakdowns have
  // to answer for that window rather than for all time.
  const dated = rows.filter((row) =>
    withinDateRange(row.created_at, filters.from, filters.to),
  );
  const byCode = countBy(dated, (row) => row.error_code);
  const byModel = countBy(dated, (row) => deviceModel(row.device));

  const visible = rows.filter((row) => matchesRegistrationFilters(row, filters));

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
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Date range
          </span>
          <DebugDateRange
            from={filters.from}
            to={filters.to}
            idPrefix="registration-filter"
            onChange={({ from, to }) =>
              setParams(
                paramsForRegistrationFilters({ ...filters, from, to }),
                { replace: true },
              )
            }
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-4">
        <DebugBreakdown
          title="By error code"
          description="Which verdict the model returned."
          buckets={byCode}
          active={filters.errorCode}
          onSelect={(errorCode) =>
            setParams(
              paramsForRegistrationFilters({
                ...filters,
                errorCode: errorCode ?? undefined,
              }),
              { replace: true },
            )
          }
          missingLabel="no code"
        />
        <DebugBreakdown
          title="By device model"
          description="Whether one handset is failing more than the rest."
          buckets={byModel}
          active={filters.deviceModel}
          onSelect={(model) =>
            setParams(
              paramsForRegistrationFilters({ ...filters, deviceModel: model }),
              { replace: true },
            )
          }
          missingLabel="not reported"
        />
      </div>

      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {query.isPending
            ? "Loading registrations…"
            : `Showing ${formatCount(visible.length)} of ${formatCount(rows.length)} refused registrations, newest first.`}
        </p>
        <div className="flex items-center gap-3">
          {query.isFetching && !query.isPending && (
            <LoadingSpinner label="Refreshing…" />
          )}
          {hasRegistrationFilters(filters) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setParams(paramsForRegistrationFilters(ALL_REGISTRATIONS), {
                  replace: true,
                })
              }
            >
              Clear filters
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RotateCwIcon data-icon="inline-start" />
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          Loading registrations…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No registrations have been refused yet."
            : "No registrations match these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((row) => (
            <li key={row.registration_id}>
              <DebugRegistrationCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
