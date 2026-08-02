import { ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/session";
import Dashboard from "./layouts/Dashboard";
import Header from "./layouts/Header";
import LoadingSpinner from "./layouts/LoadingSpinner";
import LoginScreen from "./layouts/LoginScreen";

/**
 * The authorization gate. Worth being blunt about what this is and is not: it
 * decides what to *render*, nothing more. The admin claim it reads comes out of
 * a token sitting in this browser, and anyone can edit React state from
 * devtools. Actual enforcement lives in the Echo middleware guarding
 * `/api/web/v1/*` — this only spares people from staring at a dashboard that
 * would answer every request with 403.
 */
export default function App() {
  const session = useSession();

  if (session.status === "loading") {
    return (
      <Shell>
        <LoadingSpinner label="Checking your session…" />
      </Shell>
    );
  }

  if (session.status === "signed-out") {
    return <LoginScreen notice={session.notice} />;
  }

  // Signing in succeeded and still ends here for every field user, because
  // authentication was never the gate — authorization is. Saying so plainly
  // beats a dashboard where every panel fails.
  if (!session.isAdmin) {
    return (
      <Shell>
        <ShieldXIcon className="size-8 text-muted-foreground" />
        <h2 className="font-heading text-lg font-semibold">Not authorized</h2>
        <p className="max-w-sm text-center text-sm text-balance text-muted-foreground">
          <span className="font-medium">{session.email}</span> signed in
          successfully, but this dashboard is limited to administrator accounts.
        </p>
        <Button type="button" variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Shell>
    );
  }

  // Keyed on the account so signing in as someone else starts from clean
  // filters and an empty table rather than inheriting the last admin's view.
  return <Dashboard key={session.email} email={session.email} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
