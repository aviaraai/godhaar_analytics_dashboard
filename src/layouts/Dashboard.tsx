import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getTotals, type AnalyticsTotals } from "@/lib/api";
import { Trash2Icon, UploadCloudIcon } from "lucide-react";
import AnalyticsPanel from "./AnalyticsPanel";
import CctvPanel from "./CctvPanel";
import LegacyPanel from "./LegacyPanel";
import TotalsSummary from "./TotalsSummary";

const TOTALS_KEY = "analytics-totals";

const CURRENT = "current";
const LEGACY = "legacy";
const CCTV = "cctv";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>(CURRENT);

  // Whole-dataset counts for the *current* data only. Fetched regardless of
  // which tab is open — the query is cheap and cached — but the heading and
  // card below are only ever shown while the Current tab is active (see the
  // `tab === CURRENT` guard). Legacy has its own separate totals inside
  // `LegacyPanel`, over its own dataset; showing both at once is what made
  // the two look like one blended (and wrong) set of numbers.
  const totals = useQuery<AnalyticsTotals>({
    queryKey: [TOTALS_KEY],
    queryFn: getTotals,
    staleTime: 15 * 60 * 1000,
  });

  const [legacyOpened, setLegacyOpened] = useState(false);
  if (tab === LEGACY && !legacyOpened) setLegacyOpened(true);

  const [cctvOpened, setCctvOpened] = useState(false);
  if (tab === CCTV && !cctvOpened) setCctvOpened(true);

  return (
    <div className="flex flex-col gap-6">
      {tab === CURRENT && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span className="mt-1 h-6 w-1 shrink-0 rounded-full bg-green-600" />
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  All records
                </h1>
                <p className="text-sm text-muted-foreground">
                  Whole dataset — no filters applied.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  queryClient.removeQueries({ queryKey: [TOTALS_KEY] })
                }
              >
                <Trash2Icon data-icon="inline-start" />
                Clear cache
              </Button>
              <Button
                type="button"
                onClick={() => void totals.refetch()}
                disabled={totals.isFetching}
                className="bg-green-700 text-white hover:bg-green-800"
              >
                <UploadCloudIcon data-icon="inline-start" />
                {totals.isFetching ? "Loading…" : "Load data"}
              </Button>
            </div>
          </div>

          <TotalsSummary
            totals={totals.data}
            isPending={totals.isPending}
            isError={totals.isError}
            onRetry={() => void totals.refetch()}
          />
        </>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="rounded-full bg-muted p-1">
            <TabsTrigger
              value={CURRENT}
              className="rounded-full px-4 data-active:bg-green-700 data-active:text-white dark:data-active:bg-green-700 dark:data-active:text-white dark:data-active:border-transparent"
            >
              Current data
            </TabsTrigger>
            <TabsTrigger
              value={LEGACY}
              className="rounded-full px-4 data-active:bg-green-700 data-active:text-white dark:data-active:bg-green-700 dark:data-active:text-white dark:data-active:border-transparent"
            >
              Legacy data
            </TabsTrigger>
            <TabsTrigger
              value={CCTV}
              className="rounded-full px-4 data-active:bg-green-700 data-active:text-white dark:data-active:bg-green-700 dark:data-active:text-white dark:data-active:border-transparent"
            >
              CCTV
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value={CURRENT}
          keepMounted
          className="flex flex-col gap-6 pt-4"
        >
          <AnalyticsPanel />
        </TabsContent>

        <TabsContent
          value={LEGACY}
          keepMounted
          className="flex flex-col gap-6 pt-4"
        >
          {legacyOpened && <LegacyPanel />}
        </TabsContent>

        <TabsContent
          value={CCTV}
          keepMounted
          className="flex flex-col gap-6 pt-4"
        >
          {cctvOpened && <CctvPanel />}
        </TabsContent>
      </Tabs>
    </div>
  );
}