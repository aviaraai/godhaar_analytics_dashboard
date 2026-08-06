import { ImageOffIcon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type DebugImagesProps = {
  urls: string[];
  /** Described to screen readers; the photos themselves carry no captions. */
  label: string;
  /** Re-pulls the listing, which is the only way to mint fresh links. */
  onRefresh: () => void;
  emptyHint?: string;
};

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
  urls,
  label,
  onRefresh,
  emptyHint,
}: DebugImagesProps) {
  const [expired, setExpired] = useState<string[]>([]);
  const [zoomed, setZoomed] = useState<string | null>(null);

  if (urls.length === 0) {
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
              onClick={() => setZoomed(url)}
              aria-label={`Enlarge ${label}`}
              className="block overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <img
                src={url}
                alt={label}
                loading="lazy"
                decoding="async"
                onError={() => setExpired((seen) => [...seen, url])}
                className="h-28 w-28 object-cover transition-opacity hover:opacity-90"
              />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
