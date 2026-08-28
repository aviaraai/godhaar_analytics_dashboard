import { TrendingUpIcon, UsersIcon } from "lucide-react";
import type { AnalyticsTotals } from "@/lib/api";
import LoadingSpinner from "./LoadingSpinner";
import godhaarCount from "@/assets/godhaar_count.png";
import totalFarmer from "@/assets/total_farmer.png";

type TotalsSummaryProps = {
  totals: AnalyticsTotals | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
};

export default function TotalsSummary({
  totals,
  isPending,
  isError,
  onRetry,
}: TotalsSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatCard
        icon={<UsersIcon className="h-6 w-6" />}
        label="Total farmers"
        value={totals?.total_farmers}
        hint="Registered farmers"
        isPending={isPending}
        isError={isError}
        onRetry={onRetry}
        image={totalFarmer}
      />
      <StatCard
        icon={<UsersIcon className="h-6 w-6" />}
        label="Total animals"
        value={totals?.total_animals}
        hint="Animals registered"
        isPending={isPending}
        isError={isError}
        onRetry={onRetry}
        image={godhaarCount}
      />
    </div>
  );
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  hint: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Background photo, right-anchored, fading into the card's own gradient. */
  image?: string;
};

function StatCard({
  icon,
  label,
  value,
  hint,
  isPending,
  isError,
  onRetry,
  image,
}: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-green-50 to-white">
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-full w-auto max-w-[65%] object-contain object-right"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 35%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 35%)",
          }}
        />
      )}

      <div className="relative flex items-start gap-4 p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
          {icon}
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {isPending ? (
            <div className="mt-1">
              <LoadingSpinner label="Loading" />
            </div>
          ) : isError ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-sm text-destructive underline"
            >
              Failed to load — retry
            </button>
          ) : (
            <p className="font-heading text-4xl font-bold text-green-900">
              {value ?? "—"}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1 text-xs text-green-700">
            <TrendingUpIcon className="h-3.5 w-3.5" />
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}