import { RotateCwIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DECISIONS, VERIFIED_STATES } from "@/lib/api";
import {
  ALL_SEARCHES,
  ATTRIBUTE_DRIFT,
  DEFAULT_SEARCH_FILTERS,
  sameFilters,
  type SearchViewFilters,
} from "@/lib/debug";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

type DebugSearchFiltersProps = {
  filters: SearchViewFilters;
  onChange: (next: SearchViewFilters) => void;
  onRefresh: () => void;
  busy: boolean;
  /** Counts over the whole listing, so a preset can say how much work it holds. */
  backlog: number;
  drift: number;
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
 * That is also what makes the drift combination — an attribute-shifted reason
 * that a reviewer then marked wrong — a filter rather than a feature request.
 */
export default function DebugSearchFilters({
  filters,
  onChange,
  onRefresh,
  busy,
  backlog,
  drift,
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
          label="Attribute drift"
          count={drift}
          active={sameFilters(filters, ATTRIBUTE_DRIFT)}
          onSelect={() => onChange(ATTRIBUTE_DRIFT)}
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

      <div className="flex flex-col gap-3 border-t pt-3">
        <ChipRow label="Decision">
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
        </ChipRow>

        <ChipRow label="Verified">
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
        </ChipRow>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Chip
            label="Attribute shifted"
            active={filters.attributeShifted}
            onSelect={() =>
              onChange({
                ...filters,
                attributeShifted: !filters.attributeShifted,
              })
            }
          />

          <div className="flex min-w-56 flex-1 items-center gap-2">
            <Input
              value={filters.animal}
              onChange={(event) =>
                onChange({ ...filters, animal: event.target.value })
              }
              placeholder="Filter by Godhaar ID"
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
        </div>
      </div>
    </section>
  );
}

function ChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
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
