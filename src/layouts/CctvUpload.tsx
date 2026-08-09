import { SparklesIcon, VideoIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Goshala } from "@/lib/api";
import { MAX_VIDEO_BYTES, VIDEO_ACCEPT } from "@/lib/cctv";
import { formatBytes } from "@/lib/format";

type CctvUploadProps = {
  /** Only ever rendered for a chosen goshala — the clip belongs to one. */
  goshala: Goshala;
  file: File | null;
  onPick: (file: File | null) => void;
  /** Why the picked file cannot be sent, decided locally before anything is. */
  error: string | null;
  onAnalyse: () => void;
  onUseCamera: () => void;
  busy: boolean;
};

/**
 * Pick a clip recorded at this goshala and run the model over it.
 *
 * Footage is per goshala — there is no house clip that stands in for all of
 * them — so this appears only once one is chosen, and the picked file is
 * cleared whenever the choice changes. Attaching the input to the goshala this
 * way is what stops a clip from one being analysed under the name of another.
 *
 * The camera remains as the second way in, not the first: it is not wired up in
 * every environment, and where it is not it answers `503` after the button has
 * already been pressed.
 */
export default function CctvUpload({
  goshala,
  file,
  onPick,
  error,
  onAnalyse,
  onUseCamera,
  busy,
}: CctvUploadProps) {
  const inputId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);

  // The file lives in the parent, but the native input keeps its own copy of
  // the choice and nothing else can clear it. Without this, a clip cleared
  // after a run — or on switching goshala — would vanish from the state that
  // matters while its name stayed on screen.
  useEffect(() => {
    if (file === null && input.current) input.current.value = "";
  }, [file]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="font-heading text-sm font-medium">
          Analyse footage from {goshala.name}
        </h2>
        <p className="text-xs text-muted-foreground">
          Upload a clip recorded at this goshala. Counting takes roughly as long
          as the clip itself, so a thirty-second recording answers in well under
          a minute.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-medium">
          Video file
        </label>
        <Input
          id={inputId}
          ref={input}
          type="file"
          accept={VIDEO_ACCEPT}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          className="h-9 py-1.5 file:mr-3"
        />
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : file ? (
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)} · uploaded whole before the analysis starts.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            MP4, MOV, M4V, WebM, MKV or AVI, up to{" "}
            {formatBytes(MAX_VIDEO_BYTES)}.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onUseCamera}
        >
          <VideoIcon data-icon="inline-start" />
          Use the camera instead
        </Button>
        <Button
          type="button"
          // A file that failed validation is still shown, so the reason stays
          // readable — it just cannot be sent.
          disabled={busy || !file || error !== null}
          onClick={onAnalyse}
        >
          <SparklesIcon data-icon="inline-start" />
          {busy ? "Analysing…" : "Analyse this video"}
        </Button>
      </div>
    </section>
  );
}
