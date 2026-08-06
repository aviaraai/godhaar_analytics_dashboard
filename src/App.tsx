import { useState } from "react";
import { defaultSectionFor, useSession, type Section, type SignedIn } from "@/lib/session";
import AppShell from "./layouts/AppShell";
import Dashboard from "./layouts/Dashboard";
import DebugLayout from "./layouts/DebugLayout";
import Header from "./layouts/Header";
import LoadingSpinner from "./layouts/LoadingSpinner";
import LoginScreen from "./layouts/LoginScreen";
import NoAccess from "./layouts/NoAccess";

/**
 * The gate in front of the app, and nothing else — which screen a signed-in
 * account sees is decided inside `SignedInApp`, entirely with React state.
 * There is no address bar involvement anywhere in this app: nothing here reads
 * or writes a URL, so there is nothing for a proxy or a static file server to
 * route on beyond handing out `index.html`.
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

  // Keyed on the account so signing in as someone else starts from that
  // account's own default section rather than wherever the last admin left
  // the nav — the same reason `Dashboard` and `DebugLayout` are keyed below.
  return <SignedInApp key={session.email} session={session} />;
}

function SignedInApp({ session }: { session: SignedIn }) {
  const [section, setSection] = useState<Section | null>(() =>
    defaultSectionFor(session),
  );

  return (
    <AppShell session={session} section={section} onNavigate={setSection}>
      {section === "dashboard" && session.isAdmin ? (
        <Dashboard key={session.email} />
      ) : section === "debug" && session.isDeveloper ? (
        <DebugLayout key={session.email} />
      ) : (
        <NoAccess session={session} />
      )}
    </AppShell>
  );
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
