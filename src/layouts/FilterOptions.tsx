import { BREED_OPTIONS } from "@/constants/breeds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDistricts, getMandals, getStates } from "@/lib";
import type {
  District,
  FilterFormValues,
  LocationOption,
  Mandal,
  State,
} from "@/lib/types";
import { FilterIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import LocationField from "./LocationField";

type FilterOptionsProps = {
  values: FilterFormValues;
  onChange: (values: FilterFormValues) => void;
  onSearch: () => void;
  onClearCache: () => void;
  busy: boolean;
};

const EMPTY: FilterFormValues = {};

export default function FilterOptions({
  values,
  onChange,
  onSearch,
  onClearCache,
  busy,
}: FilterOptionsProps) {
  const states = getStates();
  const districts = values.state ? getDistricts(values.state) : [];
  const mandals =
    values.state && values.district
      ? getMandals(values.state, values.district)
      : [];

  const selectedState = states.find((s) => s.id === values.state) ?? null;
  const selectedDistrict = districts.find((d) => d.id === values.district) ?? null;
  const selectedMandal = mandals.find((m) => m.id === values.mandal) ?? null;
  const selectedBreed =
    BREED_OPTIONS.find((b) => b.id === values.breed) ?? null;

  const setState = (next: State | null) =>
    onChange({ ...values, state: next?.id, district: undefined, mandal: undefined });
  const setDistrict = (next: District | null) =>
    onChange({ ...values, district: next?.id, mandal: undefined });
  const setMandal = (next: Mandal | null) =>
    onChange({ ...values, mandal: next?.id });
  const setBreed = (next: LocationOption | null) =>
    onChange({ ...values, breed: next?.id });

  const hasAnyFilter = Object.values(values).some((v) => v !== undefined && v !== "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSearch();
      }}
      className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-gradient-to-br from-green-50/50 via-card to-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-green-800/80">
          <FilterIcon className="size-4 text-green-600" />
          Filters
        </span>
        {hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY)}
            disabled={busy}
            className="rounded-full text-muted-foreground hover:bg-green-50 hover:text-green-800"
          >
            <RotateCcwIcon data-icon="inline-start" />
            Reset all
          </Button>
        )}
      </div>

      <div className="grid gap-4 rounded-xl border bg-white/60 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <LocationField
          id="filter-state"
          label="State"
          placeholder="All states"
          items={states}
          value={selectedState}
          onValueChange={setState}
          emptyMessage="No matching state"
        />
        <LocationField
          id="filter-district"
          label="District"
          placeholder={values.state ? "All districts" : "Select a state first"}
          items={districts}
          value={selectedDistrict}
          onValueChange={setDistrict}
          disabled={!values.state}
          emptyMessage="No matching district"
        />
        <LocationField
          id="filter-mandal"
          label="Mandal"
          placeholder={values.district ? "All mandals" : "Select a district first"}
          items={mandals}
          value={selectedMandal}
          onValueChange={setMandal}
          disabled={!values.district}
          emptyMessage="No matching mandal"
        />
        <LocationField
          id="filter-breed"
          label="Breed"
          placeholder="All breeds"
          items={BREED_OPTIONS}
          value={selectedBreed}
          onValueChange={setBreed}
          emptyMessage="No matching breed"
        />
        <DateField
          id="filter-from-date"
          label="From date"
          value={values.fromDate}
          max={values.toDate}
          onValueChange={(fromDate) => onChange({ ...values, fromDate })}
        />
        <DateField
          id="filter-to-date"
          label="To date"
          value={values.toDate}
          min={values.fromDate}
          onValueChange={(toDate) => onChange({ ...values, toDate })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <p className="mr-auto text-xs text-muted-foreground">
          Every filter is optional. Leave a field empty to include all of it.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onClearCache}
          disabled={busy}
          className="rounded-full border-green-200 text-green-800 hover:bg-green-50 hover:text-green-900"
        >
          <Trash2Icon data-icon="inline-start" />
          Clear cached data
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="rounded-full bg-green-700 text-white shadow-sm hover:bg-green-800"
        >
          <SearchIcon data-icon="inline-start" />
          {busy ? "Loading…" : "Load data"}
        </Button>
      </div>
    </form>
  );
}

type DateFieldProps = {
  id: string;
  label: string;
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  min?: string;
  max?: string;
};

function DateField({
  id,
  label,
  value,
  onValueChange,
  min,
  max,
}: DateFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(event) => onValueChange(event.target.value || undefined)}
        className="rounded-full border-green-200 focus-visible:ring-green-300"
      />
    </div>
  );
}