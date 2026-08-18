import { getApiBaseUrl } from "@/lib/auth";
import styles from "../auth.module.css";

/**
 * Google Workspace SSO is the primary path (ADR-0008); the emergency-admin
 * link below is intentionally de-emphasized, not an equally-weighted
 * alternative (knowledge/05: "Not exposed in the normal login UI as an
 * equally-weighted option alongside SSO"). A plain `<a>` — the actual
 * OAuth redirect (state/PKCE/nonce generation) happens server-side at
 * `dashboard-api`'s `/auth/google/start`, never in client JS.
 *
 * `force-dynamic`: this page reads `NEXT_PUBLIC_API_BASE_URL` — a
 * per-environment runtime value (dashboard-api's real deployed URL, not
 * yet known at this stage), not a build-time constant. Without this,
 * `next build` tries to statically prerender the page and fails whenever
 * that env var isn't set in the build environment itself — same reasoning
 * as `/auth/error`, which is already dynamic because it reads `searchParams`.
 */
export const dynamic = "force-dynamic";

export default function SignInPage() {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>
        <p>
          <a href={`${apiBaseUrl}/auth/google/start`} className={styles.link}>
            Sign in with Google Workspace
          </a>
        </p>
        <p className={styles.secondaryLink}>
          <a href="/auth/emergency" className={styles.link}>
            Emergency administrator access
          </a>{" "}
          — for authorized administrators only, when Google Workspace SSO is unavailable.
        </p>
      </div>
    </main>
  );
}
