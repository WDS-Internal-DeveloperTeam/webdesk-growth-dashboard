/**
 * `dashboard-web` never handles OAuth tokens or the session cookie's
 * contents directly (docs/contracts/google-workspace-auth-contract.md
 * "Trust boundary") — every call here is a plain cross-origin request to
 * `dashboard-api` with `credentials: "include"`, relying on the browser to
 * carry the httpOnly session cookie. `NEXT_PUBLIC_API_BASE_URL` is read via
 * `process.env` directly (not `@/lib/env`'s Zod-validated getter) because
 * Next.js inlines `NEXT_PUBLIC_*` values at build time only when referenced
 * this way — a runtime import would not work in client components.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }
  return url;
}
