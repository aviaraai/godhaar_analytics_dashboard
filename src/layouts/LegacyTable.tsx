import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LegacyResult } from "@/lib/api";
import { formatCount } from "@/lib/format";

type LegacyTableProps = {
  /** `null` until the first successful load. */
  data: LegacyResult | null;
};

/**
 * The value shared by every row for `key`, or `null` if they differ. Used to
 * lift a column out of the table and into the caption: with a district selected
 * there are 21 rows all reading "Andhra Pradesh / Tirupati", and two columns of
 * the same word tell the reader nothing the caption cannot say once.
 *
 * Read off the rows rather than the filter state on purpose — the table then
 * describes what it is actually showing, and cannot disagree with itself while
 * a new query is in flight.
 */
function uniformValue(
  rows: LegacyResult,
  key: "state" | "district",
): string | null {
  if (rows.length === 0) return null;
  const first = rows[0][key];
  return rows.every((row) => row[key] === first) ? first : null;
}

export default function LegacyTable({ data }: LegacyTableProps) {
  if (!data) {
    return (
      <p className="px-2 py-12 text-center text-sm text-muted-foreground">
        Loading legacy records…
      </p>
    );
  }

  const pinnedState = uniformValue(data, "state");
  const pinnedDistrict = uniformValue(data, "district");
  const showState = pinnedState === null;
  const showDistrict = pinnedDistrict === null;

  // Mandal plus the two numeric columns, plus whichever place columns survived.
  const leadingColumns = 1 + (showState ? 1 : 0) + (showDistrict ? 1 : 0);
  const columnCount = leadingColumns + 2;

  // Summed from the rows on screen, never cached from an earlier query — the
  // footer's job is to add up what the reader can see. Unfiltered, that includes
  // the "Unknown / Unknown / Unknown" bucket, which is what makes these figures
  // reconcile with the legacy database's own headline numbers.
  const totals = data.reduce(
    (acc, row) => ({
      farmers: acc.farmers + row.farmer_count,
      animals: acc.animals + row.animal_count,
    }),
    { farmers: 0, animals: 0 },
  );

  const pinned = [pinnedState, pinnedDistrict].filter(
    (value): value is string => value !== null,
  );

  return (
    <Table>
      <TableCaption>
        <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">
            {formatCount(data.length)} {data.length === 1 ? "mandal" : "mandals"}
          </span>
          {(pinned.length > 0 ? pinned : ["All locations"]).map((part) => (
            <span key={part} className="rounded-md bg-muted px-1.5 py-0.5">
              {part}
            </span>
          ))}
        </span>
      </TableCaption>
      <TableHeader>
        <TableRow>
          {showState && <TableHead className="w-40">State</TableHead>}
          {showDistrict && <TableHead className="w-40">District</TableHead>}
          <TableHead className="w-40">Mandal</TableHead>
          <TableHead className="w-30 text-right">Farmers</TableHead>
          <TableHead className="w-30 text-right">Animals</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columnCount}
              className="py-10 text-center text-muted-foreground"
            >
              No legacy records match these filters.
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => (
            // Mandal names repeat across districts, so the key needs all three.
            <TableRow key={`${row.state}/${row.district}/${row.mandal}`}>
              {showState && <TableCell>{row.state}</TableCell>}
              {showDistrict && <TableCell>{row.district}</TableCell>}
              <TableCell className="font-medium">{row.mandal}</TableCell>
              <TableCell className="text-right">
                {formatCount(row.farmer_count)}
              </TableCell>
              <TableCell className="text-right">
                {formatCount(row.animal_count)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={leadingColumns}>Total</TableCell>
          <TableCell className="text-right">
            {formatCount(totals.farmers)}
          </TableCell>
          <TableCell className="text-right">
            {formatCount(totals.animals)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
