import { LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type CctvVideoProps = {
  url: string;
  onRefresh: () => void;
};

/**
 * H.264 and seekable, so a plain `<video>` is the whole player.
 *
 * The URL is presigned for fifteen minutes, but only at the point the stream
 * opens — long playback of an already-started video is fine, and the expiry
 * only bites on a returning viewer. That is exactly the case this handles:
 * a failed load means the link died, and the only fix is a fresh listing.
 *
 * Nothing here caches or stores the URL, and it is deliberately not wrapped in
 * a link — it is a credential with a video attached, not an address to share.
 */
export default function CctvVideo({ url, onRefresh }: CctvVideoProps) {
  const [expired, setExpired] = useState(false);

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
        <LinkIcon className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This video link has expired.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          Get a fresh link
        </Button>
      </div>
    );
  }

  return (
    <video
      // Remounts when the URL changes, so switching between the annotated and
      // the original clip actually reloads rather than keeping the old stream.
      key={url}
      src={url}
      controls
      playsInline
      preload="metadata"
      onError={() => setExpired(true)}
      className="w-full rounded-lg bg-black"
    />
  );
}
