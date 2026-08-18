/**
 * Displays the raw stored UTC timestamp, not localized — see the Project Detail page's own note
 * on why (real timezone confirmation is still an open item). Shared by the Projects list, detail,
 * and now Team roster pages.
 *
 * Lives in its own file with zero other imports, rather than in `lib/projects.ts` where it
 * originated, so a `"use client"` component (`ProjectTeamSection`) can import the real function
 * directly without pulling in `lib/projects.ts`'s `next/headers` import — a value import of
 * anything from that module drags in the whole module, and `next/headers` is
 * Server-Component-only, so Next.js fails the client bundle otherwise. `lib/projects.ts`
 * re-exports this so every existing server-side call site is unaffected.
 */
export function formatTimestamp(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}
