import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import godhaarLogo from "@/assets/godhaar-logo.png";

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
    <header className="relative overflow-hidden border-b bg-gradient-to-b from-green-50/80 via-white to-white">
      {/* Decorative leaves — purely visual, sit behind the content. */}
      <LeafDecoration className="pointer-events-none absolute -top-6 -left-6 h-40 w-40 text-green-200/70 sm:h-48 sm:w-48" />
      <LeafDecoration className="pointer-events-none absolute -top-6 -right-6 h-40 w-40 -scale-x-100 text-green-200/70 sm:h-48 sm:w-48" />

      {email && (
        <div className="relative mx-auto flex w-full max-w-6xl flex-wrap items-center justify-end gap-2 px-4 pt-3">
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

      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-1 px-4 py-8 text-center">
        <img
          src={godhaarLogo}
          alt="Godhaar"
          className="mb-2 h-24 w-auto sm:h-28"
        />
        <h1 className="font-heading text-2xl font-bold tracking-tight text-balance text-green-800 sm:text-3xl">
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

/** Simple branch-and-leaves motif, drawn with currentColor so it inherits theme. */
function LeafDecoration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10 190C10 190 20 120 60 90C100 60 170 50 190 10C190 10 160 80 130 110C100 140 40 150 10 190Z"
        fill="currentColor"
      />
      <path
        d="M30 170C30 170 50 130 80 115C110 100 140 90 160 60"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M55 150C55 150 65 130 85 122"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M95 105C95 105 108 92 128 84"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}