import { useQuery } from "@tanstack/react-query";
import { ImageOffIcon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

/**
 * One refused registration, shown as a square photo tile — the badge and
 * timestamp sit directly on the image so the tile carries just enough to
 * scan a grid of them at a glance. Everything else (device, "attempted by",
 * photos, rejection payload) only exists once someone opens it, inside the
 * dialog below — that's what previously lived in an inline expand/collapse
 * section, which took a full-width row per record regardless of whether
 * anyone looked at it.
 */
export default function DebugRegistrationCard({
  row,
  onNavigateToAnimal,
}: DebugRegistrationCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            aria-label={`${row.error_code}, ${formatTimestamp(row.created_at)}`}
          />
        }
        className="group relative block aspect-square w-full overflow-hidden rounded-xl border bg-muted shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Thumbnail url={row.thumbnail_url} />

        {/* Scrim + overlaid details, so the badge and timestamp read clearly
            over any photo without needing a separate row of chrome. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />

        <span className="absolute top-1.5 left-1.5">
          <Badge
            variant="destructive"
            className="rounded-full px-1.5 py-0 font-mono text-[9px] leading-4"
          >
            {row.error_code}
          </Badge>
        </span>

        <span className="pointer-events-none absolute right-0 bottom-0 left-0 truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pt-3 pb-1 text-[10px] text-white/90">
          {formatTimestamp(row.created_at)}
        </span>
      </AlertDialogTrigger>

      <AlertDialogContent
        className="!w-[95vw] !max-w-2xl !gap-3 sm:!max-w-3xl"
        render={<div />}
      >
        <div className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader className="!grid-rows-none !place-items-start gap-1.5 text-left">
            <div className="flex w-full flex-wrap items-center gap-2">
              <Badge
                variant="destructive"
                className="rounded-full px-2.5 py-0.5 font-mono"
              >
                {row.error_code}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatTimestamp(row.created_at)}
              </span>
            </div>
            <AlertDialogTitle className="sr-only">
              Refused registration details
            </AlertDialogTitle>
            <div className="flex min-w-0 flex-col gap-1">
              <DebugDevice device={row.device} />
              <p className="text-[11px] text-muted-foreground">
                Attempted by{" "}
                <span className="font-mono">{row.created_by_email ?? "—"}</span>
              </p>
            </div>
          </AlertDialogHeader>

          <div className="pt-3">
            {open && (
              <RegistrationDetailView
                registrationId={row.registration_id}
                onNavigateToAnimal={onNavigateToAnimal}
              />
            )}
          </div>
        </div>

        <AlertDialogFooter className="!rounded-b-xl">
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-center">
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
      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
    />
  );
}