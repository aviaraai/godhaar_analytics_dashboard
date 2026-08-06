import type { DebugDevice as Device } from "@/lib/api";
import { deviceFields } from "@/lib/debug";

/**
 * The reporting device, whose model is one of the two signals a spike shows up
 * in. Missing fields say "not reported" rather than going blank: an older app
 * build that never sent the field is a different fact from no device at all,
 * and a blank cell reads as the second.
 */
export default function DebugDevice({ device }: { device: Device | null }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {deviceFields(device).map((field) => (
        <div key={field.label} className="flex items-center gap-1.5">
          <dt className="font-medium text-foreground/70">{field.label}</dt>
          <dd className={field.value === null ? "italic" : "tabular-nums"}>
            {field.value ?? "not reported"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
