import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

export type NavTabItem = {
  to: string;
  label: string;
  /** Match the path exactly, for a parent route that also has children. */
  end?: boolean;
};

/**
 * Navigation that looks like the `Tabs` control the dashboard already uses, but
 * is made of real links: these switch screens rather than panels, so they need
 * to be addressable, openable in a new tab and survivable across a reload.
 *
 * Rendering nothing for a single destination is deliberate — a tab strip with
 * one tab tells the reader there is somewhere else to go when there is not.
 */
export default function NavTabs({ items }: { items: NavTabItem[] }) {
  if (items.length < 2) return null;

  return (
    <nav className="inline-flex h-8 w-fit items-center justify-center rounded-lg bg-muted p-[3px]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "inline-flex h-full items-center justify-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-muted-foreground dark:hover:text-foreground",
              isActive &&
                "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30 dark:text-foreground",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
