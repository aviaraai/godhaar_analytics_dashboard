import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InferenceFailure } from "@/lib/debug";

/**
 * The inference server's per-photo breakdown, shown beside the photos rather
 * than buried in the collapsed blob — "slot 2 failed at the muzzle stage" only
 * means something next to the muzzle photo it is talking about.
 */
export default function DebugFailures({
  failures,
}: {
  failures: InferenceFailure[];
}) {
  if (failures.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Slot</TableHead>
            <TableHead className="w-28">Stage</TableHead>
            <TableHead className="w-44">Code</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {failures.map((failure, index) => (
            // Nothing in a failure is guaranteed unique or even present, so
            // position is the only stable identity these rows have. Safe here:
            // the array is rendered whole and never reordered or spliced.
            <TableRow key={index} className="text-xs">
              <TableCell className="font-medium">
                {failure.slot ?? "—"}
              </TableCell>
              <TableCell>{failure.stage ?? "—"}</TableCell>
              <TableCell className="font-mono">
                {failure.error_code ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {failure.reason ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
