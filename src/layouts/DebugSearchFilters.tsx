import { RotateCwIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DECISIONS, VERIFIED_STATES } from "@/lib/api";
import {
  ALL_SEARCHES,
  DEFAULT_SEARCH_FILTERS,
  sameFilters,
  type SearchViewFilters,
} from "@/lib/debug";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import DebugDateRange from "./DebugDateRange";

type DebugSearchFiltersProps = {
  filters: SearchViewFilters;
  onChange: (next: SearchViewFilters) => void;
  onRefresh: () => void;
  busy: boolean;
  /** Counts over the whole listing, so a preset can say how much work it holds. */
  backlog: number;
  total: number;
};

const VERIFIED_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  not_verified: "Not verified",
};

/**
 * Applied in memory: the endpoint takes no query parameters and returns the
 * whole table, so filtering is a matter of hiding rows that are already here.
 *
 * Every control below reads a field the card carries. The attribute-drift view
 * that used to sit alongside these did not — it needed `detail.reason`, which
 * now lives only on an opened record — so it is gone rather than being answered
 * with a fetch per row.
 */
export default function DebugSearchFilters({
  filters,
  onChange,
  onRefresh,
  busy,
  backlog,
  total,
}: DebugSearchFiltersProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Preset
          label="Unreviewed matches"
          count={backlog}
          active={sameFilters(filters, DEFAULT_SEARCH_FILTERS)}
          onSelect={() => onChange(DEFAULT_SEARCH_FILTERS)}
        />
        <Preset
          label="Everything"
          count={total}
          active={sameFilters(filters, ALL_SEARCHES)}
          onSelect={() => onChange(ALL_SEARCHES)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={onRefresh}
          disabled={busy}
        >
          <RotateCwIcon data-icon="inline-start" />
          {busy ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Two columns from `sm` up. The chip groups and the typed fields are
          different kinds of control and were reading as one dense block when
          stacked; side by side, each group gets its own heading and the row of
          chips stops competing with the inputs for the same line. */}
      <div className="grid gap-x-8 gap-y-6 border-t pt-4 sm:grid-cols-2">
        <FilterGroup label="Decision">
          <Chip
            label="All"
            active={filters.decision === "all"}
            onSelect={() => onChange({ ...filters, decision: "all" })}
          />
          {DECISIONS.map((decision) => (
            <Chip
              key={decision}
              label={decision}
              active={filters.decision === decision}
              onSelect={() => onChange({ ...filters, decision })}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Verified">
          <Chip
            label="All"
            active={filters.verified === "all"}
            onSelect={() => onChange({ ...filters, verified: "all" })}
          />
          {VERIFIED_STATES.map((verified) => (
            <Chip
              key={verified}
              label={VERIFIED_LABELS[verified] ?? verified}
              active={filters.verified === verified}
              onSelect={() => onChange({ ...filters, verified })}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Date range">
          <DebugDateRange
            from={filters.from}
            to={filters.to}
            idPrefix="search-filter"
            onChange={({ from, to }) => onChange({ ...filters, from, to })}
          />
        </FilterGroup>

        <FilterGroup label="Godhaar ID">
          {/* Narrows on the card's `godhaar_id`, so it only ever matches a
              MATCH — a REVIEW's near miss is a detail-only field. */}
          <div className="flex w-full max-w-xs items-center gap-2">
            <Input
              value={filters.animal}
              onChange={(event) =>
                onChange({ ...filters, animal: event.target.value })
              }
              placeholder="Any animal"
              aria-label="Filter by Godhaar ID"
              className="h-8"
            />
            {filters.animal && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Clear Godhaar ID filter"
                onClick={() => onChange({ ...filters, animal: "" })}
              >
                <XIcon />
              </Button>
            )}
          </div>
        </FilterGroup>
      </div>
    </section>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-end gap-2">{children}</div>
    </div>
  );
}

function Chip({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onSelect}
    >
      {label}
    </Button>
  );
}

function Preset({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onSelect}
    >
      {label}
      <Badge
        variant={active ? "secondary" : "muted"}
        className={cn("ml-1 tabular-nums", count === 0 && "opacity-60")}
      >
        {formatCount(count)}
      </Badge>
    </Button>
  );
}
