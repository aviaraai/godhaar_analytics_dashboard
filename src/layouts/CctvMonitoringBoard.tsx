import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  Maximize2Icon,
  Minimize2Icon,
  PinIcon,
  ScanEyeIcon,
  SearchIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { useCctvBoardData } from "./UseCctvBoardData";
import bgImage3 from "@/assets/bg_image2.png";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CctvCamera = {
  /** The goshala's public_id — the only addressable unit the API has. */
  id: string;
  name: string;
  /**
   * There is no raw live feed on the backend today — `getGoshalas` and
   * `analyseGoshala` never return one — so this is always undefined and the
   * board renders no "live feed" pane. Left on the type in case a real feed
   * endpoint shows up later.
   */
  streamUrl?: string;
  /**
   * The annotated clip from the most recent *successful* analysis of this
   * goshala. Presigned and expires roughly 15 minutes after the request that
   * fetched it, same as everywhere else this URL shape is used.
   */
  annotatedStreamUrl?: string;
  /** Count from that same run. `undefined` renders as "—". */
  cattleCount?: number;
  /** When that run completed, so a viewer can judge how stale the clip is. */
  lastAnalysedAt?: string | null;
  /** A fresh pull (`POST /cctv/analyse`) is in flight for this goshala. */
  isPulling?: boolean;
};

export type CctvGroup = {
  id: string;
  name: string;
  cameras: CctvCamera[];
};

/** One row on the board: annotated feed + count panel. */
type Slot = CctvCamera | null;

/** Which pane (if any) is currently blown up to fill the card. Only one pane
 * exists today (annotated), but this stays a union so a future live pane
 * slots in without reshaping the focus model. */
type FocusedPane = "annotated" | null;

/** The "only 2 screens fit on one page" rule, in one place. */
const SLOTS_PER_PAGE = 2;

/** Custom drag MIME type so we don't collide with browser drag defaults. */
const DRAG_MIME = "application/x-godhaar-camera";

/**
 * Value equality for a camera, used only to decide whether a placed slot
 * needs to be replaced when fresh data arrives.
 *
 * `useCctvBoardData` (like most data hooks) builds a brand-new array of
 * brand-new camera objects on every call, whether or not the underlying data
 * actually changed. Comparing those objects by reference (`fresh !== slot`)
 * would therefore read as "changed" on every render forever, which sets a new
 * `pages` array, which triggers a re-render, which rebuilds `groups` again —
 * a render loop that never settles. Comparing the fields that actually
 * matter is what breaks that loop.
 */
function sameCamera(a: CctvCamera, b: CctvCamera): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.streamUrl === b.streamUrl &&
    a.annotatedStreamUrl === b.annotatedStreamUrl &&
    a.cattleCount === b.cattleCount &&
    a.lastAnalysedAt === b.lastAnalysedAt &&
    a.isPulling === b.isPulling
  );
}

/* ------------------------------------------------------------------ */
/*  Brand mark — a simplified concentric-arc "fingerprint" motif       */
/*  echoing the Godhaar logo's identification mark. Reused as a quiet  */
/*  signature across dividers and empty states.                        */
/* ------------------------------------------------------------------ */

function FingerprintMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3.2c-4.6 0-8.3 3.5-8.3 8.4 0 2 .3 3.6.9 5.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M12 5.6c-3.4 0-6 2.6-6 6.2 0 2.4.5 4.2 1.3 5.9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M12 8c-2.2 0-3.9 1.7-3.9 3.9 0 2.8.8 4.9 1.9 6.6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M12 10.4c-1 0-1.7.7-1.7 1.6 0 2.6.9 4.4 2 5.9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M15.7 9.4c.5 1 .7 1.9.7 2.8 0 2.9-1 5-2.3 6.7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M17.8 7.7c.9 1.4 1.4 3 1.4 4.7 0 3.1-1.1 5.5-2.6 7.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Board                                                              */
/* ------------------------------------------------------------------ */

