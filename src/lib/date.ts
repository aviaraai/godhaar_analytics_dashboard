const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDay(value: string | undefined) {
  if (!value) return null;
  const match = DAY_PATTERN.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function startOfDayUtc(value: string | undefined): string | undefined {
  const day = parseDay(value);
  if (!day) return undefined;
  return new Date(day.year, day.month - 1, day.day, 0, 0, 0, 0).toISOString();
}

export function startOfNextDayUtc(value: string | undefined): string | undefined {
  const day = parseDay(value);
  if (!day) return undefined;
  // Date rolls overflow forward for us, so 30 June + 1 becomes 1 July.
  return new Date(day.year, day.month - 1, day.day + 1, 0, 0, 0, 0).toISOString();
}

export function formatDay(value: string | undefined): string | undefined {
  const day = parseDay(value);
  if (!day) return undefined;
  return new Date(day.year, day.month - 1, day.day).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" },
  );
}
