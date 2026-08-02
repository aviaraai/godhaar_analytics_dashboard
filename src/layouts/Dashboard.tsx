import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { signOut as endSession } from "@/lib/session";
import AnalyticsPanel from "./AnalyticsPanel";
import Footer from "./Footer";
import Header from "./Header";
import LegacyPanel from "./LegacyPanel";

type DashboardProps = {
  email: string;
};

const CURRENT = "current";
const LEGACY = "legacy";

export default function Dashboard({ email }: DashboardProps) {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<string>(CURRENT);

  // The two datasets are not two views of the same numbers — different columns,
  // different filters, different backing tables — so they get tabs rather than a
  // toggle or a second table stacked below. Both panels stay mounted once shown
  // (`keepMounted`), because losing the filter selections every time someone
  // glances at the other tab is the one thing that would make tabs annoying.
  //
  // Legacy is mounted only after its tab is first opened, though: mounting it up
  // front would fire its query for every admin who never looks at it.
  const [legacyOpened, setLegacyOpened] = useState(false);
  if (tab === LEGACY && !legacyOpened) {
    setLegacyOpened(true);
  }

  const signOut = useMutation({
    mutationFn: endSession,
    // Settled, not success: revoking the session with Supabase can fail — the
    // network is out, the token is already dead — and none of that should leave
    // the last admin's numbers sitting in the cache for the next one to read.
    // The local token is cleared either way, so the gate closes regardless.
    onSettled: () => queryClient.removeQueries(),
  });

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header
        email={email}
        onSignOut={() => signOut.mutate()}
        signingOut={signOut.isPending}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList>
            <TabsTrigger value={CURRENT}>Current data</TabsTrigger>
            <TabsTrigger value={LEGACY}>Legacy data</TabsTrigger>
          </TabsList>

          <TabsContent
            value={CURRENT}
            keepMounted
            className="flex flex-col gap-6 pt-2"
          >
            <AnalyticsPanel />
          </TabsContent>

          <TabsContent
            value={LEGACY}
            keepMounted
            className="flex flex-col gap-6 pt-2"
          >
            {legacyOpened && <LegacyPanel />}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
