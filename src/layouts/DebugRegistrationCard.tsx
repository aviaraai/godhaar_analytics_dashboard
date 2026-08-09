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
  onNavigateToAnimal,
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
  // Only reached when the join came back empty. `matched_animal.godhaar_id` is
  // the id to read whenever there is one — it is the one guaranteed to agree
  // with the photos printed beside it — and the blob's copy is what is left
  // when the FAISS id could not be mapped back to an animal at all. Read out of
  // the blob rather than off `detail` at the click, so the narrowing that proves
  // it is present still holds inside the handler.
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
          <Badge variant="muted">upstream {detail.upstream_status}</Badge>
        </div>
      )}

      {unresolved && (
        // Recorded at capture time against whichever animals were nearby then,
        // and the join to that animal did not come back — so all there is to
        // show is the id itself. Linked, in case it still exists.
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Collided with</span>
          <AnimalLink id={unresolved} onNavigate={onNavigateToAnimal} />
        </p>
      )}

      {duplicate && !animal && !unresolved && (
        // The inference server names the duplicate by FAISS id, and an id that
        // is not in the candidate set this server sent cannot be mapped back to
        // an animal. The verdict still stands; there is simply nothing to put
        // beside it.
        <p className="text-sm text-muted-foreground">
          The model called this a duplicate but did not name an animal we could
          resolve, so there is nothing to compare these photos against.
        </p>
      )}

      {/* Above the photos rather than inside either column: what is worth
          keeping off a duplicate is both sides of the comparison, and the
          filenames are the only thing that will still say which was which. */}
      <DebugDownloadAll photos={photoBatch(record.images, animal?.images)} />

      {animal ? (
        // The whole point of a duplicate rejection being reviewable: what was
        // submitted and what it was refused in favour of, in two columns. Both
        // sides carry `front` and `muzzle` and are laid out in that order, so
        // front lines up with front — and the animal's side photos are absent
        // on purpose, because the model never saw them.
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
