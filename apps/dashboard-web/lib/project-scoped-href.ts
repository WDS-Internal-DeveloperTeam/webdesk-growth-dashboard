/**
 * Builds an href to a route within a project-scoped module, always carrying `?projectId=` — every
 * route under a project-scoped module (`page-inventory/projects/:projectId/...`,
 * `keyword-and-entity-library/projects/:projectId/...`) hard-requires it as a real backend path
 * segment, so a link into that module that dropped it would be broken.
 *
 * Extracted here after this exact function (originally declared in `page-inventory-query.ts`) had
 * its second, independent-would-be occurrence needed by
 * `keyword-and-entity-library-query.ts` — the same "extract after the 2nd occurrence" threshold
 * this app's own `lib/uuid.ts`/`lib/search-params.ts`/`lib/list-table-styles.ts`/
 * `lib/list-filter-styles.ts`/`lib/detail-section-styles.ts` were each already extracted at.
 * `page-inventory-query.ts` re-exports this so every existing call site (`page.tsx`,
 * `[pageId]/page.tsx`, `[pageId]/edit/page.tsx`, `page-form.tsx`) is unaffected. Zero non-type
 * imports — safe for a `"use client"` component to import directly.
 */
export function withProjectId(path: string, projectId: string): string {
  const params = new URLSearchParams({ projectId });
  return `${path}?${params.toString()}`;
}
