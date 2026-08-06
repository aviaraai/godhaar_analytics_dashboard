import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import type { DebugRegistration } from "@/lib/api";
import { readDetail } from "@/lib/debug";
import { formatTimestamp } from "@/lib/format";
import DebugDetail from "./DebugDetail";
import DebugDevice from "./DebugDevice";
import DebugFailures from "./DebugFailures";
import DebugImages from "./DebugImages";

type DebugRegistrationCardProps = {
  row: DebugRegistration;
  onRefresh: () => void;
};

/**
 * One refused registration. Only model verdicts get recorded — network faults
 * and version mismatches are deliberately absent, because the photos played no
 * part in them — so everything here is a statement about the images.
 */
export default function DebugRegistrationCard({
  row,
  onRefresh,
}: DebugRegistrationCardProps) {
  const detail = readDetail(row.detail);
  const failures = detail.inference?.failures ?? [];

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive" className="font-mono">
          {row.error_code}
        </Badge>
        {detail.upstream_status !== undefined && (
          <Badge variant="muted">upstream {detail.upstream_status}</Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          #{row.id} · {formatTimestamp(row.created_at)}
        </span>
      </header>

      {detail.matched_godhaar_id && (
        // Resolved at capture time from whichever animals were nearby then, so
        // it cannot be recovered later. Linked while it still exists.
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Collided with</span>
          <Link
            to={`/debug/searches?decision=all&verified=all&animal=${encodeURIComponent(detail.matched_godhaar_id)}`}
            className="font-mono font-medium underline-offset-4 hover:underline"
          >
            {detail.matched_godhaar_id}
          </Link>
        </p>
      )}

      <DebugImages
        urls={row.image_urls}
        label={`Registration photo for record ${row.id}`}
        onRefresh={onRefresh}
        emptyHint="The upload failed, so this record has no photos. The failure itself is still recorded."
      />

      <DebugFailures failures={failures} />

      {detail.internal_error && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Internal error — developer-only
          </span>
          <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 text-[11px] leading-relaxed">
            {detail.internal_error}
          </pre>
        </div>
      )}

      <DebugDevice device={row.device} />
      <p className="text-[11px] text-muted-foreground">
        Attempted by <span className="font-mono">{row.created_by ?? "—"}</span>
      </p>

      <DebugDetail detail={row.detail} />
    </article>
  );
}
