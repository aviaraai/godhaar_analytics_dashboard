import { Button } from "@/components/ui/button";
import {
  getLegacyDistricts,
  getLegacyMandals,
  getLegacyStates,
} from "@/lib/legacy";
import type { LegacyFilters, LocationOption } from "@/lib/types";
import { SearchIcon, Trash2Icon } from "lucide-react";
import LocationField from "./LocationField";

type LegacyFilterOptionsProps = {
  values: LegacyFilters;
  onChange: (values: LegacyFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  /**
   * Whether anything would actually change. Decided by the panel, which can see
   * both the draft and the loaded filters — emptying the fields by hand leaves
   * nothing to clear here but plenty to clear from the table.
   */
  canClear: boolean;
  /** A fetch is in flight — the fields stay live, the actions do not. */
  busy: boolean;
};

/**
 * Same shape as the current-data filters, minus the dates: the legacy table is a
 * pre-aggregated snapshot whose source rows carry no timestamps, so there is no
 * range to ask for.
 */
export default function LegacyFilterOptions({
  values,
  onChange,
  onSearch,
  onClear,
  canClear,
  busy,
}: LegacyFilterOptionsProps) {
  const states = getLegacyStates();
  const districts = values.state ? getLegacyDistricts(values.state) : [];
  const mandals =
    values.state && values.district
      ? getLegacyMandals(values.state, values.district)
      : [];

  const selectedState = states.find((s) => s.id === values.state) ?? null;
  const selectedDistrict =
    districts.find((d) => d.id === values.district) ?? null;
  const selectedMandal = mandals.find((m) => m.id === values.mandal) ?? null;

  // Narrowing a parent drops whatever no longer sits underneath it. On this tab
  // that also keeps the API contract satisfied: a mandal without a district is a
  // 400, and clearing the district here is what makes that unreachable.
  const setState = (next: LocationOption | null) =>
    onChange({ state: next?.id });
  const setDistrict = (next: LocationOption | null) =>
    onChange({ ...values, district: next?.id, mandal: undefined });
  const setMandal = (next: LocationOption | null) =>
    onChange({ ...values, mandal: next?.id });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSearch();
      }}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <LocationField
          id="legacy-filter-state"
          label="State"
          placeholder="All states"
          items={states}
          value={selectedState}
          onValueChange={setState}
          emptyMessage="No matching state"
        />
        <LocationField
          id="legacy-filter-district"
          label="District"
          placeholder={values.state ? "All districts" : "Select a state first"}
          items={districts}
          value={selectedDistrict}
          onValueChange={setDistrict}
          disabled={!values.state}
          emptyMessage="No matching district"
        />
        <LocationField
          id="legacy-filter-mandal"
          label="Mandal"
          placeholder={
            values.district ? "All mandals" : "Select a district first"
          }
          items={mandals}
          value={selectedMandal}
          onValueChange={setMandal}
          disabled={!values.district}
          emptyMessage="No matching mandal"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <p className="mr-auto text-xs text-muted-foreground">
          Every filter is optional. Every place listed here has data, so no
          combination comes back empty.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          disabled={busy || !canClear}
        >
          <Trash2Icon data-icon="inline-start" />
          Clear filters
        </Button>
        <Button type="submit" disabled={busy}>
          <SearchIcon data-icon="inline-start" />
          {busy ? "Loading…" : "Load data"}
        </Button>
      </div>
    </form>
  );
}
