import { MapPinOffIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { homePathFor, type SignedIn } from "@/lib/session";

/**
 * Reachable now that screens have addresses — a stale bookmark or a mistyped
 * path lands here instead of on a blank page.
 */
export default function NotFound({ session }: { session: SignedIn }) {
  const home = homePathFor(session);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
      <MapPinOffIcon className="size-8 text-muted-foreground" />
      <h2 className="font-heading text-lg font-semibold">Page not found</h2>
      <p className="max-w-sm text-center text-sm text-balance text-muted-foreground">
        There is nothing at this address.
      </p>
      {home && (
        <Button type="button" render={<Link to={home} />}>
          Go to your dashboard
        </Button>
      )}
    </section>
  );
}
