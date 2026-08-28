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
      default:
        // Supabase's own wording, which is written for end users and is more
        // specific than anything generic we could substitute.
        return error.message;
    }
  }

  return "Could not sign in. Please try again.";
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

export async function signOut(): Promise<void> {
  endSession();
  await auth.signOut();
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

  useEffect(() => {
    const { data } = auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        // Covers INITIAL_SESSION on a cold load and TOKEN_REFRESHED an hour in;
        // both need marks present, neither may reset them.
        resumeSession();
        setNotice(undefined);
      }
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

  const roles = rolesOf(session);

  return {
    status: "signed-in",
    email: session.user.email ?? "",
    roles,
    isAdmin: roles.includes("admin"),
    isDeveloper: roles.includes("developer"),
  };
}
