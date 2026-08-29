import { BarChart3Icon, BugIcon, VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import godhaarLogo from "@/assets/godhaar-logo.png";
import godhaarFarmBg from "@/assets/godhaar.png";
import type { NavTabItem } from "./NavTabs";

type SidebarProps = {
  items: NavTabItem[];
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: BarChart3Icon,
  debug: BugIcon,
  cctv: VideoIcon,
};

/**
 * Left rail: logo, vertical nav, and a decorative farm-scene card pinned to
 * the bottom. `sticky top-0` with its own `h-svh` keeps it fixed in the
 * viewport as the main content scrolls past it. The illustration sits above
 * a solid dark-green text panel, and the seam between the two is a single
 * curve (one SVG arc) pulled up to overlap the image directly, so there is no
 * gap between the picture and the panel. The leaf badge sits centered close
 * above the tagline, in its own soft circle. Hidden below `md` — the app
 * falls back to no sidebar on small screens rather than an overlay drawer,
 * since none of the current nav targets warrant that complexity yet.
 */
export default function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-y-auto border-r bg-white md:flex">
      <div className="flex flex-col items-center gap-1 border-b px-6 py-8">
        <img src={godhaarLogo} alt="Godhaar" className="h-20 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {items.map((item) => {
          const Icon = ICONS[item.key] ?? BarChart3Icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onSelect}
              className={cn(
                "flex items-center gap-3 rounded-r-lg rounded-l-sm border-l-4 px-3 py-2.5 text-left text-sm font-medium transition-colors",
                item.active
                  ? "border-green-600 bg-green-50 text-green-800"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-3">
        <div className="relative overflow-hidden rounded-3xl">
          {/* Illustration, full brightness. */}
          <div
            className="h-40 bg-cover bg-top"
            style={{ backgroundImage: `url(${godhaarFarmBg})` }}
          />

          {/* Curved seam: a single SVG arc, pulled up to overlap the image
              directly so there is no gap between the two. */}
          <svg
            viewBox="0 0 300 40"
            preserveAspectRatio="none"
            className="-mt-8 block h-8 w-full"
          >
            <path
              d="M0,40 L0,20 Q150,-20 300,20 L300,40 Z"
              className="fill-green-800"
            />
          </svg>

          {/* Solid dark-green panel carrying the text. */}
          <div className="-mt-px flex flex-col items-center bg-gradient-to-b from-green-800 to-green-950 px-5 pb-6 pt-1 text-center text-white">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg leading-none">
              <span role="img" aria-label="Farmer">
                🧑🏻‍🌾
              </span>
            </span>
            <p className="font-heading text-lg font-semibold leading-snug">
              Smart tracking.
              <br />
              Stronger farming.
            </p>
            <p className="mt-2 text-xs text-green-100/90">
              Empowering farmers with real-time insights.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}