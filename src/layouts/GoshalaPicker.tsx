import { HouseIcon, RotateCwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Goshala } from "@/lib/api";
import { cn } from "@/lib/utils";

type GoshalaPickerProps = {
  goshalas: Goshala[];
  selected: string | null;
  onSelect: (publicId: string) => void;
  /** True while an analysis is running — changing the subject mid-run is not on. */
  disabled: boolean;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
};

function placeOf(goshala: Goshala): string {
  return [goshala.village, goshala.mandal, goshala.district, goshala.state]
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

/**
 * The whole list, filtered in the browser. Fine at the size this is: the
 * endpoint returns every goshala sorted by name and takes no query parameters.
 * A search box beats a dropdown here because the photo and the place are what
 * tell two similarly-named goshalas apart.
 */
export default function GoshalaPicker({
  goshalas,
  selected,
  onSelect,
  disabled,
  isPending,
  isError,
  errorMessage,
  onRetry,
}: GoshalaPickerProps) {
  const [search, setSearch] = useState("");

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? goshalas.filter((goshala) =>
        `${goshala.name} ${goshala.public_id} ${placeOf(goshala)}`
          .toLowerCase()
          .includes(needle),
      )
    : goshalas;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-sm font-medium">Goshala</h2>
          <p className="text-xs text-muted-foreground">
            Choose one, then run the camera analysis.
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, ID or place"
          aria-label="Search goshalas"
          className="h-8 w-full sm:w-64"
        />
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {errorMessage ?? "The goshala list could not be loaded."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading goshalas…
        </p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {goshalas.length === 0
            ? "No goshalas are registered yet."
            : "No goshalas match that search."}
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {visible.map((goshala) => (
            <li key={goshala.public_id}>
              <button
                type="button"
                aria-pressed={selected === goshala.public_id}
                disabled={disabled}
                onClick={() => onSelect(goshala.public_id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                  selected === goshala.public_id && "border-border bg-muted",
                )}
              >
                <GoshalaPhoto goshala={goshala} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {goshala.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {placeOf(goshala) || "Location not recorded"}
                  </span>
                </span>
                <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                  {goshala.public_id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * `photo_url` is presigned for fifteen minutes and comes back empty when
 * signing failed, so both the missing case and the expired case land on the
 * same placeholder. A goshala you cannot see is still a goshala you can pick.
 */
function GoshalaPhoto({ goshala }: { goshala: Goshala }) {
  const [broken, setBroken] = useState(false);

  if (!goshala.photo_url || broken) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted">
        <HouseIcon className="size-4 text-muted-foreground" />
      </span>
    );
  }

  return (
    <img
      src={goshala.photo_url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="size-11 shrink-0 rounded-md bg-muted object-cover"
    />
  );
}
