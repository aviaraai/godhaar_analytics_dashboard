import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DebugDateRangeProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  idPrefix: string;
};

export default function DebugDateRange({
  from,
  to,
  onChange,
  idPrefix,
}: DebugDateRangeProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
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
          className="rounded-full text-muted-foreground hover:bg-green-50 hover:text-green-800"
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
      <label
        htmlFor={id}
        className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-8 w-40 rounded-full border-green-200 bg-white/70 focus-visible:ring-green-300"
      />
    </div>
  );
}