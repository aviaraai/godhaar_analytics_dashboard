import { useQuery } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ImageOffIcon,
  UndoIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getDebugSearch,
  type DebugSearchCardData,
  type DebugSearchDetail,
  type Decision,
  type VerifiedState,
} from "@/lib/api";
import {
  describeReason,
  isAttributeShifted,
  isVerifiable,
  readDetail,
} from "@/lib/debug";
import { photoBatch } from "@/lib/download";
import { formatScore, formatTimestamp } from "@/lib/format";
import DebugDetail from "./DebugDetail";
import DebugDevice from "./DebugDevice";
import DebugDownloadAll from "./DebugDownloadAll";
import DebugImages from "./DebugImages";
import DebugMatchedAnimal, { AnimalLink } from "./DebugMatchedAnimal";
import LoadingSpinner from "./LoadingSpinner";

type DebugSearchCardProps = {
  row: DebugSearchCardData;
  onVerify: (verified: VerifiedState) => void;
  pending: boolean;
  /** Verified in this sitting, so it is kept on screen for second thoughts. */
  justReviewed: boolean;
  onNavigateToAnimal: (animal: string) => void;
};

const DECISION_VARIANT: Record<
  Decision,
  "success" | "warning" | "muted" | "destructive"
> = {
  MATCH: "success",
  REVIEW: "warning",
  UNKNOWN: "muted",
  FAILED: "destructive",
};

/**
 * One search attempt, as a card. The comparison that actually settles whether
 * the model was right — query photos beside the matched animal's — lives behind
 * the disclosure, because it costs a request per record and the listing is read
 * far more often than any one row is opened.
 *
 * The verdict buttons stay on the card rather than moving inside: a reviewer
 * working the backlog of confident matches is answering the same question over
 * and over, and making them open every row to answer it would be the slowest
 * possible way to do the one thing this screen exists for.
 */
export default function DebugSearchCard({
  row,
  onVerify,
  pending,
  justReviewed,
  onNavigateToAnimal,
}: DebugSearchCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant={DECISION_VARIANT[row.decision]}>{row.decision}</Badge>
        <VerifiedBadge verified={row.verified} />
        {row.error_code && (
          <Badge variant="destructive" className="font-mono">
            {row.error_code}
          </Badge>
        )}
        {justReviewed && <Badge variant="muted">just reviewed</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatTimestamp(row.created_at)}
        </span>
      </header>

      <div className="flex flex-wrap items-start gap-4">
        <Thumbnail url={row.thumbnail_url} decision={row.decision} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
            <Stat label="Score" value={formatScore(row.score)} />
          </div>

          {row.godhaar_id ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Matched</span>
              <AnimalLink
                id={row.godhaar_id}
                onNavigate={onNavigateToAnimal}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {row.decision === "FAILED"
                ? "The model rejected the photos and never produced a verdict."
                : row.verifiable
                  ? // A REVIEW: it ranked a candidate and declined to claim it.
                    // The card below shows that animal's photos, and the point
                    // of asking is that the model would not commit either way.
                    "No animal was claimed — open the photos to judge the top candidate."
                  : "No animal was claimed."}
            </p>
          )}

          <DebugDevice device={row.device} />
          <p className="text-[11px] text-muted-foreground">
            Searched by{" "}
            <span className="font-mono">{row.created_by_email ?? "—"}</span>
          </p>
        </div>
      </div>

      {isVerifiable(row) && (
        <VerifyControls
          verified={row.verified}
          pending={pending}
          onVerify={onVerify}
        />
      )}

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
          {open ? "Hide photos and working" : "Photos and decision working"}
        </Button>
        {open && (
          <SearchDetailView
            searchId={row.search_id}
            onNavigateToAnimal={onNavigateToAnimal}
          />
        )}
      </div>
    </article>
  );
}

/**
 * Its own query, keyed by record, so opening a second card does not evict the
 * first and closing one does not throw away what it fetched. The photos are
 * presigned for fifteen minutes, which is what `staleTime` is pinned under —
 * a cached detail must never outlive its own images.
 */
