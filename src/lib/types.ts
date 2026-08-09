export type LocationOption = {
  id: string;
  label: string;
};

export type Mandal = LocationOption;

export type District = LocationOption & {
  mandals: Mandal[];
};

export type State = LocationOption & {
  districts: District[];
};

/**
 * The wire shape sent to the analytics endpoint. Dates are UTC ISO-8601.
 *
 * `state`/`district`/`mandal` are ids matching `constants/`; `breed` is the
 * breed name itself, because that is what the column stores. Every field is
 * optional and an omitted one means "no filter" — the Go handler takes them as
 * pointers and short-circuits the predicate on nil, so an empty string is a
 * filter for the empty string rather than for everything.
 */
export type SearchFilters = {
  state?: string,
  district?: string,
  mandal?: string,
  breed?: string,
  fromDate?: string,
  toDate?: string,
}

export type FilterFormValues = {
  state?: string,
  district?: string,
  mandal?: string,
  breed?: string,
  fromDate?: string,
  toDate?: string,
}

/**
 * The wire shape for the legacy endpoint. Full place *names*, not the ids every
 * other filter uses: the legacy aggregate stores names only, because the 21
 * Tirupati mandals holding almost all of that data have no id in `constants/`.
 *
 * All three are optional and cascade — omitting one means "all" at that level —
 * but a `mandal` without a `district` is a 400, since mandal names are not
 * unique across districts. The cascading dropdowns are what enforce that.
 *
 * There is no date range. The legacy table is a pre-aggregated snapshot whose
 * source rows carry no timestamps.
 */
export type LegacyFilters = {
  state?: string,
  district?: string,
  mandal?: string,
}
