import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router";
import { signOut as endSession, type SignedIn } from "@/lib/session";
import Footer from "./Footer";
import Header from "./Header";
import NavTabs, { type NavTabItem } from "./NavTabs";

type AppShellProps = {
  session: SignedIn;
};

/**
 * Everything a signed-in page shares: the identity strip, the sign-out button
 * and the navigation between the two tools. Lives on the layout route so the
 * header does not remount — and the sign-out mutation does not reset — every
 * time the route underneath it changes.
 */
export default function AppShell({ session }: AppShellProps) {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();

  const signOut = useMutation({
    mutationFn: endSession,
    // Settled, not success: revoking the session with Supabase can fail — the
    // network is out, the token is already dead — and none of that should leave
    // the last admin's numbers sitting in the cache for the next one to read.
    // The local token is cleared either way, so the gate closes regardless.
    onSettled: () => queryClient.removeQueries(),
  });

  // Two roles, one claim each, so most people see one destination and no nav at
  // all. `NavTabs` renders nothing below two items rather than showing a tab
  // strip that cannot go anywhere.
  const nav: NavTabItem[] = [];
  if (session.isAdmin) nav.push({ to: "/", label: "Analytics", end: true });
  if (session.isDeveloper) {
    nav.push({ to: "/debug", label: "Identification debug" });
  }

  const inDebug = pathname.startsWith("/debug");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header
        email={session.email}
        onSignOut={() => signOut.mutate()}
        signingOut={signOut.isPending}
        title={inDebug ? "Identification debug" : undefined}
        description={
          inDebug
            ? "Why registrations fail, and whether search returns the right animal."
            : undefined
        }
      >
        <NavTabs items={nav} />
      </Header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
