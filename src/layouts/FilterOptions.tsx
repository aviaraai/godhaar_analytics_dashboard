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
import { SearchIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import LocationField from "./LocationField";

type FilterOptionsProps = {
  values: FilterFormValues;
  onChange: (values: FilterFormValues) => void;
  onSearch: () => void;
  onClearCache: () => void;
  /** A fetch is in flight — the fields stay live, the actions do not. */
  busy: boolean;
};

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

  // Look the selection back up out of the same arrays we hand to the combobox,
  // so the controlled value is the very object the list rendered.
  const selectedState = states.find((s) => s.id === values.state) ?? null;
  const selectedDistrict = districts.find((d) => d.id === values.district) ?? null;
  const selectedMandal = mandals.find((m) => m.id === values.mandal) ?? null;
  const selectedBreed =
    BREED_OPTIONS.find((b) => b.id === values.breed) ?? null;

  // Narrowing a parent drops whatever no longer sits underneath it.
  const setState = (next: State | null) =>
    onChange({ ...values, state: next?.id, district: undefined, mandal: undefined });
  const setDistrict = (next: District | null) =>
    onChange({ ...values, district: next?.id, mandal: undefined });
  const setMandal = (next: Mandal | null) =>
    onChange({ ...values, mandal: next?.id });
  // Independent of the place fields: a breed is not owned by a mandal, so
  // nothing above it clears it and it clears nothing below.
  const setBreed = (next: LocationOption | null) =>
    onChange({ ...values, breed: next?.id });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSearch();
      }}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontalIcon className="h-3.5 w-3.5 shrink-0 text-green-600" />
          Every filter is optional. Leave a field empty to include all of it.
        </p>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClearCache}
            disabled={busy}
            className="rounded-full border-red-200 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2Icon data-icon="inline-start" />
            Clear cached data
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md shadow-green-600/25 transition-all hover:from-green-700 hover:to-green-800 hover:shadow-lg hover:shadow-green-600/30 active:scale-[0.98]"
          >
            <SearchIcon data-icon="inline-start" />
            {busy ? "Loading…" : "Load data"}
          </Button>
        </div>
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
      />
    </div>
  );
}