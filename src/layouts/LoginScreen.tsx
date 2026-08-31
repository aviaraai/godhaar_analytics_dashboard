import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon, LogInIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword, signIn, signUp } from "@/lib/session";
import Header from "./Header";
import bgImage from "@/assets/bg_image1.jpg";

type LoginScreenProps = {
  /** Why the last session ended, when it ended on its own rather than by choice. */
  notice?: string;
};

type Mode = "signin" | "signup" | "forgot";

/**
 * Credentials go straight to Supabase; the backend is not involved in signing
 * in and has no auth endpoints at all. There is nothing to do on success — the
 * auth listener behind `useSession` sees the new session and the gate in `App`
 * moves on by itself.
 *
 * Sign-up creates the Supabase user only — it grants no role. A brand new
 * account lands on whatever `defaultSectionFor` shows a roleless session
 * (nowhere, today), until an administrator grants `admin` or `developer` from
 * outside this app. That's why the copy below doesn't promise dashboard access
 * on its own, and why a successful sign-up doesn't try to route anywhere.
 */
export default function LoginScreen({ notice }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const signInMutation = useMutation({ mutationFn: signIn });
  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: (result, credentials) => {
      if (result.confirmationRequired) {
        setConfirmationSentTo(credentials.email);
      }
      // When confirmation is not required, `signUp` already called
      // `beginSession()` and the auth listener will pick the new session up
      // on its own — nothing further to do here.
    },
  });
  const resetMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: (_result, sentToEmail) => setResetSentTo(sentToEmail),
  });

  const submit =
    mode === "signin" ? signInMutation : mode === "signup" ? signUpMutation : resetMutation;
  const passwordsMismatched =
    mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword;

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setConfirmationSentTo(null);
    setResetSentTo(null);
    signInMutation.reset();
    signUpMutation.reset();
    resetMutation.reset();
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* Full-bleed backdrop, dimmed so the glass card and its text stay readable. */}
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
              if (submit.isPending) return;
              if (mode === "signup") {
                if (passwordsMismatched) return;
                signUpMutation.mutate({ email, password });
              } else if (mode === "forgot") {
                resetMutation.mutate(email);
              } else {
                signInMutation.mutate({ email, password });
              }
            }}
            className="flex w-full flex-col gap-4 rounded-xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-lg font-semibold text-white">
                {mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Reset password"}
              </h2>
              <p className="text-sm text-white/80">
                {mode === "signin"
                  ? "Sign in with your administrator or developer account."
                  : mode === "signup"
                    ? "New accounts get dashboard access once an administrator grants it."
                    : "Enter your email and we'll send you a reset link."}
              </p>
            </div>

            {/* Hidden once a sign-in has been attempted: by then the form's own
                error, or the absence of one, is the more current news. */}
            {notice && mode === "signin" && !submit.isError && (
              <p className="rounded-md bg-white/15 px-3 py-2 text-sm text-white/90">
                {notice}
              </p>
            )}

            {mode === "signup" && confirmationSentTo ? (
              <p className="rounded-md bg-white/15 px-3 py-2 text-sm text-white/90">
                We sent a confirmation link to <strong>{confirmationSentTo}</strong>.
                Confirm your address, then sign in once an administrator has
                granted access.
              </p>
            ) : mode === "forgot" && resetSentTo ? (
              <p className="rounded-md bg-white/15 px-3 py-2 text-sm text-white/90">
                We sent a password reset link to <strong>{resetSentTo}</strong>.
                Click the link in your inbox to choose a new password.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-email" className="text-sm font-medium text-white">
                    Email
                  </label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={submit.isPending}
                    className="border-white/30 bg-white/90"
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-password" className="text-sm font-medium text-white">
                      Password
                    </label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      minLength={mode === "signup" ? 6 : undefined}
                      required
                      disabled={submit.isPending}
                      className="border-white/30 bg-white/90"
                    />
                  </div>
                )}

                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="self-end text-xs font-medium text-white/80 underline underline-offset-2 hover:text-white"
                  >
                    Forgot password?
                  </button>
                )}

                {mode === "signup" && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="login-confirm-password"
                      className="text-sm font-medium text-white"
                    >
                      Confirm password
                    </label>
                    <Input
                      id="login-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      disabled={submit.isPending}
                      aria-invalid={passwordsMismatched ? true : undefined}
                      className="border-white/30 bg-white/90"
                    />
                    {passwordsMismatched && (
                      <p className="text-xs text-red-100">Passwords do not match.</p>
                    )}
                  </div>
                )}
              </>
            )}

            {submit.isError && (
              <p
                role="alert"
                className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-red-100"
              >
                {submit.error.message}
              </p>
            )}

            {!(mode === "signup" && confirmationSentTo) && !(mode === "forgot" && resetSentTo) && (
              <Button
                type="submit"
                disabled={submit.isPending || passwordsMismatched}
                className="w-full"
              >
                {mode === "signin" && (
                  <>
                    <LogInIcon data-icon="inline-start" />
                    {submit.isPending ? "Signing in…" : "Sign in"}
                  </>
                )}
                {mode === "signup" && (
                  <>
                    <UserPlusIcon data-icon="inline-start" />
                    {submit.isPending ? "Creating account…" : "Create account"}
                  </>
                )}
                {mode === "forgot" && (
                  <>
                    <KeyRoundIcon data-icon="inline-start" />
                    {submit.isPending ? "Sending…" : "Send reset link"}
                  </>
                )}
              </Button>
            )}

            <p className="text-center text-sm text-white/80">
              {mode === "signin" && (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="font-medium text-white underline underline-offset-2"
                  >
                    Create one
                  </button>
                </>
              )}
              {mode === "signup" && (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-medium text-white underline underline-offset-2"
                  >
                    Sign in
                  </button>
                </>
              )}
              {mode === "forgot" && (
                <>
                  Remembered your password?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-medium text-white underline underline-offset-2"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}