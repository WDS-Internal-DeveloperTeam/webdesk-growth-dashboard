import styles from "../auth.module.css";

/**
 * Landed on after a rejected `/auth/google/callback` (knowledge/05: reject
 * a login "without leaking to the rejected user *which* check failed").
 * Only three safe, known `reason` values get a specific-but-still-generic
 * message; anything else (including a `reason` this page has never heard
 * of) falls back to one identical generic message — the internal rejection
 * reason recorded in `auth_events` (domain_not_allowed,
 * no_matching_active_user, etc.) is never echoed into this page.
 *
 * `expired` is reserved for a genuinely expired/invalid state (the OIDC
 * transaction cookie, or the session-exchange code itself) — `error` is a
 * real backend/network failure, not an expiry. Conflating the two here
 * masked a real Postgres error as "expired" during a 2026-08-19 production
 * incident (see docs/implementation/session-exchange.md), so the two
 * callers of this page (`GoogleAuthController#callback` in `dashboard-api`
 * and this app's own `/auth/exchange` route) now distinguish them.
 */
const REASON_MESSAGES: Record<string, string> = {
  access_denied: "We couldn't sign you in with that Google account.",
  expired: "Your sign-in attempt expired. Please try again.",
  error: "Something went wrong while signing you in.",
};
const DEFAULT_MESSAGE = "Something went wrong while signing you in.";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && REASON_MESSAGES[reason]) ?? DEFAULT_MESSAGE;

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
