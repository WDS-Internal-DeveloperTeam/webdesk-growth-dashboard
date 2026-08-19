import type { AuthErrorReason } from "@webdesk/shared-types";
import styles from "../auth.module.css";

/**
 * Landed on after a rejected `/auth/google/callback` (knowledge/05: reject
 * a login "without leaking to the rejected user *which* check failed").
 * Only the safe, known `reason` values in the shared `AuthErrorReason` union
 * get a specific-but-still-generic message; anything else (including a
 * `reason` this page has never heard of) falls back to one identical
 * generic message — the internal rejection reason recorded in `auth_events`
 * (domain_not_allowed, no_matching_active_user, etc.) is never echoed into
 * this page.
 *
 * `REASON_MESSAGES` is typed `Record<AuthErrorReason, string>` (not
 * `Record<string, string>`) so this file won't compile if a new reason is
 * ever added to the shared union without a matching message here — closing
 * the drift risk that let `GoogleAuthController#callback` (`dashboard-api`)
 * and this app's own `/auth/exchange` route independently agree on the
 * reason set by convention only, which is what let a real Postgres error
 * get mislabeled "expired" during a 2026-08-19 production incident (see
 * docs/implementation/session-exchange.md). `expired` is reserved for a
 * genuinely expired/invalid state (the OIDC transaction cookie, or the
 * session-exchange code itself) — `error` is a real backend/network
 * failure, not an expiry.
 */
const DEFAULT_MESSAGE = "Something went wrong while signing you in.";
const REASON_MESSAGES: Record<AuthErrorReason, string> = {
  access_denied: "We couldn't sign you in with that Google account.",
  expired: "Your sign-in attempt expired. Please try again.",
  error: DEFAULT_MESSAGE,
};

/**
 * `Object.hasOwn`, not the `in` operator — `in` walks the prototype chain, so a `reason` value
 * that happens to match an inherited `Object.prototype` key (`constructor`, `toString`, etc.)
 * would otherwise pass this guard and resolve to a function value on the lookup below, crashing
 * this page's render.
 */
function isKnownReason(value: string): value is AuthErrorReason {
  return Object.hasOwn(REASON_MESSAGES, value);
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  let message = DEFAULT_MESSAGE;
  if (reason) {
    if (isKnownReason(reason)) {
      message = REASON_MESSAGES[reason];
    } else {
      // Logged, not just silently shown as DEFAULT_MESSAGE — a reason value neither app's build
      // recognizes is exactly what cross-deploy drift between dashboard-api and dashboard-web
      // (two independently-deployed Vercel projects) would look like, and the shared
      // AuthErrorReason type only guarantees same-commit agreement, not same-real-time-deployed
      // agreement. Without this, that event would be as invisible as the one that caused the
      // 2026-08-19 incident this whole reason taxonomy exists to make diagnosable.
      console.error(`auth/error: received unrecognized reason "${reason}"`);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign-in failed</h1>
        <p className={styles.body}>{message}</p>
        <p>
          <a href="/auth/sign-in" className={styles.link}>
            Try again
          </a>
        </p>
      </div>
    </main>
  );
}
