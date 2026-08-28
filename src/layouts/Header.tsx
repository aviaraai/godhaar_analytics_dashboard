import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, LeafIcon, LogOutIcon } from "lucide-react";

type HeaderProps = {
  email?: string;
  onSignOut?: () => void;
  signingOut?: boolean;
  title?: string;
};

/** Compact top bar — logo mark, page name, avatar menu with logout confirmation. */
export default function Header({
  email,
  onSignOut,
  signingOut,
  title = "Dashboard",
}: HeaderProps) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "AD";
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
    <header className="flex items-center justify-between gap-4 border-b bg-gradient-to-r from-green-50 via-green-50/50 to-white px-4 py-3 md:px-8">
      <div className="flex items-center gap-2">
        <LeafIcon className="h-5 w-5 text-green-700" />
        <span className="font-heading text-lg font-semibold text-green-900">
          Godhaar
        </span>
        <span className="text-lg font-medium text-muted-foreground">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
          <LeafIcon className="h-4 w-4 text-green-600" />
          Unique Identification for Livestock
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            disabled={signingOut}
            title={email ? `Signed in as ${email}` : "Account"}
            className="flex items-center gap-1.5 rounded-full border bg-white px-1.5 py-1 pr-2 text-sm disabled:opacity-60"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-800">
              {initials}
            </span>
            <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border bg-white p-1 shadow-lg">
              {email && (
                <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                  Signed in as
                  <div className="truncate font-medium text-foreground">{email}</div>
                </div>
              )}
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
      </div>
    </header>
  );
}