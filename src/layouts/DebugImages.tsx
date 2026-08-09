import { DownloadIcon, ImageOffIcon, LinkIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DebugImage } from "@/lib/api";
import { downloadPhoto, photoFileName, type PhotoOrigin } from "@/lib/download";
import { cn } from "@/lib/utils";

type DebugImagesProps = {
  images: DebugImage[];
  /** Described to screen readers; the photos themselves carry no captions. */
  label: string;
  /**
   * Which side of the comparison these are, which is what the saved files are
   * named after: `uploaded_front_1`, `db_muzzle_2`.
   */
  origin: PhotoOrigin;
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
  origin,
  onRefresh,
  emptyHint,
}: DebugImagesProps) {
  const [expired, setExpired] = useState<string[]>([]);
  const [zoomed, setZoomed] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-xs text-muted-foreground">
        <ImageOffIcon className="size-4 shrink-0" />
        {emptyHint ?? "No photos were uploaded for this record."}
      </p>
    );
  }

  // Looked up rather than trusted after a refresh: the enlarged photo is
  // addressed by a URL that no longer exists once the record is refetched, so
  // the view falls back to the new strip instead of holding a dead link.
  const enlarged =
    zoomed && !expired.includes(zoomed)
      ? images.find((image) => image.url === zoomed)
      : undefined;

  if (enlarged) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setZoomed(null)}
          aria-label="Shrink photo"
          className="block w-full overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <img
            src={enlarged.url}
            alt={label}
            onError={() => setExpired((seen) => [...seen, enlarged.url])}
            className="max-h-[70vh] w-full object-contain"
          />
        </button>
        {/* Repeated here rather than left behind on the strip: enlarging a photo
            is what someone does just before deciding to keep a copy of it. */}
        <DownloadPhoto
          image={enlarged}
          origin={origin}
          withLabel
          className="w-fit font-mono"
        />
      </div>
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
            images={group}
            label={`${label} (${slot})`}
            origin={origin}
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
  images,
  label,
  origin,
  expired,
  onExpired,
  onZoom,
  onRefresh,
}: {
  images: DebugImage[];
  label: string;
  origin: PhotoOrigin;
  expired: string[];
  onExpired: (url: string) => void;
  onZoom: (url: string) => void;
  onRefresh: () => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {images.map((image, index) => (
        // Keyed by slot and sequence, never by URL: the same object is signed
        // afresh on every read, so a URL key would remount every tile on each
        // refetch. The index disambiguates the `unknown`/`0` fallback, which is
        // the one pair that can repeat within a record.
        <li
          key={`${image.slot}:${image.sequence}:${index}`}
          className="relative"
        >
          {expired.includes(image.url) ? (
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
            <>
              <button
                type="button"
                onClick={() => onZoom(image.url)}
                aria-label={`Enlarge ${label}`}
                className="block overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <img
                  src={image.url}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  onError={() => onExpired(image.url)}
                  className="h-28 w-28 object-cover transition-opacity hover:opacity-90"
                />
              </button>
              {/* A sibling of the tile rather than a child of it: the tile is
                  already a button, and one cannot be nested inside another. */}
              <DownloadPhoto
                image={image}
                origin={origin}
                className="absolute right-1 bottom-1"
              />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Saves one photo as `uploaded_front_1.jpg` / `db_muzzle_2.jpg`, so a folder of
 * them still says which side of the comparison each came from once the fifteen
 * minutes are up and the record is gone.
 *
 * The bytes are fetched and handed to the browser as a blob, because an
 * `<a download>` pointed straight at storage.googleapis.com is cross-origin and
 * the filename is dropped there — and the naming is the whole point.
 *
 * That fetch is the only thing here that can fail. Its message is kept and
 * shown, because the two ways it fails want different things of the reader: an
 * expired signature is fixed by refreshing the record, while a request storage
 * refuses outright is a bucket CORS problem and no amount of refreshing will
 * help. Pressing it again is allowed either way — the second attempt costs
 * nothing and the first may simply have been a bad moment on the network.
 */
function DownloadPhoto({
  image,
  origin,
  withLabel = false,
  className,
}: {
  image: DebugImage;
  origin: PhotoOrigin;
  withLabel?: boolean;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filename = photoFileName(image, origin);

  async function run() {
    setSaving(true);
    setError(null);
    try {
      await downloadPhoto(image, origin);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "The download failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  const description = error ?? `Download ${filename}`;

  return (
    <Button
      type="button"
      variant="outline"
      size={withLabel ? "xs" : "icon-xs"}
      disabled={saving}
      onClick={() => void run()}
      title={description}
      aria-label={withLabel ? undefined : description}
      className={cn(
        // Legible over whatever the photo happens to be behind it.
        "bg-background/85 backdrop-blur-xs",
        error && "text-destructive",
        className,
      )}
    >
      {saving ? (
        <Spinner
          role="presentation"
          aria-label={undefined}
          className="size-3"
          data-icon={withLabel ? "inline-start" : undefined}
        />
      ) : error ? (
        <TriangleAlertIcon data-icon={withLabel ? "inline-start" : undefined} />
      ) : (
        <DownloadIcon data-icon={withLabel ? "inline-start" : undefined} />
      )}
      {withLabel && (error ? "Download failed" : filename)}
    </Button>
  );
}
