import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type Session,
} from "@supabase/auth-js";
import { useEffect, useState } from "react";
import {
  beginSession,
  endSession,
  lapsedReason,
  markActivity,
  resumeSession,
} from "./session-limits";
import { auth } from "./supabase";

/** How often the caps are re-checked while a tab is open. */
const SWEEP_INTERVAL_MS = 60 * 1000;

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out"; notice?: string }
  /**
   * Reached only by clicking a password-reset email link, never by signing in
   * normally. Supabase marks this with its own `PASSWORD_RECOVERY` auth event
   * even though a real session is attached — the two look the same on the
   * wire, so this app has to tell them apart itself, or a reset link would
   * just quietly sign the visitor into the dashboard with a fresh session,
   * skip the "choose a new password" step, and lose the point of the link
   * being here at all.
   */
  | { status: "password-recovery"; email: string }
  | {
      status: "signed-in";
      email: string;
      /** The raw claim, kept so unrecognised roles can be named on screen. */
      roles: string[];
      isAdmin: boolean;
      isDeveloper: boolean;
    };

/** The only state that gets past the gate, and the one the shell is built for. */
export type SignedIn = Extract<SessionState, { status: "signed-in" }>;

/**
 * The two screens the app can show a signed-in account — chosen by internal
 * state, never by URL. There is no address bar involvement in getting here.
 */
export type Section = "dashboard" | "debug" | "cctv";

/**
 * Where this account lands when it has not asked for anywhere in particular.
 * `null` means nowhere — authentication succeeded and there is still nothing
 * here for them, which is the ordinary outcome for a field user.
 */
export function defaultSectionFor(session: SignedIn): Section | null {
  if (session.isAdmin) return "dashboard";
  if (session.isDeveloper) return "debug";
  return null;
}

export type Credentials = {
  email: string;
  password: string;
};

/**
 * The role marker. It lives in `app_metadata`, which only the service-role key
 * can write — `user_metadata` is writable by whoever holds the session, so
 * putting the role there would let any mobile user promote themselves with one
 * SDK call and no visible symptom.
 *
 * This is a rendering decision only. The same claim is checked again by the Go
 * middleware, which is where it actually counts: `admin` for the analytics and
 * CCTV endpoints, `developer` for `/debug/*`.
 *
 * A list, and not a hierarchy — neither role contains the other, so an admin
 * cannot see the debug screens and a developer cannot see the analytics. Both
 * questions are asked independently, which is also what makes holding both
 * roles at once work without any further special-casing.
 *
 * The key is `app_roles` and the shape is an array, both fixed by the Go
 * middleware: it reads `claims["app_metadata"]["app_roles"]` and type-asserts it
 * to a slice. A bare string fails that assertion and authorizes nobody, so it is
 * rejected here too — this gate exists to predict the backend's answer, and
 * being more permissive than the API only buys a screen that renders and then
 * 403s on every request it makes.
 */
function rolesOf(session: Session): string[] {
  const roles = session.user.app_metadata?.app_roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((value): value is string => typeof value === "string");
}

/**
 * Turns an SDK error into something worth showing a person. The distinction
 * that matters most is "we never got an answer" versus "the answer was no" —
 * the SDK's own wording for the former is the browser's raw `Failed to fetch`.
 */
function describeAuthError(error: unknown): string {
  // Transport failure, or a 5xx from Supabase's edge. Either way the request
  // never reached a verdict, so it says nothing about the password.
  if (isAuthRetryableFetchError(error)) {
    return "Could not reach the authentication service. Check your connection and try again.";
  }

  if (isAuthApiError(error)) {
    if (error.status === 429) {
      return "Too many attempts. Please wait a minute and try again.";
    }
    switch (error.code) {
      case "invalid_credentials":
        return "Incorrect email or password.";
      case "email_not_confirmed":
        return "This account's email address has not been confirmed.";
      case "user_banned":
        return "This account has been disabled.";
      case "user_already_exists":
        return "An account with this email already exists.";
      case "weak_password":
        return "That password is too weak. Try a longer or less predictable one.";
      case "same_password":
        return "That's your current password. Choose a different one.";
      default:
        // Supabase's own wording, which is written for end users and is more
        // specific than anything generic we could substitute.
        return error.message;
    }
  }

  return "Could not complete that request. Please try again.";
}

export async function signIn(credentials: Credentials): Promise<void> {
  const { error } = await auth.signInWithPassword(credentials);
  // `cause` keeps the original reachable from devtools; the message is the
  // only part the login screen renders.
  if (error) throw new Error(describeAuthError(error), { cause: error });
  // Only here, never in the auth-state listener: that listener also fires on
  // reload and on every token refresh, and restarting the clock there would
  // quietly make the absolute cap unreachable.
  beginSession();
}

