import { useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ImageOffIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getDebugRegistration,
  type DebugRegistrationCardData,
  type DebugRegistrationDetail,
} from "@/lib/api";
import { readDetail } from "@/lib/debug";
import { photoBatch } from "@/lib/download";
import { formatTimestamp } from "@/lib/format";
import DebugDetail from "./DebugDetail";
import DebugDevice from "./DebugDevice";
import DebugDownloadAll from "./DebugDownloadAll";
import DebugFailures from "./DebugFailures";
import DebugImages from "./DebugImages";
import DebugMatchedAnimal, { AnimalLink } from "./DebugMatchedAnimal";
import LoadingSpinner from "./LoadingSpinner";

type DebugRegistrationCardProps = {
  row: DebugRegistrationCardData;
  onNavigateToAnimal: (animal: string) => void;
};

export default function DebugRegistrationCard({
  row,
  onNavigateToAnimal,
}: DebugRegistrationCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <Badge
          variant="destructive"
          className="rounded-full px-2.5 py-0.5 font-mono"
        >
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
          className="w-fit rounded-full text-green-800 hover:bg-green-50 hover:text-green-900"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
          {open ? "Hide photos and payload" : "Photos and rejection payload"}
        </Button>
        {open && (
          <RegistrationDetailView
            registrationId={row.registration_id}
            onNavigateToAnimal={onNavigateToAnimal}
          />
        )}
      </div>
    </article>
  );
}

function RegistrationDetailView({
  registrationId,
  onNavigateToAnimal,
}: {
  registrationId: string;
  onNavigateToAnimal: (animal: string) => void;
}) {
  const query = useQuery({
    queryKey: ["debug-registration", registrationId],
    queryFn: () => getDebugRegistration(registrationId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  if (query.isPending) return <LoadingSpinner label="Loading record…" />;

  if (query.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-3 py-4">
        <p className="text-xs text-muted-foreground">{query.error.message}</p>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="rounded-full border-green-200 text-green-800 hover:bg-green-50"
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
      onNavigateToAnimal={onNavigateToAnimal}
    />
  );
}

function RegistrationDetailBody({
  record,
  onRefresh,
  onNavigateToAnimal,
}: {
  record: DebugRegistrationDetail;
  onRefresh: () => void;
  onNavigateToAnimal: (animal: string) => void;
}) {
  const detail = readDetail(record.detail);
  const failures = detail.inference?.failures ?? [];
  const animal = record.matched_animal;
  const unresolved = animal ? undefined : detail.matched_godhaar_id;
  const duplicate = record.error_code === "DUPLICATE_ANIMAL";

  const submitted = (
    <DebugImages
      images={record.images}
      label="Registration photo"
      origin="uploaded"
      onRefresh={onRefresh}
      emptyHint="The upload failed, so this record has no photos. The failure itself is still recorded."
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {detail.upstream_status !== undefined && (
        <div>
          <Badge variant="muted" className="rounded-full">
            upstream {detail.upstream_status}
          </Badge>
        </div>
      )}

      {unresolved && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Collided with</span>
          <AnimalLink id={unresolved} onNavigate={onNavigateToAnimal} />
        </p>
      )}

      {duplicate && !animal && !unresolved && (
        <p className="text-sm text-muted-foreground">
          The model called this a duplicate but did not name an animal we could
          resolve, so there is nothing to compare these photos against.
        </p>
      )}

      <DebugDownloadAll photos={photoBatch(record.images, animal?.images)} />

      {animal ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Submitted photos
            </h3>
            {submitted}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Rejected in favour of
            </h3>
            <DebugMatchedAnimal
              animal={animal}
              onRefresh={onRefresh}
              onNavigateToAnimal={onNavigateToAnimal}
            />
          </section>
        </div>
      ) : (
        submitted
      )}

      <DebugFailures failures={failures} />

      {detail.internal_error && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Internal error — developer-only
          </span>
          <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed">
            {detail.internal_error}
          </pre>
        </div>
      )}

      <DebugDetail detail={record.detail} />
    </div>
  );
}

function Thumbnail({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center">
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
      className="size-24 shrink-0 rounded-xl bg-muted object-cover shadow-sm"
    />
  );
}