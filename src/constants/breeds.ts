import type { LocationOption } from "@/lib/types";

/**
 * The breeds the mobile app offers at registration, which is what the `breed`
 * column holds — cattle and buffalo in one list, exactly as a surveyor sees it.
 *
 * These strings are the filter values themselves, not display labels over some
 * code: unlike `state`/`district`/`mandal`, which are matched by id, the breed
 * column stores the name and the query param is compared against it directly.
 * So the spelling here has to be the database's spelling, character for
 * character — "Shahiwal", not the "Sahiwal" you will see elsewhere.
 *
 * Hardcoded rather than fetched for the same reason the location tree is: it is
 * a closed vocabulary owned by the app, and a filter that cannot be opened
 * until a request comes back is worse than one that needs a redeploy when the
 * list grows. The cost is that a breed added on the backend is unselectable
 * here until it is added below.
 */
export const BREEDS = [
  "Banni",
  "Bhadawari",
  "Chilika",
  "Deoni",
  "Desi",
  "Gir",
  "Graded Murrah",
  "HF",
  "HF Cross",
  "Jaffarabadi",
  "Jersey",
  "Jersey Cross",
  "Kankrej",
  "Marathwadi",
  "Mehsana",
  "Murrah",
  "Nagpuri",
  "Nili Ravi",
  "Ongole",
  "Pandharpuri",
  "Punganur",
  "Rathi",
  "Red Sindhi",
  "Shahiwal",
  "Surti",
  "Tharparkar",
  "Toda",
  "Other",
] as const;

export type Breed = (typeof BREEDS)[number];

/**
 * The same list as combobox options. `id` and `label` are both the name, the
 * way the legacy location filters work — there is no code to hide behind.
 */
export const BREED_OPTIONS: LocationOption[] = BREEDS.map((breed) => ({
  id: breed,
  label: breed,
}));
