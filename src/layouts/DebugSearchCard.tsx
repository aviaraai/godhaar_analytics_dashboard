import { CheckIcon, TrashIcon, UndoIcon, XIcon } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DebugSearch, Decision, VerifiedState } from "@/lib/api";
import {
  describeReason,
  isAttributeShifted,
  isVerifiable,
  readDetail,
} from "@/lib/debug";
import { formatScore, formatTimestamp } from "@/lib/format";
import DebugDetail from "./DebugDetail";
import DebugDevice from "./DebugDevice";
import DebugImages from "./DebugImages";

type DebugSearchCardProps = {
  row: DebugSearch;
  onVerify: (verified: VerifiedState) => void;
  pending: boolean;
  onRefresh: () => void;
  /** Verified in this sitting, so it is kept on screen for second thoughts. */
  justReviewed: boolean;
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
 * One search attempt. For a `MATCH` this is the verification screen itself:
 * the query photos and the matched animal's photo side by side, and one
 * question under them.
 */
export default function DebugSearchCard({
  row,
  onVerify,
  pending,
  onRefresh,
  justReviewed,
}: DebugSearchCardProps) {
  const detail = readDetail(row.detail);
  const shifted = isAttributeShifted(detail.reason);
  const reason = describeReason(detail.reason);
  const animal = row.matched_animal;

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant={DECISION_VARIANT[row.decision]}>{row.decision}</Badge>
        <VerifiedBadge verified={row.verified} />
        {shifted && (
          // Surfaced rather than buried: a run of these that reviewers then
          // mark wrong is the clearest evidence of classifier drift there is.
          <Badge variant="warning">attribute shifted</Badge>
        )}
        {row.error_code && (
          <Badge variant="destructive" className="font-mono">
            {row.error_code}
          </Badge>
        )}
        {justReviewed && <Badge variant="muted">just reviewed</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          #{row.id} · {formatTimestamp(row.created_at)}
        </span>
      </header>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
        <Stat label="Score" value={formatScore(row.score)} />
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
      </div>

      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Query photos
          </h3>
          <DebugImages
            urls={row.image_urls}
            label={`Query photo for search ${row.id}`}
            onRefresh={onRefresh}
            emptyHint="No photos were uploaded with this search."
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {animal ? "Matched animal" : "Top candidate"}
          </h3>
          {animal ? (
            <MatchedAnimal animal={animal} onRefresh={onRefresh} />
          ) : (
            <CandidateNote
              decision={row.decision}
              candidate={detail.top_candidate}
            />
          )}
        </section>
      </div>

      {isVerifiable(row) && (
        <VerifyControls
          verified={row.verified}
          pending={pending}
          onVerify={onVerify}
        />
      )}

      <DebugDevice device={row.device} />
      <p className="text-[11px] text-muted-foreground">
        Searched by <span className="font-mono">{row.created_by ?? "—"}</span>
      </p>

      <DebugDetail detail={row.detail} />
    </article>
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
 * Read live by join, so `deleted` means the animal was removed after the search
 * matched it. Shown with a marker rather than hidden — a search pointing at a
 * deleted animal is itself worth seeing — and everything but the ID is null by
 * then, which is why the attribute list simply comes out empty.
 */
function MatchedAnimal({
  animal,
  onRefresh,
}: {
  animal: NonNullable<DebugSearch["matched_animal"]>;
  onRefresh: () => void;
}) {
  const attributes = [
    animal.breed,
    animal.animal_type,
    animal.gender,
    animal.age === null ? null : `${animal.age}y`,
  ].filter((value): value is string => Boolean(value));

  const appearance = [animal.body_color, animal.muzzle_color, animal.horn_shape]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  const place = [animal.village, animal.mandal, animal.district, animal.state]
    .filter((value): value is string => Boolean(value))
    .join(", ");

  return (
    <div className="flex flex-col gap-2">
      <DebugImages
        urls={animal.image_url ? [animal.image_url] : []}
        label={`Registered photo of ${animal.godhaar_id}`}
        onRefresh={onRefresh}
        emptyHint={
          animal.deleted
            ? "This animal has been deleted, so its photo is gone."
            : "This animal has no registered photo."
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <AnimalLink id={animal.godhaar_id} />
        {animal.deleted && (
          <Badge variant="destructive">
            <TrashIcon /> deleted
          </Badge>
        )}
      </div>
      {attributes.length > 0 && (
        <p className="text-sm">{attributes.join(" · ")}</p>
      )}
      {appearance && (
        <p className="text-xs text-muted-foreground">{appearance}</p>
      )}
      {place && <p className="text-xs text-muted-foreground">{place}</p>}
    </div>
  );
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
}: {
  decision: Decision;
  candidate: string | undefined;
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
        <AnimalLink id={candidate} />
      ) : (
        <p className="text-xs text-muted-foreground">No candidate recorded.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Context only — the model did not claim this animal, so there is nothing
        here to confirm or refute.
      </p>
    </div>
  );
}

/**
 * Every other record touching this animal. There is no animal record screen in
 * this dashboard to point at, so the link goes to the thing that does exist and
 * is useful while reviewing: the animal's own debug history.
 */
function AnimalLink({ id }: { id: string }) {
  return (
    <Link
      to={`/debug/searches?decision=all&verified=all&animal=${encodeURIComponent(id)}`}
      className="font-mono text-sm font-medium underline-offset-4 hover:underline"
    >
      {id}
    </Link>
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
