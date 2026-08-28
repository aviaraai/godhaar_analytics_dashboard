import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { analyseGoshala, getCctvRequests, getGoshalas } from "@/lib/api";
import type { CctvGroup } from "./CctvMonitoringBoard";

const GOSHALAS_KEY = "cctv-board-goshalas";
const REQUESTS_KEY = "cctv-board-requests";

/**
 * Feeds the monitoring board: every goshala as a camera, each one paired with
 * the most recent *successful* analysis on record for it (if any), plus a way
 * to kick off a fresh pull for a single goshala without refetching the rest.
 *
 * `getCctvRequests()` with no goshala id returns every run ever made, across
 * every goshala, newest first (see lib/api.ts). That single unfiltered list is
 * what lets this hook build "latest clip per goshala" with one request instead
 * of one per camera.
 */
export function useCctvBoardData() {
  const queryClient = useQueryClient();

  // Ids currently mid-pull. A Set rather than a single boolean because more
  // than one card's "Pull new clip" button can be pressed at once, and each
  // camera's own `isPulling` must not depend on which one was pressed last.
  const [pullingIds, setPullingIds] = useState<Set<string>>(new Set());

  const goshalas = useQuery({
    queryKey: [GOSHALAS_KEY],
    queryFn: getGoshalas,
    staleTime: 10 * 60 * 1000,
  });

  const requests = useQuery({
    queryKey: [REQUESTS_KEY],
    queryFn: () => getCctvRequests(),
    // The annotated URL is presigned for ~15 minutes; refetching this often
    // keeps a card that has been sitting open from handing back a dead link.
    staleTime: 5 * 60 * 1000,
  });

  // Newest-first is already guaranteed by the API, so the first succeeded row
  // matching a goshala is its most recent usable result — no sorting needed.
  const latestByGoshala = new Map<
    string,
    { annotated_video_url: string; total_animals: number | null; completed_at: string | null }
  >();
  for (const row of requests.data ?? []) {
    if (row.status !== "succeeded" || !row.annotated_video_url) continue;
    if (latestByGoshala.has(row.goshala.public_id)) continue;
    latestByGoshala.set(row.goshala.public_id, {
      annotated_video_url: row.annotated_video_url,
      total_animals: row.total_animals,
      completed_at: row.completed_at,
    });
  }

  const cameras = (goshalas.data ?? []).map((goshala) => {
    const latest = latestByGoshala.get(goshala.public_id);
    return {
      id: goshala.public_id,
      name: goshala.name,
      annotatedStreamUrl: latest?.annotated_video_url,
      cattleCount: latest?.total_animals ?? undefined,
      lastAnalysedAt: latest?.completed_at ?? null,
      isPulling: pullingIds.has(goshala.public_id),
    };
  });

  // One flat group for now — there is no folder/category field on a goshala
  // to split by. The sidebar's search box is what keeps a long list usable
  // rather than a taxonomy that doesn't exist in the data.
  const groups: CctvGroup[] =
    cameras.length > 0 ? [{ id: "all", name: "All Goshalas", cameras }] : [];

  /**
   * Pulls a fresh clip straight from the goshala's own camera (`POST
   * /cctv/analyse`, no file involved) and, once it lands, refreshes the
   * requests list so the new annotated clip and count show up on the board.
   *
   * Errors are swallowed here rather than surfaced as a board-wide failure
   * state: a pull failing for one goshala (camera offline, etc.) shouldn't
   * blank out the rest of the board. `CctvPanel`'s upload flow is still the
   * place with full failure messaging; this is a lighter-weight "try again"
   * on the monitoring view.
   */
  async function pullClip(goshalaPublicId: string) {
    setPullingIds((prev) => new Set(prev).add(goshalaPublicId));
    try {
      await analyseGoshala(goshalaPublicId);
      await queryClient.invalidateQueries({ queryKey: [REQUESTS_KEY] });
    } catch (error) {
      console.error("Failed to pull a fresh clip", goshalaPublicId, error);
    } finally {
      setPullingIds((prev) => {
        const next = new Set(prev);
        next.delete(goshalaPublicId);
        return next;
      });
    }
  }

  return {
    groups,
    isLoading: goshalas.isPending || requests.isPending,
    isError: goshalas.isError || requests.isError,
    error: (goshalas.error ?? requests.error) as Error | null,
    pullClip,
  };
}