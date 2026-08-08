import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DebugDateRangeProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  /** Distinguishes the input ids when both screens are in one document. */
  idPrefix: string;
};

/**
 * A range rather than the single day the contract's mock sketches: one day is
 * expressible by putting the same date in both, and "the week the new app build
 * went out" is not expressible any other way. Both bounds are inclusive, which
 * is what a reader picking two dates off a calendar means by them.
 *
 * Each bound constrains the other, so the pair cannot be dragged into an
 * impossible order and then quietly return nothing.
 */
export default function DebugDateRange({
  from,
  to,
  onChange,
  idPrefix,
}: DebugDateRangeProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field
        id={`${idPrefix}-from`}
        label="From date"
        value={from}
        max={to || undefined}
        onValueChange={(next) => onChange({ from: next, to })}
      />
      <Field
        id={`${idPrefix}-to`}
        label="To date"
        value={to}
        min={from || undefined}
        onValueChange={(next) => onChange({ from, to: next })}
      />
      {(from || to) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ from: "", to: "" })}
        >
          <XIcon data-icon="inline-start" />
          Clear dates
        </Button>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  min,
  max,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-8 w-40"
      />
    </div>
  );
}
