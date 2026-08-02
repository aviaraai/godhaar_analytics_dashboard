import { LEGACY_LOCATIONS } from "@/constants/legacyLocations";
import type { LegacyFilters, LocationOption } from "@/lib/types";

export const EMPTY_LEGACY_FILTERS: LegacyFilters = {};

/**
 * The legacy tree is keyed by name, so every option is its own id. That is not a
 * shortcut — the name *is* what the query string carries — and it keeps
 * `LocationField`, which is written against `{ id, label }`, usable unchanged.
 */
const asOption = (name: string): LocationOption => ({ id: name, label: name });

export function getLegacyStates(): LocationOption[] {
  return LEGACY_LOCATIONS.map((entry) => asOption(entry.state));
}

export function getLegacyDistricts(state: string): LocationOption[] {
  const found = LEGACY_LOCATIONS.find((entry) => entry.state === state);
  return found?.districts.map((entry) => asOption(entry.district)) ?? [];
}

export function getLegacyMandals(
  state: string,
  district: string,
): LocationOption[] {
  const found = LEGACY_LOCATIONS.find(
    (entry) => entry.state === state,
  )?.districts.find((entry) => entry.district === district);
  return found?.mandals.map(asOption) ?? [];
}

/** True once any filter is set — i.e. the view is narrower than the whole table. */
export function hasLegacyFilters(filters: LegacyFilters): boolean {
  return Boolean(filters.state || filters.district || filters.mandal);
}
