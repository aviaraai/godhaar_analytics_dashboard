import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";

type HeaderProps = {
  /**
   * Presence of an email is what "signed in" means to this component. When
   * it is absent — the login screen, or the loading `Shell` before the SDK
   * has read storage — there is no account to show a menu for, so none is
   * rendered. There is no separate boolean for this on purpose: a signed-in
   * account always has an email (see `useSession`), so the two facts can't
   * drift apart.
   */
  email?: string;
  onSignOut?: () => void;
  signingOut?: boolean;
  title?: string;
};

/** Compact top bar — logo mark, page name, and (only once signed in) an
 * avatar menu with a logout option. */
export default function Header({
  email,
  onSignOut,
  signingOut,
  title = "Dashboard",
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleConfirmSignOut = () => {
    setMenuOpen(false);
    onSignOut?.();
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b bg-linear-to-r from-green-50 via-green-50/50 to-white px-4 py-3 md:px-8">
      <div className="flex items-center gap-2">
        <span className="font-heading text-lg font-semibold text-green-900">
          Godhaar
        </span>
        <span className="text-lg font-medium text-muted-foreground">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
          <span className="text-2xl leading-none">🐄</span>
          Unique Identification for Livestock
        </div>

        {/* Nothing to show an account menu for until someone is actually
            signed in — a login screen or a loading spinner has no session to
            log out of. */}
        {email && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={signingOut}
              title={`Signed in as ${email}`}
              className="flex items-center gap-1.5 rounded-full border bg-white px-1.5 py-1 pr-2 text-sm disabled:opacity-60"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-800">
                {email.slice(0, 2).toUpperCase()}
              </span>
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border bg-white p-1 shadow-lg">
                <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                  Signed in as
                  <div className="truncate font-medium text-foreground">{email}</div>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmSignOut}
                  disabled={signingOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  <LogOutIcon className="h-4 w-4" />
                  {signingOut ? "Signing out..." : "Log out"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}