export type SignUpResult = {
  /**
   * True when Supabase requires the address to be confirmed before a session
   * exists — `data.session` comes back null in that case, there is nothing
   * signed in yet, and the form has to say so rather than sitting quietly.
   */
  confirmationRequired: boolean;
};

/**
 * Creates the Supabase auth user. Nothing about `app_metadata.app_roles` is
 * decided here — that field is only ever set by the service-role key from
 * outside this app — so a freshly signed-up account has no role at all until
 * an administrator grants one. `useSession`/`defaultSectionFor` already treat
 * a roleless account as "nowhere to go", which is deliberately what a brand
 * new sign-up sees until it's approved.
 */
export async function signUp(credentials: Credentials): Promise<SignUpResult> {
  const { data, error } = await auth.signUp(credentials);
  if (error) throw new Error(describeAuthError(error), { cause: error });

  if (data.session) {
    // Same reasoning as `signIn`: a real session started here, so the same
    // clock has to start here too, or the absolute cap silently never applies
    // to accounts that arrived via sign-up instead of sign-in.
    beginSession();
    return { confirmationRequired: false };
  }
  return { confirmationRequired: true };
}

export async function signOut(): Promise<void> {
  endSession();
  await auth.signOut();
}

/**
 * Sends the "reset your password" email. Always resolves the same way on
 * success regardless of whether the address has an account — Supabase itself
 * does not distinguish the two cases in its response, and echoing that here
 * avoids using this form to probe which emails are registered.
 */
export async function resetPassword(email: string): Promise<void> {
  const { error } = await auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });
  if (error) throw new Error(describeAuthError(error), { cause: error });
}

/**
 * Sets a new password on the session created by a recovery link. Only valid
 * while `useSession` reports `password-recovery` — the recovery link's
 * session is what `updateUser` acts on here.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await auth.updateUser({ password: newPassword });
  if (error) throw new Error(describeAuthError(error), { cause: error });
}

/** The bearer token for the next backend call, or `null` if nobody is signed in. */
export async function accessToken(): Promise<string | null> {
  const { data } = await auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Auth state as a subscription rather than a request. There is no `/me` to
 * call: the token is in this browser, so who is signed in — and whether they
 * are an admin — is answerable locally and instantly.
 */
export function useSession(): SessionState {
  // `undefined` while the SDK is still reading storage, `null` once it has and
  // found nothing. The two look identical without the distinction, and showing
  // a login form for a moment to someone already signed in is the visible cost.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  // Set only by the `PASSWORD_RECOVERY` event, never inferred from the
  // session shape itself — a recovery session and an ordinary one are
  // otherwise indistinguishable from here.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const { data } = auth.onAuthStateChange((event, next) => {
      setSession(next);

      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        return;
      }

      if (next) {
        // Covers INITIAL_SESSION on a cold load and TOKEN_REFRESHED an hour in;
        // both need marks present, neither may reset them.
        resumeSession();
        setNotice(undefined);
      }
      // Any event other than PASSWORD_RECOVERY closes recovery mode — most
      // importantly SIGNED_OUT once the update-password screen finishes, but
      // also guards against a stale flag surviving into a later, ordinary
      // sign-in in the same tab.
      setRecovering(false);
    });
    // Fires INITIAL_SESSION on subscribe, so the cold-load case needs no
    // separate getSession() call — it arrives through this same path.
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const sweep = () => {
      const reason = lapsedReason();
      if (!reason) return;
      setNotice(
        reason === "idle"
          ? "You were signed out after a period of inactivity."
          : "Your session reached its time limit. Please sign in again.",
      );
      // Deliberately outside the onAuthStateChange callback — calling back into
      // the auth client from inside its own listener can deadlock it.
      void signOut();
    };

    const touch = () => markActivity();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Order matters: a machine asleep for three hours fires no interval, so
      // judge the gap *before* counting this return to the tab as activity.
      sweep();
      touch();
    };

    sweep();
    const timer = window.setInterval(sweep, SWEEP_INTERVAL_MS);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session]);

  if (session === undefined) return { status: "loading" };
  if (session === null) return { status: "signed-out", notice };
  if (recovering) return { status: "password-recovery", email: session.user.email ?? "" };

  const roles = rolesOf(session);

  return {
    status: "signed-in",
    email: session.user.email ?? "",
    roles,
    isAdmin: roles.includes("admin"),
    isDeveloper: roles.includes("developer"),
  };
}