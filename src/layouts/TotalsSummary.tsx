import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyticsTotals } from "@/lib/api";
import { formatCount } from "@/lib/format";

type TotalsSummaryProps = {
  totals: AnalyticsTotals | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  title?: string;
  description?: string;
};

/**
 * Whole-dataset counts. These never respond to the filters, which is why the
 * "All records" label is not decoration: `DashboardTable` has its own Totals
 * row in the footer and that one *is* filtered. Two different numbers under
 * the same words, with nothing to distinguish them, is a support ticket.
 *
 * The legacy tab reuses this with its own wording. Its numbers arrive by a
 * different route — summed on the client rather than counted by the backend —
 * but they mean exactly the same thing, so they belong in the same strip.
 */
export default function TotalsSummary({
  totals,
  isPending,
  isError,
  onRetry,
  title = "All records",
  description = "Whole dataset — no filters applied.",
}: TotalsSummaryProps) {
  return (
    <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-xl border bg-card px-4 py-4">
      <div className="mr-auto flex flex-col gap-0.5">
        <h2 className="font-heading text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {isError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Totals are unavailable right now.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </div>
      ) : (
        <>
          <Stat
            label="Total Farmers"
            value={totals?.total_farmers}
            isPending={isPending}
          />
          <Stat
            label="Total Animals"
            value={totals?.total_animals}
            isPending={isPending}
          />
        </>
      )}
    </section>
  );
}

type StatProps = {
  label: string;
  value: number | undefined;
  isPending: boolean;
};

function Stat({ label, value, isPending }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className="font-heading text-2xl font-semibold tabular-nums"
        aria-busy={isPending || undefined}
      >
        {value === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatCount(value)
        )}
      </span>
    </div>
  );
}
