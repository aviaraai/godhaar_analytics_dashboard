import {
  CheckIcon,
  DownloadIcon,
  FolderDownIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  canPickFolder,
  chooseFolder,
  downloadPhotos,
  type BatchResult,
  type PhotoDownload,
} from "@/lib/download";
import { cn } from "@/lib/utils";

type DebugDownloadAllProps = {
  /** Both sides of the comparison, submitted first. */
  photos: PhotoDownload[];
  className?: string;
};

/** What a finished run has to say for itself. */
type Outcome = { result: BatchResult; folder: string | null };

/**
 * Saves every photo on a record in one press — the submitted capture and the
 * animal it was compared against, ten files on a duplicate — each under the
 * same name its own button would write. The links die after fifteen minutes and
 * cannot be re-signed one at a time, so taking the whole set at once is what
 * anyone keeping evidence of a verdict actually wants.
 *
 * Where a browser supports it, this asks for a folder first and writes the
 * files straight into it. That is not a convenience: with Chrome's "ask where
 * to save each file" setting on, ordinary downloads open a Save As dialog *per
 * photo*, and ten dialogs to save one comparison is no better than ten clicks.
 * One folder prompt replaces all of them. Firefox and Safari have no picker, so
 * there the photos go through the normal download path one at a time.
 *
 * Nothing is offered below two photos: with one, this button and the one on the
 * tile would do the identical thing.
 *
 * The run reports what it managed rather than all-or-nothing. Individual links
 * expire independently, and "saved 8 of 10" tells a reviewer both that they
 * have eight and that the record wants refreshing — where a single failure
 * message would hide the eight.
 */
export default function DebugDownloadAll({
  photos,
  className,
}: DebugDownloadAllProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  if (photos.length < 2) return null;

  const running = progress !== null;
  const picks = canPickFolder();

  async function run() {
    // First thing in the handler, before any await of ours: the picker needs
    // the click's user activation and will refuse once that has been spent.
    const choice = await chooseFolder();
    if (choice.kind === "cancelled") return;

    const handle = choice.kind === "folder" ? choice.handle : null;
    const into = handle?.name ?? null;

    setOutcome(null);
    setFolder(into);
    setProgress(0);
    try {
      const result = await downloadPhotos(photos, {
        folder: handle,
        onProgress: ({ done }) => setProgress(done),
      });
      setOutcome({ result, folder: into });
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={running}
        onClick={() => void run()}
        title={
          picks
            ? `Pick one folder; all ${photos.length} photos are written into it as uploaded_… and db_… files`
            : `Save all ${photos.length} photos as uploaded_… and db_… files`
        }
      >
        <Icon running={running} result={outcome?.result ?? null} picks={picks} />
        {running
          ? // One ahead of the completed tally, because what it names is the
            // photo currently being fetched.
            `Saving ${Math.min((progress ?? 0) + 1, photos.length)} of ${photos.length}…`
          : `Download all ${photos.length} photos${picks ? "…" : ""}`}
      </Button>

      <Note running={running} folder={folder} outcome={outcome} />
    </div>
  );
}

/**
 * Chrome asks once per site before it will save more than one file, and a
 * reviewer who dismisses that prompt gets exactly one photo and no error.
 * Saying so is the only warning available — and it is only worth saying on the
 * path that can actually hit it, which is the one without a folder.
 */
function Note({
  running,
  folder,
  outcome,
}: {
  running: boolean;
  folder: string | null;
  outcome: Outcome | null;
}) {
  if (running) {
    return (
      <span className="text-xs text-muted-foreground">
        {folder
          ? `Writing into “${folder}”…`
          : "Allow multiple downloads if asked."}
      </span>
    );
  }

  if (!outcome) return null;

  const { result } = outcome;
  const into = outcome.folder ? ` to “${outcome.folder}”` : "";

  return (
    <span
      className={cn(
        "text-xs",
        result.failed ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {result.failed === 0
        ? `Saved ${result.total} photos${into}.`
        : result.saved === 0
          ? "Nothing could be saved — the links have expired. Refresh the record."
          : `Saved ${result.saved} of ${result.total}${into}; the rest have expired. Refresh the record.`}
    </span>
  );
}

function Icon({
  running,
  result,
  picks,
}: {
  running: boolean;
  result: BatchResult | null;
  picks: boolean;
}) {
  if (running) {
    return (
      <Spinner
        role="presentation"
        aria-label={undefined}
        className="size-3.5"
        data-icon="inline-start"
      />
    );
  }
  if (result?.failed) return <TriangleAlertIcon data-icon="inline-start" />;
  if (result) return <CheckIcon data-icon="inline-start" />;
  return picks ? (
    <FolderDownIcon data-icon="inline-start" />
  ) : (
    <DownloadIcon data-icon="inline-start" />
  );
}
