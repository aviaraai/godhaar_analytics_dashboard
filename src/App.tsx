import { Navigate, Route, Routes, useLocation } from "react-router";
import { homePathFor, useSession } from "@/lib/session";
import AppShell from "./layouts/AppShell";
import Dashboard from "./layouts/Dashboard";
import DebugLayout from "./layouts/DebugLayout";
import DebugRegistrationsPanel from "./layouts/DebugRegistrationsPanel";
import DebugSearchesPanel from "./layouts/DebugSearchesPanel";
import Header from "./layouts/Header";
import LoadingSpinner from "./layouts/LoadingSpinner";
import LoginScreen from "./layouts/LoginScreen";
import NotFound from "./layouts/NotFound";
import RequireRole from "./layouts/RequireRole";

/**
 * Only a path within this app, so a crafted `?next=https://elsewhere` cannot
 * turn the login screen into an open redirect. `//host` is rejected too: the
 * browser reads it as protocol-relative and would leave the origin.
 */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * The route table, and the authentication gate in front of it. Authorization is
 * a separate question answered per route by `RequireRole`, because the two
 * roles reach different screens and "signed in" says nothing about which.
 */
export default function App() {
  const session = useSession();
  const location = useLocation();

  if (session.status === "loading") {
    return (
      <Shell>
        <LoadingSpinner label="Checking your session…" />
      </Shell>
    );
  }

  if (session.status === "signed-out") {
    // Where they were headed, carried in the URL rather than in router state so
    // it survives the reload that an expiring session tends to come with.
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <Routes>
        <Route
          path="/login"
          element={<LoginScreen notice={session.notice} />}
        />
        <Route
          path="*"
          element={<Navigate to={`/login?next=${next}`} replace />}
        />
      </Routes>
    );
  }

  const requested = safeNext(new URLSearchParams(location.search).get("next"));

  return (
    <Routes>
      {/* Nobody signed in has any business on the login screen; send them on to
          wherever they were going before they were asked to sign in. */}
      <Route
        path="/login"
        element={
          <Navigate to={requested ?? homePathFor(session) ?? "/"} replace />
        }
      />

      <Route path="/" element={<AppShell session={session} />}>
        {/* A developer has no analytics to look at, so the root is a doorway to
            their own screen rather than a refusal. */}
        <Route
          index
          element={
            session.isDeveloper && !session.isAdmin ? (
              <Navigate to="/debug" replace />
            ) : (
              <RequireRole session={session} role="admin">
                {/* Keyed on the account so signing in as someone else starts
                    from clean filters and an empty table rather than
                    inheriting the last admin's view. */}
                <Dashboard key={session.email} />
              </RequireRole>
            )
          }
        />

        <Route
          path="debug"
          element={
            <RequireRole session={session} role="developer">
              <DebugLayout />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="searches" replace />} />
          <Route
            path="searches"
            element={<DebugSearchesPanel key={session.email} />}
          />
          <Route
            path="registrations"
            element={<DebugRegistrationsPanel key={session.email} />}
          />
        </Route>

        <Route path="*" element={<NotFound session={session} />} />
      </Route>
    </Routes>
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
