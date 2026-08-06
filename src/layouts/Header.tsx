import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type HeaderProps = {
  /** Omitted on the login screen, where there is nobody to sign out. */
  email?: string;
  onSignOut?: () => void;
  signingOut?: boolean;
  /** Overridden by the debug screens, which are a different tool. */
  title?: string;
  description?: string;
  /** Navigation, rendered under the title once there is more than one screen. */
  children?: React.ReactNode;
};

export default function Header({
  email,
  onSignOut,
  signingOut,
  title = "Godhaar Analytics Dashboard",
  description = "Farmer and animal registration totals per field user.",
  children,
}: HeaderProps) {
  return (
    <header className="border-b bg-card">
      {email && (
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-end gap-2 px-4 pt-3">
          <span className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium">{email}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            disabled={signingOut}
          >
            <LogOutIcon data-icon="inline-start" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      )}

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1 px-4 py-8 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-balance text-muted-foreground">
          {description}
        </p>
        {children && <div className="pt-4">{children}</div>}
      </section>
    </header>
  );
}
