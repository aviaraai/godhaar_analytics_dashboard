import { CheckCircle2Icon, CircleHelpIcon, RotateCwIcon, SearchXIcon, ShieldCheckIcon, ShieldOffIcon, ShieldQuestionIcon, XCircleIcon, XIcon } from "lucide-react";
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

// Each decision gets its own identity rather than one shared green, so the
// chip row reads at a glance instead of requiring the label to be parsed.
const DECISION_STYLES: Record<string, { icon: React.ReactNode; active: string }> = {
  MATCH: {
    icon: <CheckCircle2Icon className="size-3.5" />,
    active: "border-transparent bg-green-600 text-white hover:bg-green-700",
  },
  REVIEW: {
    icon: <CircleHelpIcon className="size-3.5" />,
    active: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
  },
  UNKNOWN: {
    icon: <ShieldQuestionIcon className="size-3.5" />,
    active: "border-transparent bg-slate-500 text-white hover:bg-slate-600",
  },
  FAILED: {
    icon: <XCircleIcon className="size-3.5" />,
    active: "border-transparent bg-red-600 text-white hover:bg-red-700",
  },
};

const VERIFIED_STYLES: Record<string, { icon: React.ReactNode; active: string }> = {
  yes: {
    icon: <ShieldCheckIcon className="size-3.5" />,
    active: "border-transparent bg-green-600 text-white hover:bg-green-700",
  },
  no: {
    icon: <ShieldOffIcon className="size-3.5" />,
    active: "border-transparent bg-red-600 text-white hover:bg-red-700",
  },
  not_verified: {
    icon: <CircleHelpIcon className="size-3.5" />,
    active: "border-transparent bg-slate-500 text-white hover:bg-slate-600",
  },
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
    <section className="flex flex-col gap-5 rounded-2xl border bg-gradient-to-br from-green-50/50 via-card to-card p-5 shadow-sm">
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
          className="ml-auto rounded-full border-green-200 text-green-800 hover:bg-green-50 hover:text-green-900"
          onClick={onRefresh}
          disabled={busy}
        >
          <RotateCwIcon
            data-icon="inline-start"
            className={cn(busy && "animate-spin")}
          />
          {busy ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Two columns from `sm` up. The chip groups and the typed fields are
          different kinds of control and were reading as one dense block when
          stacked; side by side, each group gets its own heading and the row of
          chips stops competing with the inputs for the same line. */}
      <div className="grid gap-x-8 gap-y-6 rounded-xl border bg-white/60 p-4 sm:grid-cols-2">
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
              activeClassName={DECISION_STYLES[decision]?.active}
              icon={DECISION_STYLES[decision]?.icon}
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
              activeClassName={VERIFIED_STYLES[verified]?.active}
              icon={VERIFIED_STYLES[verified]?.icon}
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
              className="h-8 rounded-full border-green-200 focus-visible:ring-green-300"
            />
            {filters.animal && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Clear Godhaar ID filter"
                onClick={() => onChange({ ...filters, animal: "" })}
                className="rounded-full"
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
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-green-800/80 uppercase">
        <span className="h-3 w-1 rounded-full bg-green-500" />
        {label}
      </span>
      <div className="flex flex-wrap items-end gap-2">{children}</div>
    </div>
  );
}

function Chip({
  label,
  active,
  icon,
  activeClassName,
  onSelect,
}: {
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  activeClassName?: string;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "gap-1.5 rounded-full transition-all",
        !active && "border-muted-foreground/20 text-muted-foreground hover:border-green-300 hover:bg-green-50 hover:text-green-800",
        active &&
          (activeClassName ??
            "border-transparent bg-green-700 text-white hover:bg-green-800 shadow-sm"),
      )}
    >
      {active && icon}
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
      className={cn(
        "gap-1.5 rounded-full transition-all",
        !active &&
          "border-muted-foreground/20 text-muted-foreground hover:border-green-300 hover:bg-green-50 hover:text-green-800",
        active &&
          "border-transparent bg-gradient-to-r from-green-600 to-green-700 text-white shadow-sm hover:from-green-700 hover:to-green-800",
      )}
    >
      {active && <SearchXIcon className="size-3.5" />}
      {label}
      <Badge
        variant={active ? "secondary" : "muted"}
        className={cn(
          "ml-1 tabular-nums",
          active ? "bg-white/20 text-white" : "opacity-60",
        )}
      >
        {formatCount(count)}
      </Badge>
    </Button>
  );
}