import { ImageOffIcon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DebugImage } from "@/lib/api";

type DebugImagesProps = {
  images: DebugImage[];
  /** Described to screen readers; the photos themselves carry no captions. */
  label: string;
  /** Re-pulls the record, which is the only way to mint fresh links. */
  onRefresh: () => void;
  emptyHint?: string;
};

/**
 * `front` and `muzzle` are all a capture ever has; a registered animal adds
 * `left` and `right`. Anything else is the backend's `unknown` fallback for an
 * object key it could not read, which is worth showing as itself rather than
 * being dropped or silently folded into another slot.
 */
const SLOT_ORDER = ["front", "left", "right", "muzzle"];

function bySlot(images: DebugImage[]): [string, DebugImage[]][] {
  const groups = new Map<string, DebugImage[]>();
  for (const image of images) {
    groups.set(image.slot, [...(groups.get(image.slot) ?? []), image]);
  }
  return [...groups]
    .map(
      ([slot, group]) =>
        [slot, [...group].sort((a, b) => a.sequence - b.sequence)] as [
          string,
          DebugImage[],
        ],
    )
    .sort(([a], [b]) => {
      // Unlisted slots after the known ones, alphabetically among themselves.
      const ia = SLOT_ORDER.indexOf(a);
      const ib = SLOT_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

/**
 * Presigned photos. The links expire fifteen minutes after the listing that
 * carried them, so nothing here caches or persists them: a tile that fails to
 * load is assumed expired and offers the one fix there is, which is to fetch
 * the listing again.
 *
 * Both pieces of state are keyed by URL rather than by index, so a refresh —
 * which mints entirely new URLs — clears them without any explicit reset.
 */
export default function DebugImages({
  images,
  label,
  onRefresh,
  emptyHint,
}: DebugImagesProps) {
  const [expired, setExpired] = useState<string[]>([]);
  const [zoomed, setZoomed] = useState<string | null>(null);

  const urls = images.map((image) => image.url);

  if (images.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-xs text-muted-foreground">
        <ImageOffIcon className="size-4 shrink-0" />
        {emptyHint ?? "No photos were uploaded for this record."}
      </p>
    );
  }

  // `urls.includes` matters after a refresh: the enlarged photo is addressed by
  // a URL that no longer exists, so the view falls back to the new strip
  // instead of holding a link that is guaranteed to fail.
  if (zoomed && urls.includes(zoomed) && !expired.includes(zoomed)) {
    return (
      <button
        type="button"
        onClick={() => setZoomed(null)}
        aria-label="Shrink photo"
        className="block w-full overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <img
          src={zoomed}
          alt={label}
          onError={() => setExpired((seen) => [...seen, zoomed])}
          className="max-h-[70vh] w-full object-contain"
        />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bySlot(images).map(([slot, group]) => (
        <div key={slot} className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {slot}
            {group.length > 1 && ` · ${group.length}`}
          </span>
          <Tiles
            urls={group.map((image) => image.url)}
            label={`${label} (${slot})`}
            expired={expired}
            onExpired={(url) => setExpired((seen) => [...seen, url])}
            onZoom={setZoomed}
            onRefresh={onRefresh}
          />
        </div>
      ))}
    </div>
  );
}

function Tiles({
  urls,
  label,
  expired,
  onExpired,
  onZoom,
  onRefresh,
}: {
  urls: string[];
  label: string;
  expired: string[];
  onExpired: (url: string) => void;
  onZoom: (url: string) => void;
  onRefresh: () => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {urls.map((url) => (
        <li key={url}>
          {expired.includes(url) ? (
            <div className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 text-center">
              <LinkIcon className="size-4 text-muted-foreground" />
              <span className="text-[11px] leading-tight text-muted-foreground">
                Link expired
              </span>
              <Button type="button" variant="outline" size="xs" onClick={onRefresh}>
                Refresh
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onZoom(url)}
              aria-label={`Enlarge ${label}`}
              className="block overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <img
                src={url}
                alt={label}
                loading="lazy"
                decoding="async"
                onError={() => onExpired(url)}
                className="h-28 w-28 object-cover transition-opacity hover:opacity-90"
              />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
