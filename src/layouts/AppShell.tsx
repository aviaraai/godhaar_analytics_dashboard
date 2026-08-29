import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut as endSession, type Section, type SignedIn } from "@/lib/session";
import Footer from "./Footer";
import Header from "./Header";
import Sidebar from "./Sidebar";
import type { NavTabItem } from "./NavTabs";

type AppShellProps = {
  session: SignedIn;
  section: Section | null;
  onNavigate: (section: Section) => void;
  /**
   * Opens the CCTV monitoring board, which is a full-screen overlay with its
   * own sidebar and dark theme rather than another `Section` swap inside this
   * shell — see `App.tsx`. The sidebar item that triggers it is therefore
   * never "active" the way the other two are: there is no section state for
   * it to match against.
   */
  onOpenCctvBoard: () => void;
  children: React.ReactNode;
};

export default function AppShell({
  session,
  section,
  onNavigate,
  onOpenCctvBoard,
  children,
}: AppShellProps) {
  const queryClient = useQueryClient();

  const signOut = useMutation({
    mutationFn: endSession,
    onSettled: () => queryClient.removeQueries(),
  });

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
  if (session.isAdmin) {
    nav.push({
      key: "cctv",
      label: "CCTV monitoring",
      // Not tied to `section`: opening the board doesn't change which
      // section this shell is showing underneath it, so there is nothing
      // here for "active" to compare against.
      active: false,
      onSelect: onOpenCctvBoard,
    });
  }

  const inDebug = section === "debug";

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar items={nav} />

      <div className="flex min-h-svh flex-1 flex-col">
        <Header
          email={session.email}
          onSignOut={() => signOut.mutate()}
          signingOut={signOut.isPending}
          title={inDebug ? "Identification debug" : undefined}
        />

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}
