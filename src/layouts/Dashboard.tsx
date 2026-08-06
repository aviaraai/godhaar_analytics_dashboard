import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import AnalyticsPanel from "./AnalyticsPanel";
import CctvPanel from "./CctvPanel";
import LegacyPanel from "./LegacyPanel";

const CURRENT = "current";
const LEGACY = "legacy";
const CCTV = "cctv";

export default function Dashboard() {
  const [tab, setTab] = useState<string>(CURRENT);

  // The two datasets are not two views of the same numbers — different columns,
  // different filters, different backing tables — so they get tabs rather than a
  // toggle or a second table stacked below. Both panels stay mounted once shown
  // (`keepMounted`), because losing the filter selections every time someone
  // glances at the other tab is the one thing that would make tabs annoying.
  //
  // Tabs rather than routes for exactly that reason: these are two views of one
  // screen whose value is in the state they hold, and an address per view would
  // trade that away for a link nobody has asked for.
  //
  // Legacy and CCTV are mounted only after their tab is first opened, though:
  // mounting either up front would fire a query — Legacy's totals, CCTV's
  // goshala list and history — for every admin who never looks at that tab.
  const [legacyOpened, setLegacyOpened] = useState(false);
  if (tab === LEGACY && !legacyOpened) {
    setLegacyOpened(true);
  }
  const [cctvOpened, setCctvOpened] = useState(false);
  if (tab === CCTV && !cctvOpened) {
    setCctvOpened(true);
  }

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <TabsList>
        <TabsTrigger value={CURRENT}>Current data</TabsTrigger>
        <TabsTrigger value={LEGACY}>Legacy data</TabsTrigger>
        <TabsTrigger value={CCTV}>CCTV analysis</TabsTrigger>
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

      <TabsContent
        value={CCTV}
        keepMounted
        className="flex flex-col gap-6 pt-2"
      >
        {cctvOpened && <CctvPanel />}
      </TabsContent>
    </Tabs>
  );
}
