/**
 * Digit grouping only — React renders a bare number fine. Totals across a whole
 * state reach five and six figures, which are hard to compare at a glance in a
 * dense right-aligned column. Uses the browser locale, so an en-IN admin gets
 * the lakh grouping they expect: "1,24,318".
 */
export const formatCount = (value: number) => value.toLocaleString();