type CctvMonitoringBoardProps = {
  /** Returns to the main dashboard shell. */
  onBack: () => void;
  /**
   * Camera tree, keyed by goshala. Optional — when omitted the board fetches
   * it itself via `useCctvBoardData` (goshalas + their latest analysis).
   * Passing this explicitly is mainly useful for tests/storybook.
   */
  groups?: CctvGroup[];
};

export default function CctvMonitoringBoard({
  onBack,
  groups: groupsProp,
}: CctvMonitoringBoardProps) {
  const board = useCctvBoardData();
  const groups = groupsProp ?? board.groups;
  const usingLiveData = groupsProp === undefined;

  const [pages, setPages] = useState<Slot[][]>([[null, null]]);
  const [pinnedCameraId, setPinnedCameraId] = useState<string | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingScrollPage = useRef<number | null>(null);

  // Scroll a freshly created / freshly filled page into view after React
  // has actually rendered it — doing this inside the setState updater would
  // fire before the new section exists in the DOM.
  useEffect(() => {
    if (pendingScrollPage.current === null) return;
    pageRefs.current[pendingScrollPage.current]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    pendingScrollPage.current = null;
  }, [pages]);

  // If a pinned camera ever gets removed from the board, fall back to the
  // normal grid instead of pointing the single-screen view at nothing.
  useEffect(() => {
    if (pinnedCameraId && !pages.flat().some((slot) => slot?.id === pinnedCameraId)) {
      setPinnedCameraId(null);
    }
  }, [pages, pinnedCameraId]);

  // A camera placed on the board is a snapshot of that goshala's last known
  // state. When live data refreshes underneath it (a pull completes, a new
  // count arrives), keep the placed slots in sync rather than freezing them
  // at whatever they looked like the moment they were dropped in.
  //
  // Compared by value (`sameCamera`), not by reference: `groups` is a new
  // array of new objects on every render regardless of whether the data
  // changed, so a reference check here would never agree two renders were
  // "the same" and would set a new `pages` array forever. Returning the
  // exact same `prev` reference when nothing changed is what lets React
  // bail out of re-rendering instead of looping.
  useEffect(() => {
    if (!usingLiveData) return;
    const byId = new Map(groups.flatMap((g) => g.cameras).map((c) => [c.id, c]));
    setPages((prev) => {
      let changed = false;
      const next = prev.map((page) =>
        page.map((slot) => {
          if (!slot) return slot;
          const fresh = byId.get(slot.id);
          if (!fresh || sameCamera(fresh, slot)) return slot;
          changed = true;
          return fresh;
        }),
      );
      return changed ? next : prev;
    });
    // Only `groups` should retrigger this — `usingLiveData` is fixed for the
    // component's lifetime and `pages` is what's being written here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, usingLiveData]);

  // Cameras already on the board, so the sidebar can grey them out instead
  // of letting someone place the same feed in two slots.
  const placedIds = new Set(
    pages
      .flat()
      .filter((slot): slot is CctvCamera => slot !== null)
      .map((camera) => camera.id),
  );

  const pinnedCamera = pinnedCameraId
    ? (pages.flat().find((slot) => slot?.id === pinnedCameraId) ?? null)
    : null;

  function placeCamera(camera: CctvCamera, pageIndex: number, slotIndex: number) {
    setPages((prev) => {
      const next = prev.map((page) => [...page]);
      next[pageIndex][slotIndex] = camera;
      return next;
    });
  }

  function clearSlot(pageIndex: number, slotIndex: number) {
    setPages((prev) => {
      const next = prev.map((page) => [...page]);
      next[pageIndex][slotIndex] = null;
      return next;
    });
  }

  /** Click-to-add fallback: fills the first open slot anywhere on the
   * board, or opens a brand new page underneath everything else. */
  function addCamera(camera: CctvCamera) {
    setPages((prev) => {
      for (let p = 0; p < prev.length; p++) {
        const slotIndex = prev[p].indexOf(null);
        if (slotIndex !== -1) {
          const next = prev.map((page) => [...page]);
          next[p][slotIndex] = camera;
          pendingScrollPage.current = p;
          return next;
        }
      }
      const newPage: Slot[] = [camera, ...Array<Slot>(SLOTS_PER_PAGE - 1).fill(null)];
      pendingScrollPage.current = prev.length;
      return [...prev, newPage];
    });
  }

  /** Pinning a camera swaps the whole board over to a single, full-size
   * view of just that feed — for when you only care about watching one
   * shed right now. Pinning the same camera again un-pins it. */
  function togglePin(camera: CctvCamera) {
    setPinnedCameraId((prev) => (prev === camera.id ? null : camera.id));
  }

  function handleDropOnSlot(
    event: DragEvent<HTMLDivElement>,
    pageIndex: number,
    slotIndex: number,
  ) {
    event.preventDefault();
    const raw = event.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    placeCamera(JSON.parse(raw) as CctvCamera, pageIndex, slotIndex);
  }

  /** Dropping below the last page opens a new one immediately, rather than
   * making the user find an empty slot first. */
  function handleDropNewPage(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const camera = JSON.parse(raw) as CctvCamera;
    setPages((prev) => {
      const newPage: Slot[] = [camera, ...Array<Slot>(SLOTS_PER_PAGE - 1).fill(null)];
      pendingScrollPage.current = prev.length;
      return [...prev, newPage];
    });
  }

  function pullClip(camera: CctvCamera) {
    board.pullClip(camera.id);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F7EF] text-[#1B2A1E] transition-colors dark:bg-[#10160E] dark:text-[#EAF0E4]">
      <CameraTree
        groups={groups}
        placedIds={placedIds}
        pinnedCameraId={pinnedCameraId}
        onSelect={addCamera}
        onBack={onBack}
        isLoading={usingLiveData && board.isLoading}
        isError={usingLiveData && board.isError}
      />

            <div
        className="flex-1 snap-y snap-mandatory overflow-y-auto scroll-smooth [--cctv-overlay:rgba(244,247,239,0.55)] dark:[--cctv-overlay:rgba(16,22,14,0.55)]"
        style={{
          backgroundImage: `linear-gradient(var(--cctv-overlay), var(--cctv-overlay)), url(${bgImage3})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        {usingLiveData && board.isLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[#5B6B58] dark:text-[#93A08C]">
            <FingerprintMark className="h-4 w-4 animate-pulse" />
            Loading goshalas…
          </div>
        ) : usingLiveData && board.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-[#C97A3D] dark:text-[#E0954D]">
            <p>Could not load the goshala list.</p>
            {board.error?.message && (
              <p className="text-xs text-[#9AA593] dark:text-[#5B6B58]">
                {board.error.message}
              </p>
            )}
          </div>
        ) : pinnedCamera ? (
          <PinnedCameraView
            camera={pinnedCamera}
            onBack={() => setPinnedCameraId(null)}
            onPullClip={() => pullClip(pinnedCamera)}
          />
        ) : (
          <>
            {pages.map((page, pageIndex) => (
              <CctvPageSection
                key={pageIndex}
                pageNumber={pageIndex + 1}
                slots={page}
                pageRef={(el) => (pageRefs.current[pageIndex] = el)}
                onDropSlot={(slotIndex, event) => handleDropOnSlot(event, pageIndex, slotIndex)}
                onClearSlot={(slotIndex) => clearSlot(pageIndex, slotIndex)}
                pinnedCameraId={pinnedCameraId}
                onTogglePin={togglePin}
                onPullClip={pullClip}
              />
            ))}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropNewPage}
              className="mx-4 mb-6 flex h-16 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C7D6B9] text-xs text-[#7C8B76] transition-colors hover:border-[#3F7D32] hover:text-[#3F7D32] dark:border-[#2A3524] dark:text-[#5B6B58] dark:hover:border-[#6FBF5B] dark:hover:text-[#6FBF5B]"
            >
              <FingerprintMark className="h-4 w-4" />
              Drag a camera here to open a new page
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar — the draggable / clickable camera tree                    */
/* ------------------------------------------------------------------ */

function CameraTree({
  groups,
  placedIds,
  pinnedCameraId,
  onSelect,
  onBack,
  isLoading,
  isError,
}: {
  groups: CctvGroup[];
  placedIds: Set<string>;
  pinnedCameraId: string | null;
  onSelect: (camera: CctvCamera) => void;
  onBack: () => void;
  isLoading: boolean;
  isError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id)),
  );
  // Collapsed state for the sidebar itself — shrinks to a narrow icon rail
  // and back to the full 16rem panel. Kept local to the tree since nothing
  // outside it needs to know the sidebar's width.
  const [collapsed, setCollapsed] = useState(false);

  // Newly-arrived groups (e.g. once the live fetch resolves) default to open,
  // same as the initial render — otherwise a group fetched in after mount
  // would start collapsed with no way to tell it apart from an empty one.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const group of groups) {
        if (!next.has(group.id)) {
          next.add(group.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [groups]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      cameras: group.cameras.filter((camera) =>
        camera.name.toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((group) => query === "" || group.cameras.length > 0);

  // Collapsed rail: back button, expand toggle, and a vertical strip of
  // camera icons a person can still click (just not drag) to add to the
  // board — so shrinking the sidebar doesn't take away its function.
  if (collapsed) {
    return (
      <aside className="flex w-14 shrink-0 flex-col items-center border-r border-[#DCE5D3] bg-white py-3 dark:border-[#232B1E] dark:bg-[#141B10]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Dashboard"
          className="mb-3 rounded-md p-1.5 text-[#5B6B58] transition-colors hover:bg-[#EEF3E7] hover:text-[#1B2A1E] dark:text-[#93A08C] dark:hover:bg-[#1F2A19] dark:hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="mb-4 rounded-md p-1.5 text-[#3F7D32] transition-colors hover:bg-[#3F7D32]/10 dark:text-[#6FBF5B] dark:hover:bg-[#6FBF5B]/15"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>

        <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
          {groups.flatMap((group) => group.cameras).map((camera) => {
            const placed = placedIds.has(camera.id);
            const pinned = pinnedCameraId === camera.id;
            return (
              <button
                key={camera.id}
                type="button"
                onClick={() => onSelect(camera)}
                title={camera.name}
                aria-label={camera.name}
                className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                  placed
                    ? "bg-[#3F7D32]/10 text-[#3F7D32] dark:bg-[#6FBF5B]/15 dark:text-[#6FBF5B]"
                    : "text-[#5B6B58] hover:bg-[#EEF3E7] hover:text-[#1B2A1E] dark:text-[#93A08C] dark:hover:bg-[#1F2A19] dark:hover:text-white"
                }`}
              >
                <VideoIcon className="h-4 w-4" />
                {pinned && (
                  <PinIcon className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-[#C97A3D] dark:text-[#E0954D]" />
                )}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    // `shrink-0` is load-bearing here: without it, this sidebar would
    // compress whenever the board area to its right needs more room (e.g. a
    // wide pinned view), instead of staying a fixed 16rem strip.
    <aside className="flex w-64 shrink-0 flex-col border-r border-[#DCE5D3] bg-white dark:border-[#232B1E] dark:bg-[#141B10]">
      <div className="border-b border-[#DCE5D3] px-3 py-3 dark:border-[#232B1E]">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-[#5B6B58] transition-colors hover:text-[#1B2A1E] dark:text-[#93A08C] dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="rounded-md p-1 text-[#9AA593] transition-colors hover:bg-[#EEF3E7] hover:text-[#1B2A1E] dark:text-[#5B6B58] dark:hover:bg-[#1F2A19] dark:hover:text-white"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <h1 className="font-heading text-sm font-bold text-[#1B2A1E] dark:text-[#EAF0E4]">
          CCTV Monitoring
        </h1>
        <p className="text-xs text-[#5B6B58] dark:text-[#93A08C]">
          Drag a camera onto the board
        </p>
      </div>

      <div className="relative px-3 py-2">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-6 h-3.5 w-3.5 -translate-y-1/2 text-[#8A9884] dark:text-[#5B6B58]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cameras…"
          className="h-8 border-[#DCE5D3] bg-[#F4F7EF] pl-8 text-xs text-[#1B2A1E] placeholder:text-[#8A9884] focus-visible:border-[#3F7D32] focus-visible:ring-[#3F7D32]/30 dark:border-[#2A3524] dark:bg-[#1B2317] dark:text-[#EAF0E4] dark:placeholder:text-[#5B6B58] dark:focus-visible:border-[#6FBF5B] dark:focus-visible:ring-[#6FBF5B]/30"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[#9AA593] dark:text-[#5B6B58]">
            <FingerprintMark className="h-6 w-6 animate-pulse" />
            <p className="text-xs">Loading…</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[#C97A3D] dark:text-[#E0954D]">
            <FingerprintMark className="h-6 w-6" />
            <p className="text-xs">Could not load cameras.</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[#9AA593] dark:text-[#5B6B58]">
            <FingerprintMark className="h-6 w-6" />
            <p className="text-xs">No cameras yet.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[#38452F] transition-colors hover:bg-[#EEF3E7] dark:text-[#C4D0BC] dark:hover:bg-[#1F2A19]"
              >
                {openGroups.has(group.id) ? (
                  <ChevronDownIcon className="h-3.5 w-3.5 text-[#8A9884] dark:text-[#5B6B58]" />
                ) : (
                  <ChevronRightIcon className="h-3.5 w-3.5 text-[#8A9884] dark:text-[#5B6B58]" />
                )}
                <FolderIcon className="h-3.5 w-3.5 text-[#C97A3D]/80 dark:text-[#E0954D]/80" />
                {group.name}
              </button>

              {openGroups.has(group.id) && (
                <ul className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-[#DCE5D3] pl-2 dark:border-[#232B1E]">
                  {group.cameras.map((camera) => {
                    const placed = placedIds.has(camera.id);
                    const pinned = pinnedCameraId === camera.id;
                    return (
                      <li key={camera.id}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData(DRAG_MIME, JSON.stringify(camera))
                          }
                          onClick={() => onSelect(camera)}
                          className={`flex w-full cursor-grab items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors active:cursor-grabbing ${
                            placed
                              ? "text-[#9AA593] dark:text-[#5B6B58]"
                              : "text-[#38452F] hover:bg-[#EEF3E7] hover:text-[#1B2A1E] dark:text-[#C4D0BC] dark:hover:bg-[#1F2A19] dark:hover:text-white"
                          }`}
                        >
                          <VideoIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{camera.name}</span>
                          {placed && (
                            <span className="ml-auto flex shrink-0 items-center gap-1">
                              {pinned && (
                                <PinIcon className="h-3 w-3 text-[#C97A3D] dark:text-[#E0954D]" />
                              )}
                              <span className="rounded-full bg-[#3F7D32]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#3F7D32] dark:bg-[#6FBF5B]/15 dark:text-[#6FBF5B]">
                                on board
                              </span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  One page — exactly two slots, sized to roughly fill the viewport   */
/* ------------------------------------------------------------------ */

function CctvPageSection({
  pageNumber,
  slots,
  pageRef,
  onDropSlot,
  onClearSlot,
  pinnedCameraId,
  onTogglePin,
  onPullClip,
}: {
  pageNumber: number;
  slots: Slot[];
  pageRef: (el: HTMLDivElement | null) => void;
  onDropSlot: (slotIndex: number, event: DragEvent<HTMLDivElement>) => void;
  onClearSlot: (slotIndex: number) => void;
  pinnedCameraId: string | null;
  onTogglePin: (camera: CctvCamera) => void;
  onPullClip: (camera: CctvCamera) => void;
}) {
  return (
    <section
      ref={pageRef}
      className="flex min-h-[90vh] snap-start flex-col gap-4 border-b border-[#DCE5D3] p-4 dark:border-[#232B1E]"
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#7C8B76] uppercase dark:text-[#5B6B58]">
          Page {pageNumber}
        </p>
        <span className="h-px flex-1 bg-[#DCE5D3] dark:bg-[#232B1E]" />
        <FingerprintMark className="h-3.5 w-3.5 text-[#C7D6B9] dark:text-[#2A3524]" />
      </div>
      <div className="grid flex-1 grid-rows-2 gap-4">
        {slots.map((camera, slotIndex) =>
          camera ? (
            <CctvSlot
              key={camera.id}
              camera={camera}
              onDrop={(e) => onDropSlot(slotIndex, e)}
              onClear={() => onClearSlot(slotIndex)}
              isPinned={camera.id === pinnedCameraId}
              onTogglePin={() => onTogglePin(camera)}
              onPullClip={() => onPullClip(camera)}
            />
          ) : (
            <EmptySlot key={`empty-${slotIndex}`} onDrop={(e) => onDropSlot(slotIndex, e)} />
          ),
        )}
      </div>
    </section>
  );
}

function EmptySlot({
  onDrop,
}: {
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C7D6B9] text-[#9AA593] transition-colors hover:border-[#3F7D32]/50 hover:text-[#3F7D32] dark:border-[#2A3524] dark:text-[#5B6B58] dark:hover:border-[#6FBF5B]/50 dark:hover:text-[#6FBF5B]"
    >
      <FingerprintMark className="h-8 w-8" />
      <p className="text-sm">Drag a camera here, or click one on the left</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared feed body — the annotated pane + count panel + pull-clip    */
/*  control. Used by both the small grid card and the big pinned view. */
/*  Clicking the pane's expand icon zooms into it; clicking it again   */
/*  (or the collapse icon) goes back to the normal layout.             */
/* ------------------------------------------------------------------ */

function CameraFeedBody({
  camera,
  focusedPane,
  onFocusPane,
  onPullClip,
  minPaneHeight = "min-h-40",
}: {
  camera: CctvCamera;
  focusedPane: FocusedPane;
  onFocusPane: (pane: FocusedPane) => void;
  onPullClip: () => void;
  minPaneHeight?: string;
}) {
  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <div className="flex flex-1 flex-col border-[#E1E8D9] sm:border-r dark:border-[#232B1E]">
        <VideoPane
          label="Latest analysed clip"
          icon={ScanEyeIcon}
          src={camera.annotatedStreamUrl}
          isFocused={focusedPane === "annotated"}
          onToggleFocus={() => onFocusPane(focusedPane === "annotated" ? null : "annotated")}
          minHeight={minPaneHeight}
        />
        <div className="flex items-center justify-between gap-2 border-t border-[#E1E8D9] px-2 py-1 dark:border-[#232B1E]">
          <span className="truncate text-[10px] text-[#5B6B58] dark:text-[#8A9884]">
            {camera.lastAnalysedAt
              ? `Analysed ${new Date(camera.lastAnalysedAt).toLocaleString()}`
              : "No analysis yet"}
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={camera.isPulling}
            onClick={onPullClip}
          >
            {camera.isPulling ? "Pulling…" : "Pull new clip"}
          </Button>
        </div>
      </div>
      {focusedPane === null && <CattleCountPanel count={camera.cattleCount} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  A filled grid slot: header (name, pin, remove) + feed body         */
/* ------------------------------------------------------------------ */

function CctvSlot({
  camera,
  onDrop,
  onClear,
  isPinned,
  onTogglePin,
  onPullClip,
}: {
  camera: CctvCamera;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onClear: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onPullClip: () => void;
}) {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>(null);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex flex-col overflow-hidden rounded-xl border border-[#E1E8D9] bg-white shadow-sm dark:border-[#232B1E] dark:bg-[#161D13]"
    >
      <div className="flex items-center justify-between border-b border-[#E1E8D9] px-3 py-1.5 dark:border-[#232B1E]">
        <span className="truncate text-xs font-medium text-[#1B2A1E] dark:text-[#EAF0E4]">
          {camera.name}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={isPinned ? `Unpin ${camera.name}` : `Pin ${camera.name} to a single screen`}
            className={`rounded p-0.5 transition-colors ${
              isPinned
                ? "bg-[#3F7D32]/15 text-[#3F7D32] dark:bg-[#6FBF5B]/15 dark:text-[#6FBF5B]"
                : "text-[#9AA593] hover:bg-[#3F7D32]/10 hover:text-[#3F7D32] dark:text-[#5B6B58] dark:hover:bg-[#6FBF5B]/15 dark:hover:text-[#6FBF5B]"
            }`}
          >
            <PinIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded p-0.5 text-[#9AA593] transition-colors hover:bg-[#C97A3D]/10 hover:text-[#C97A3D] dark:text-[#5B6B58] dark:hover:bg-[#E0954D]/15 dark:hover:text-[#E0954D]"
            aria-label={`Remove ${camera.name} from the board`}
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <CameraFeedBody
        camera={camera}
        focusedPane={focusedPane}
        onFocusPane={setFocusedPane}
        onPullClip={onPullClip}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pinned view — takes over the whole board area with one camera,     */
/*  full size, so you can watch a single shed without the grid.        */
/* ------------------------------------------------------------------ */

function PinnedCameraView({
  camera,
  onBack,
  onPullClip,
}: {
  camera: CctvCamera;
  onBack: () => void;
  onPullClip: () => void;
}) {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>(null);

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-[#3F7D32] transition-colors hover:text-[#2B5A22] dark:text-[#6FBF5B] dark:hover:text-[#86D46B]"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back to board
        </button>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-[#C97A3D] uppercase dark:text-[#E0954D]">
          <PinIcon className="h-3 w-3" />
          Pinned — single screen
        </div>
      </div>

      <h2 className="mb-3 font-heading text-lg font-bold text-[#1B2A1E] dark:text-[#EAF0E4]">
        {camera.name}
      </h2>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#E1E8D9] bg-white shadow-sm dark:border-[#232B1E] dark:bg-[#161D13]">
        <CameraFeedBody
          camera={camera}
          focusedPane={focusedPane}
          onFocusPane={setFocusedPane}
          onPullClip={onPullClip}
          minPaneHeight="min-h-[55vh]"
        />
      </div>
    </div>
  );
}

function VideoPane({
  label,
  icon: Icon,
  src,
  isFocused,
  onToggleFocus,
  minHeight = "min-h-40",
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  src: string | undefined;
  isFocused: boolean;
  onToggleFocus: () => void;
  minHeight?: string;
}) {
  return (
    <div className="relative flex flex-1 flex-col">
      <span className="absolute top-1.5 left-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white uppercase">
        {label}
      </span>
      <button
        type="button"
        onClick={onToggleFocus}
        aria-label={isFocused ? "Show the count panel too" : `Zoom into ${label.toLowerCase()}`}
        className="absolute top-1.5 right-1.5 z-10 rounded bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
      >
        {isFocused ? (
          <Minimize2Icon className="h-3 w-3" />
        ) : (
          <Maximize2Icon className="h-3 w-3" />
        )}
      </button>
      {src ? (
        // Key on the URL so a fresh pull (a new presigned URL) actually
        // reloads the element rather than sitting on the old stream.
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className={`h-full ${minHeight} w-full flex-1 bg-black object-cover`}
        />
      ) : (
        <div
          className={`flex h-full ${minHeight} flex-1 flex-col items-center justify-center gap-1.5 bg-[#0D120A] text-[#3A4A34]`}
        >
          <Icon className="h-8 w-8" />
          <span className="text-[11px] text-[#5B6B58]">No clip yet — pull one below</span>
        </div>
      )}
    </div>
  );
}

function CattleCountPanel({ count }: { count: number | undefined }) {
  return (
    <div className="flex w-full shrink-0 flex-row items-center justify-center gap-2 bg-[#EFF4E8] px-4 py-3 sm:w-36 sm:flex-col sm:gap-1 dark:bg-[#141B10]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C97A3D]/15 text-[#C97A3D] dark:bg-[#E0954D]/15 dark:text-[#E0954D]">
        <span className="text-lg leading-none" role="img" aria-label="Cow">
          🐮
        </span>
      </span>
      <div className="flex flex-col sm:items-center">
        <span className="text-[10px] font-medium tracking-wide text-[#5B6B58] uppercase dark:text-[#8A9884]">
          Total Cattle Observed
        </span>
        <span className="font-heading text-xl font-bold text-[#2B5A22] tabular-nums dark:text-[#6FBF5B]">
          {count === undefined ? "—" : count}
        </span>
      </div>
    </div>
  );
}