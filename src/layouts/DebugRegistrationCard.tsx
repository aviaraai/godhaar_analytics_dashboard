import { useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ImageOffIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getDebugRegistration,
  type DebugRegistrationCardData,
  type DebugRegistrationDetail,
} from "@/lib/api";
import { readDetail } from "@/lib/debug";
import { formatTimestamp } from "@/lib/format";
import DebugDetail from "./DebugDetail";
import DebugDevice from "./DebugDevice";
import DebugFailures from "./DebugFailures";
import DebugImages from "./DebugImages";
import LoadingSpinner from "./LoadingSpinner";

type DebugRegistrationCardProps = {
  row: DebugRegistrationCardData;
};

/**
 * One refused registration. Only model verdicts get recorded — network faults
 * and version mismatches are deliberately absent, because the photos played no
 * part in them — so everything here is a statement about the images.
 *
 * The card carries the error code and the device, which is what the "why are
 * registrations failing" question is actually answered with; the photos and the
 * rejection payload are a request away and are only worth it once a particular
 * record is in question.
 */
export default function DebugRegistrationCard({
  row,
}: DebugRegistrationCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive" className="font-mono">
          {row.error_code}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatTimestamp(row.created_at)}
        </span>
      </header>

      <div className="flex flex-wrap items-start gap-4">
        <Thumbnail url={row.thumbnail_url} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <DebugDevice device={row.device} />
          <p className="text-[11px] text-muted-foreground">
            Attempted by{" "}
            <span className="font-mono">{row.created_by_email ?? "—"}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
          {open ? "Hide photos and payload" : "Photos and rejection payload"}
        </Button>
        {open && <RegistrationDetailView registrationId={row.registration_id} />}
      </div>
    </article>
  );
}

function RegistrationDetailView({
  registrationId,
}: {
  registrationId: string;
}) {
  const query = useQuery({
    queryKey: ["debug-registration", registrationId],
    queryFn: () => getDebugRegistration(registrationId),
    // Pinned under the fifteen minutes the photo links live for.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (query.isPending) return <LoadingSpinner label="Loading record…" />;

  if (query.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-4">
        <p className="text-xs text-muted-foreground">{query.error.message}</p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => void query.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <RegistrationDetailBody
      record={query.data}
      onRefresh={() => void query.refetch()}
    />
  );
}

function RegistrationDetailBody({
  record,
  onRefresh,
}: {
  record: DebugRegistrationDetail;
  onRefresh: () => void;
}) {
  const detail = readDetail(record.detail);
  const failures = detail.inference?.failures ?? [];

  return (
    <div className="flex flex-col gap-4">
      {detail.upstream_status !== undefined && (
        <div>
          <Badge variant="muted">upstream {detail.upstream_status}</Badge>
        </div>
      )}

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
        images={record.images}
        label="Registration photo"
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

      <DebugDetail detail={record.detail} />
    </div>
  );
}

/** Always a front shot when there is one at all. */
function Thumbnail({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
        <ImageOffIcon className="size-4 text-muted-foreground" />
        <span className="px-1 text-[10px] leading-tight text-muted-foreground">
          no photo
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="size-24 shrink-0 rounded-lg bg-muted object-cover"
    />
  );
}
