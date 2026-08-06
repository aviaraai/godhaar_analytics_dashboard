import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/lib/format";

/**
 * An indefinite wait, shown as one. There is no percentage to report — the job
 * model is deliberately hidden behind a single blocking call, so nothing knows
 * how far along it is — and a progress bar that cannot be filled honestly is
 * worse than a spinner.
 *
 * The elapsed counter is the compromise: it says nothing about how much is
 * left, but it does say the wait is still alive, which is the question anyone
 * staring at a five-minute spinner is actually asking.
 *
 * Mounted only while the request is in flight, so mounting is the start time.
 */
export default function CctvProgress({ goshalaName }: { goshalaName: string }) {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed(Date.now() - startedAt),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-10 text-center"
    >
      <Spinner role="presentation" aria-label={undefined} className="size-6" />
      <p className="text-sm font-medium">
        Analysing {goshalaName} · {formatDuration(elapsed)}
      </p>
      <p className="max-w-md text-sm text-balance text-muted-foreground">
        This can take several minutes. The server pulls the clip from the
        camera, runs the model over it and stores the annotated video before it
        answers.
      </p>
      <p className="max-w-md text-xs text-balance text-muted-foreground">
        The analysis is already recorded, so it will appear in the history below
        even if you close this page.
      </p>
    </section>
  );
}
