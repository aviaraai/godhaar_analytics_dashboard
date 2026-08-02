/**
 * Session length caps, kept deliberately separate from the auth code so the
 * policy is one small file to read, tune or delete.
 *
 * What this is for: Supabase rotates the refresh token indefinitely, so a tab
 * left open on an unattended machine stays signed in forever. These two clocks
 * bound that.
 *
 * What this is *not*: protection against a stolen token. Anyone holding the
 * refresh token talks to Supabase directly and never runs this code. Real
 * revocation is `auth.sessions` server-side, not a timestamp in localStorage.
 */

const STARTED_KEY = "godhaar.session.started";
const SEEN_KEY = "godhaar.session.seen";

/** Signed out after this long without interaction, however active the tab is. */
export const IDLE_MS = 60 * 60 * 1000;

/** Hard ceiling from sign-in, however busy the admin has been. */
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;

/** Writing on every keystroke is pointless when the threshold is an hour. */
const ACTIVITY_WRITE_INTERVAL_MS = 30 * 1000;

let lastActivityWrite = 0;

function read(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** A fresh sign-in: both clocks restart. */
export function beginSession(): void {
  const now = Date.now();
  localStorage.setItem(STARTED_KEY, String(now));
  localStorage.setItem(SEEN_KEY, String(now));
  lastActivityWrite = now;
}

/**
 * A session recovered on page load, or one whose token just refreshed. Fills in
 * missing marks without touching existing ones — resetting here would hand out
 * an unlimited session, since the token refreshes roughly hourly.
 */
export function resumeSession(): void {
  const now = Date.now();
  if (read(STARTED_KEY) === null) localStorage.setItem(STARTED_KEY, String(now));
  if (read(SEEN_KEY) === null) localStorage.setItem(SEEN_KEY, String(now));
}

export function endSession(): void {
  localStorage.removeItem(STARTED_KEY);
  localStorage.removeItem(SEEN_KEY);
  lastActivityWrite = 0;
}

export function markActivity(): void {
  const now = Date.now();
  if (now - lastActivityWrite < ACTIVITY_WRITE_INTERVAL_MS) return;
  lastActivityWrite = now;
  localStorage.setItem(SEEN_KEY, String(now));
}

export type LapseReason = "idle" | "expired";

export function lapsedReason(): LapseReason | null {
  const started = read(STARTED_KEY);
  const seen = read(SEEN_KEY);
  // Nothing recorded means there is nothing to judge — storage cleared beneath
  // us, or a session predating these limits. Throwing a working admin out over
  // a missing number is the worse failure of the two.
  if (started === null || seen === null) return null;

  const now = Date.now();
  if (now - seen > IDLE_MS) return "idle";
  if (now - started > ABSOLUTE_MS) return "expired";
  return null;
}
