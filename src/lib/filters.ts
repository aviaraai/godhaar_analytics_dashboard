import { getLocationLabel } from "@/lib";
import { formatDay, startOfDayUtc, startOfNextDayUtc } from "@/lib/date";
import type { FilterFormValues, SearchFilters } from "@/lib/types";

export const EMPTY_FILTERS: FilterFormValues = {};

export function toSearchFilters(form: FilterFormValues): SearchFilters {
  return {
    state: form.state,
    district: form.district,
    mandal: form.mandal,
    // Passed through as picked. The breed column stores these names, so unlike
    // the places above there is no id to translate to — and unlike them it does
    // not cascade, since any breed can turn up in any mandal.
    breed: form.breed,
    fromDate: startOfDayUtc(form.fromDate),
    toDate: startOfNextDayUtc(form.toDate),
  };
}

export function describeFilters(form: FilterFormValues): string[] {
  const location = getLocationLabel(form.state, form.district, form.mandal);
  const from = formatDay(form.fromDate);
  const to = formatDay(form.toDate);

  let dates: string;
  if (from && to) dates = `${from} – ${to}`;
  else if (from) dates = `From ${from}`;
  else if (to) dates = `Up to ${to}`;
  else dates = "All dates";

  // Every filter gets a chip, set or not: the table's counts change meaning
  // entirely under a breed filter — they become that breed's animals and the
  // farmers who own one — so "All breeds" is worth stating rather than leaving
  // to be inferred from a missing chip.
  return [location || "All locations", form.breed || "All breeds", dates];
}
