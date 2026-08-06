import { ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, type SignedIn } from "@/lib/session";

/**
 * Shown when a signed-in account holds neither role this dashboard has a
 * screen for. There is nowhere else internal navigation could send them, so
 * the only way out is signing out and coming back as someone else.
 */
export default function NoAccess({ session }: { session: SignedIn }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
      <ShieldXIcon className="size-8 text-muted-foreground" />
      <h2 className="font-heading text-lg font-semibold">Not authorized</h2>
      <p className="max-w-sm text-center text-sm text-balance text-muted-foreground">
        <span className="font-medium">{session.email}</span> signed in
        successfully, but this dashboard has nothing for{" "}
        {session.roles.length > 0 ? (
          <>
            an account holding{" "}
            <span className="font-medium">{session.roles.join(", ")}</span>
          </>
        ) : (
          "an account with no roles assigned"
        )}
        .
      </p>
      <Button type="button" variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </section>
  );
}
