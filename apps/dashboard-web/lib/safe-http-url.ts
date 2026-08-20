/**
 * Guards a stored URL before it's ever rendered as a clickable `<a href>`. The backend's own
 * validation (`safeHttpUrlSchema`, `packages/validation`) already restricts `ProjectEnvironment.url`
 * to `http:`/`https:` server-side, but this client-side guard stays in place as defense-in-depth
 * for any value stored before that schema existed. `http:`/`https:` are the only schemes this app
 * ever intends to link to, so anything else is rendered as inert text instead.
 *
 * Lives in its own file with zero other imports, rather than in `lib/projects.ts` where it
 * originated, so `"use client"` components (`ProjectEnvironmentsSection`) can import the real
 * function directly without pulling in `lib/projects.ts`'s `next/headers` import — a value import
 * of anything from that module drags in the whole module, and `next/headers` is
 * Server-Component-only, so Next.js fails the client bundle otherwise. `lib/projects.ts`
 * re-exports this so every existing server-side call site is unaffected — same precedent as
 * `lib/format-timestamp.ts`.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
