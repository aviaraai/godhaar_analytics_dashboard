import { getLocationLabel } from "@/lib";
import { formatDay, startOfDayUtc, startOfNextDayUtc } from "@/lib/date";
import type { FilterFormValues, SearchFilters } from "@/lib/types";

export const EMPTY_FILTERS: FilterFormValues = {};

export function toSearchFilters(form: FilterFormValues): SearchFilters {
  return {
    state: form.state,
    district: form.district,
    mandal: form.mandal,
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

  return [location || "All locations", dates];
}
