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

/** The wire shape sent to the analytics endpoint. Dates are UTC ISO-8601. */
export type SearchFilters = {
  state?: string,
  district?: string,
  mandal?: string,
  fromDate?: string,
  toDate?: string,
}

export type FilterFormValues = {
  state?: string,
  district?: string,
  mandal?: string,
  fromDate?: string,
  toDate?: string,
}
