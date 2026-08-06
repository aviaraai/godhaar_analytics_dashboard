import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inline rather than the modal the analytics tabs use. A listing that failed
 * has nothing behind the dialog to go back to, so the failure is the screen —
 * and the retry belongs where the missing content would have been.
 */
export default function DebugErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center">
      <TriangleAlertIcon className="size-6 text-destructive" />
      <h2 className="font-heading text-sm font-medium">Could not load records</h2>
      <p className="max-w-md text-sm text-balance text-muted-foreground">
        {message}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RotateCwIcon data-icon="inline-start" />
        Try again
      </Button>
    </section>
  );
}
