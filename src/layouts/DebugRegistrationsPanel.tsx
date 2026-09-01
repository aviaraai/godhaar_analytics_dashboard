import { useQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getDebugRegistrations } from "@/lib/api";
import {
  ALL_REGISTRATIONS,
  countBy,
  deviceModel,
  hasRegistrationFilters,
  matchesRegistrationFilters,
  withinDateRange,
  type RegistrationViewFilters,
} from "@/lib/debug";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import DebugBreakdown from "./DebugBreakdown";
import DebugDateRange from "./DebugDateRange";
import DebugErrorPanel from "./DebugErrorPanel";
import DebugRegistrationCard from "./DebugRegistrationCard";
import LoadingSpinner from "./LoadingSpinner";

const REGISTRATIONS_KEY = "debug-registrations";

type DebugRegistrationsPanelProps = {
  onNavigateToAnimal: (animal: string) => void;
};

export default function DebugRegistrationsPanel({
  onNavigateToAnimal,
}: DebugRegistrationsPanelProps) {
  const [filters, setFilters] =
    useState<RegistrationViewFilters>(ALL_REGISTRATIONS);

  const query = useQuery({
    queryKey: [REGISTRATIONS_KEY],
    queryFn: getDebugRegistrations,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const rows = query.data ?? [];

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
      <section className="flex flex-col gap-2 rounded-2xl border bg-gradient-to-br from-green-50/50 via-card to-card p-4 shadow-sm">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-green-800/80 uppercase">
          <span className="h-3 w-1 rounded-full bg-green-500" />
          Date range
        </span>
        <DebugDateRange
          from={filters.from}
          to={filters.to}
          idPrefix="registration-filter"
          onChange={({ from, to }) => setFilters({ ...filters, from, to })}
        />
      </section>

      <div className="flex flex-wrap gap-4">
        <DebugBreakdown
          title="By error code"
          description="Which verdict the model returned."
          buckets={byCode}
          active={filters.errorCode}
          onSelect={(errorCode) =>
            setFilters({ ...filters, errorCode: errorCode ?? undefined })
          }
          missingLabel="no code"
        />
        <DebugBreakdown
          title="By device model"
          description="Whether one handset is failing more than the rest."
          buckets={byModel}
          active={filters.deviceModel}
          onSelect={(model) => setFilters({ ...filters, deviceModel: model })}
          missingLabel="not reported"
        />
      </div>

      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/60 px-4 py-3 shadow-sm">
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
              onClick={() => setFilters(ALL_REGISTRATIONS)}
              className="rounded-full text-muted-foreground hover:bg-green-50 hover:text-green-800"
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
            className="rounded-full border-green-200 text-green-800 hover:bg-green-50 hover:text-green-900"
          >
            <RotateCwIcon
              data-icon="inline-start"
              className={cn(query.isFetching && "animate-spin")}
            />
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <p className="rounded-2xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground shadow-sm">
          Loading registrations…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground shadow-sm">
          {rows.length === 0
            ? "No registrations have been refused yet."
            : "No registrations match these filters."}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {visible.map((row) => (
            <li key={row.registration_id}>
              <DebugRegistrationCard
                row={row}
                onNavigateToAnimal={onNavigateToAnimal}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}