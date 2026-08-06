import { hasDetail } from "@/lib/debug";

/**
 * The raw `detail` blob, collapsed. Free-form JSONB that may contain internal
 * error text verbatim, so it is shown to developers only — which the route
 * guard already ensures — and rendered rather than interpreted. Nothing in the
 * app branches on what is in here.
 */
export default function DebugDetail({ detail }: { detail: unknown }) {
  if (!hasDetail(detail)) return null;

  return (
    <details className="group rounded-lg border bg-muted/40">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground select-none marker:hidden hover:text-foreground">
        <span className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>{" "}
        Diagnostics
        <span className="ml-2 font-normal opacity-70">
          raw, may include internal error text
        </span>
      </summary>
      <div className="px-3 pb-3">
        <pre className="max-h-80 overflow-auto rounded-md bg-background p-3 text-[11px] leading-relaxed">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </div>
    </details>
  );
}
