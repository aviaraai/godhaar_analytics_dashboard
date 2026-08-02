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
import type { AnalyticsResult } from "@/lib/api";
import { describeFilters } from "@/lib/filters";
import { formatCount } from "@/lib/format";
import type { FilterFormValues } from "@/lib/types";

type DashboardTableProps = {
  /** `null` until the first successful load. */
  data: AnalyticsResult | null;
  /** The filters that produced `data` — not necessarily what the form holds. */
  filters: FilterFormValues | null;
};

function DashboardTable({ data, filters }: DashboardTableProps) {
  if (!data || !filters) {
    return (
      <p className="px-2 py-12 text-center text-sm text-muted-foreground">
        Pick your filters and choose <span className="font-medium">Load data</span> to
        run a query.
      </p>
    );
  }

  const totals = data.reduce(
    (acc, row) => ({
      farmers: acc.farmers + row.total_farmers,
      animals: acc.animals + row.total_animals,
      assigned: acc.assigned + row.total_assigned,
      unassigned: acc.unassigned + row.total_unassigned,
    }),
    { farmers: 0, animals: 0, assigned: 0, unassigned: 0 },
  );

  return (
    <Table>
      <TableCaption>
        <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">
            {formatCount(data.length)} {data.length === 1 ? "user" : "users"}
          </span>
          {describeFilters(filters).map((part) => (
            <span key={part} className="rounded-md bg-muted px-1.5 py-0.5">
              {part}
            </span>
          ))}
        </span>
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-25">User ID</TableHead>
          <TableHead className="w-25 text-right">Total Farmers</TableHead>
          <TableHead className="w-25 text-right">Total Animals</TableHead>
          <TableHead className="w-25 text-right">Total Assigned Animals</TableHead>
          <TableHead className="w-25 text-right">Total Unassigned Animals</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="py-10 text-center text-muted-foreground"
            >
              No records match these filters.
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => (
            <TableRow key={row.user_id}>
              <TableCell className="font-medium">{row.user_id}</TableCell>
              <TableCell className="text-right">{formatCount(row.total_farmers)}</TableCell>
              <TableCell className="text-right">{formatCount(row.total_animals)}</TableCell>
              <TableCell className="text-right">{formatCount(row.total_assigned)}</TableCell>
              <TableCell className="text-right">{formatCount(row.total_unassigned)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          {/* "Filtered" earns its place: the strip above the filters shows
              whole-dataset counts, and these two rows will disagree whenever a
              filter is set. Naming both of them "Totals" invites the question. */}
          <TableCell>Filtered totals</TableCell>
          <TableCell className="text-right">{formatCount(totals.farmers)}</TableCell>
          <TableCell className="text-right">{formatCount(totals.animals)}</TableCell>
          <TableCell className="text-right">{formatCount(totals.assigned)}</TableCell>
          <TableCell className="text-right">{formatCount(totals.unassigned)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export default DashboardTable;
