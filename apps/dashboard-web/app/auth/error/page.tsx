/**
 * Landed on after a rejected `/auth/google/callback` (knowledge/05: reject
 * a login "without leaking to the rejected user *which* check failed").
 * Only two safe, known `reason` values get a specific-but-still-generic
 * message; anything else (including a `reason` this page has never heard
 * of) falls back to one identical generic message — the internal rejection
 * reason recorded in `auth_events` (domain_not_allowed,
 * no_matching_active_user, etc.) is never echoed into this page.
 */
const REASON_MESSAGES: Record<string, string> = {
  access_denied: "We couldn't sign you in with that Google account.",
  expired: "Your sign-in attempt expired. Please try again.",
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
    <main style={{ padding: "2rem", maxWidth: 420 }}>
      <h1>Sign-in failed</h1>
      <p>{message}</p>
      <p>
        <a href="/auth/sign-in">Try again</a>
      </p>
    </main>
  );
}
