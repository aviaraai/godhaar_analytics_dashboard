import { useMutation } from "@tanstack/react-query";
import { LogInIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/session";
import Header from "./Header";

type LoginScreenProps = {
  /** Why the last session ended, when it ended on its own rather than by choice. */
  notice?: string;
};

/**
 * Credentials go straight to Supabase; the backend is not involved in signing
 * in and has no auth endpoints at all. There is nothing to do on success — the
 * auth listener behind `useSession` sees the new session and the gate in `App`
 * moves on by itself.
 */
export default function LoginScreen({ notice }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = useMutation({ mutationFn: signIn });

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />

      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!submit.isPending) submit.mutate({ email, password });
          }}
          className="flex w-full flex-col gap-4 rounded-xl border bg-card p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-lg font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              This dashboard is restricted to authorized administrators.
            </p>
          </div>

          {/* Hidden once a sign-in has been attempted: by then the form's own
              error, or the absence of one, is the more current news. */}
          {notice && !submit.isError && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm font-medium">
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
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={submit.isPending}
            />
          </div>

          {submit.isError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {submit.error.message}
            </p>
          )}

          <Button type="submit" disabled={submit.isPending} className="w-full">
            <LogInIcon data-icon="inline-start" />
            {submit.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </main>
    </div>
  );
}
