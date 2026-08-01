import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoadingSpinnerProps = {
  label?: string;
  className?: string;
};

/**
 * Inline, non-blocking activity indicator. Deliberately not an overlay: the
 * previous results stay on screen and stay interactive while a fetch is in
 * flight — only the buttons that would start another fetch get disabled.
 */
export default function LoadingSpinner({
  label = "Loading…",
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <Spinner role="presentation" aria-label={undefined} />
      <span>{label}</span>
    </div>
  );
}
