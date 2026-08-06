import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut as endSession, type Section, type SignedIn } from "@/lib/session";
import Footer from "./Footer";
import Header from "./Header";
import NavTabs, { type NavTabItem } from "./NavTabs";

type AppShellProps = {
  session: SignedIn;
  section: Section | null;
  onNavigate: (section: Section) => void;
  children: React.ReactNode;
};

/**
 * Everything a signed-in page shares: the identity strip, the sign-out button
 * and the navigation between the two tools. The header lives here rather than
 * inside either screen so it does not remount — and the sign-out mutation
 * does not reset — every time `section` changes underneath it.
 */
export default function AppShell({
  session,
  section,
  onNavigate,
  children,
}: AppShellProps) {
  const queryClient = useQueryClient();

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
  if (session.isAdmin) {
    nav.push({
      key: "dashboard",
      label: "Analytics",
      active: section === "dashboard",
      onSelect: () => onNavigate("dashboard"),
    });
  }
  if (session.isDeveloper) {
    nav.push({
      key: "debug",
      label: "Identification debug",
      active: section === "debug",
      onSelect: () => onNavigate("debug"),
    });
  }

  const inDebug = section === "debug";

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
        {children}
      </main>

      <Footer />
    </div>
  );
}
