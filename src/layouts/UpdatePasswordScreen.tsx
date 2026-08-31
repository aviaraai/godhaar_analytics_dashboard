import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePassword } from "@/lib/session";
import Header from "./Header";
import bgImage from "@/assets/bg_image1.jpg";

type UpdatePasswordScreenProps = {
  /** The address the recovery link was sent to, shown so the person can
   * confirm they're setting the password for the right account. */
  email: string;
  /**
   * Called once the password is actually changed. The caller (`App`) is the
   * one that signs the recovery session out and returns to `LoginScreen` —
   * this component only owns the form, not what happens to the session
   * after, same division as `LoginScreen` not owning navigation.
   */
  onComplete: () => void;
};

/**
 * Reached only via `useSession` reporting `password-recovery` — that is,
 * only after clicking a valid reset-password email link. There is no other
 * way into this screen and no link to it anywhere in the normal UI.
 */
export default function UpdatePasswordScreen({
  email,
  onComplete,
}: UpdatePasswordScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = useMutation({
    mutationFn: updatePassword,
    onSuccess: onComplete,
  });

  const mismatched = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-svh flex-col">
        <Header />

        <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (submit.isPending || mismatched) return;
              submit.mutate(password);
            }}
            className="flex w-full flex-col gap-4 rounded-xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-lg font-semibold text-white">
                Choose a new password
              </h2>
              <p className="text-sm text-white/80">
                Setting a new password for <strong>{email}</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-white">
                New password
              </label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                autoFocus
                minLength={6}
                required
                disabled={submit.isPending}
                className="border-white/30 bg-white/90"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-new-password" className="text-sm font-medium text-white">
                Confirm new password
              </label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                disabled={submit.isPending}
                aria-invalid={mismatched ? true : undefined}
                className="border-white/30 bg-white/90"
              />
              {mismatched && (
                <p className="text-xs text-red-100">Passwords do not match.</p>
              )}
            </div>

            {submit.isError && (
              <p
                role="alert"
                className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-red-100"
              >
                {submit.error.message}
              </p>
            )}

            <Button type="submit" disabled={submit.isPending || mismatched} className="w-full">
              <KeyRoundIcon data-icon="inline-start" />
              {submit.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
}
