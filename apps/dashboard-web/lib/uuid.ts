/**
 * Shared UUID-shape check, used to short-circuit an obviously-malformed id (a typo, a stale
 * bookmark, a bot probing a route) before it ever reaches a network call — `dashboard-api` has no
 * route-level UUID validation of its own on most routes, so without this a garbled value would
 * otherwise reach Postgres and come back as a raw 500 instead of a clean 404/null. Matches the
 * `id`/`publicId` shape every UUID column in this app's schema uses; Postgres accepts either case,
 * so this isn't anchored to a specific UUID version. Extracted here after the identical regex
 * literal had been independently copy-pasted into `lib/projects.ts`, `lib/users.ts`, and
 * `lib/business-knowledge.ts` — all three now import from here instead.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