function SearchDetailView({
  searchId,
  onNavigateToAnimal,
}: {
  searchId: string;
  onNavigateToAnimal: (animal: string) => void;
}) {
  const query = useQuery({
    queryKey: ["debug-search", searchId],
    queryFn: () => getDebugSearch(searchId),
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
    <SearchDetailBody
      record={query.data}
      onRefresh={() => void query.refetch()}
      onNavigateToAnimal={onNavigateToAnimal}
    />
  );
}

function SearchDetailBody({
  record,
  onRefresh,
  onNavigateToAnimal,
}: {
  record: DebugSearchDetail;
  onRefresh: () => void;
  onNavigateToAnimal: (animal: string) => void;
}) {
  const detail = readDetail(record.detail);
  const reason = describeReason(detail.reason);
  const shifted = isAttributeShifted(detail.reason);
  const animal = record.matched_animal;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
        {/* Both scores together, because that is what makes a demotion legible:
            the model liked it this much, ranking used that. */}
        <Stat label="Adjusted" value={formatScore(detail.adjusted_score)} />
        <Stat label="Gap" value={formatScore(detail.gap)} />
        <Stat label="Agreement" value={formatScore(detail.agreement)} />
        {detail.top_k !== undefined && (
          <Stat label="top_k" value={String(detail.top_k)} />
        )}
        {detail.radius_km !== undefined && (
          <Stat label="Radius" value={`${detail.radius_km} km`} />
        )}
        {shifted && (
          // A run of these that reviewers then mark wrong is the clearest
          // evidence of colour/horn classifier drift there is.
          <Badge variant="warning">attribute shifted</Badge>
        )}
      </div>

      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}

      {/* The query photos and the animal they were matched against, in one
          press. Only a MATCH has a second side to take; on everything else this
          is just the submitted photos, and it disappears below two of them. */}
      <DebugDownloadAll photos={photoBatch(record.images, animal?.images)} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Query photos
          </h3>
          <DebugImages
            images={record.images}
            label="Query photo"
            origin="uploaded"
            onRefresh={onRefresh}
            emptyHint="No photos were uploaded with this search."
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {animal?.claimed ? "Matched animal" : "Top candidate"}
          </h3>
          {animal ? (
            <DebugMatchedAnimal
              animal={animal}
              onRefresh={onRefresh}
              onNavigateToAnimal={onNavigateToAnimal}
            />
          ) : (
            <CandidateNote
              decision={record.decision}
              candidate={detail.top_candidate}
              onNavigateToAnimal={onNavigateToAnimal}
            />
          )}
        </section>
      </div>

      <DebugDetail detail={record.detail} />
    </div>
  );
}

/**
 * The first captured photo. A dead link degrades to the same placeholder as an
 * absent one — at card size there is nothing useful to say about the difference,
 * and the record itself is one click away.
 */
function Thumbnail({
  url,
  decision,
}: {
  url: string | null;
  decision: Decision;
}) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
        <ImageOffIcon className="size-4 text-muted-foreground" />
        <span className="px-1 text-[10px] leading-tight text-muted-foreground">
          {decision === "FAILED" ? "rejected" : "no photo"}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: VerifiedState }) {
  if (verified === "yes") return <Badge variant="success">verified: yes</Badge>;
  if (verified === "no") {
    return <Badge variant="destructive">verified: no</Badge>;
  }
  return <Badge variant="outline">not verified</Badge>;
}

/**
 * `REVIEW` and `UNKNOWN` scored a candidate but carry no matched animal, and
 * the contract is emphatic about why: promoting a near-miss to a verifiable
 * claim would misrepresent what the model said. So it is labelled as context
 * and there is nothing to verify.
 */
function CandidateNote({
  decision,
  candidate,
  onNavigateToAnimal,
}: {
  decision: Decision;
  candidate: string | undefined;
  onNavigateToAnimal: (animal: string) => void;
}) {
  if (decision === "FAILED") {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-xs text-muted-foreground">
        The model rejected the photos and never produced a verdict.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-4">
      {candidate ? (
        <AnimalLink id={candidate} onNavigate={onNavigateToAnimal} />
      ) : (
        <p className="text-xs text-muted-foreground">No candidate recorded.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {candidate
          ? // A candidate was ranked but its photos could not be loaded, so
            // there is nothing to compare against here. The verdict buttons are
            // still offered — the record itself is verifiable — but this panel
            // cannot help answer it.
            "The model ranked this animal first without claiming it. Its photos could not be loaded, so there is nothing to compare here."
          : "Nothing was ranked, so there is nothing here to confirm or refute."}
      </p>
    </div>
  );
}

/**
 * Freely reversible in every direction, so all three states are always offered
 * and the current one is simply the pressed-looking button. A one-way "confirm"
 * would make a reviewer's second thoughts unrecordable.
 */
function VerifyControls({
  verified,
  pending,
  onVerify,
}: {
  verified: VerifiedState;
  pending: boolean;
  onVerify: (verified: VerifiedState) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
      <span className="mr-1 text-sm font-medium">Same animal?</span>
      <Button
        type="button"
        size="sm"
        variant={verified === "yes" ? "default" : "outline"}
        disabled={pending}
        onClick={() => onVerify("yes")}
      >
        <CheckIcon data-icon="inline-start" />
        Yes
      </Button>
      <Button
        type="button"
        size="sm"
        variant={verified === "no" ? "default" : "outline"}
        disabled={pending}
        onClick={() => onVerify("no")}
      >
        <XIcon data-icon="inline-start" />
        No
      </Button>
      {verified !== "not_verified" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => onVerify("not_verified")}
        >
          <UndoIcon data-icon="inline-start" />
          Undo
        </Button>
      )}
    </div>
  );
}
