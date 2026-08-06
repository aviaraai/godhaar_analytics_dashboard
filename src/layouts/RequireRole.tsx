import { ShieldXIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { homePathFor, signOut, type SignedIn } from "@/lib/session";

type Role = "admin" | "developer";

type RequireRoleProps = {
  session: SignedIn;
  role: Role;
  children: React.ReactNode;
};

/**
 * Worth being blunt about what this is and is not: it decides what to *render*,
 * nothing more. The claim it reads comes out of a token sitting in this browser,
 * and anyone can edit React state from devtools. Actual enforcement lives in the
 * Echo middleware guarding `/api/web/v1/*` — this only spares people from
 * staring at a screen that would answer every request with 403.
 */
export default function RequireRole({
  session,
  role,
  children,
}: RequireRoleProps) {
  const allowed = role === "admin" ? session.isAdmin : session.isDeveloper;
  if (allowed) return children;

  // Somewhere else they can actually be, if there is one. An admin who followed
  // a debug link gets a way back rather than a dead end.
  const elsewhere = homePathFor(session);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
      <ShieldXIcon className="size-8 text-muted-foreground" />
      <h2 className="font-heading text-lg font-semibold">Not authorized</h2>
      <p className="max-w-sm text-center text-sm text-balance text-muted-foreground">
        <span className="font-medium">{session.email}</span> signed in
        successfully, but this screen is limited to{" "}
        <span className="font-medium">{role}</span> accounts
        {session.roles.length > 0 ? (
          <>
            {" "}
            and this one holds{" "}
            <span className="font-medium">{session.roles.join(", ")}</span>
          </>
        ) : (
          " and this one has no roles assigned"
        )}
        .
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {elsewhere && (
          <Button type="button" render={<Link to={elsewhere} />}>
            Go to your dashboard
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </section>
  );
}
