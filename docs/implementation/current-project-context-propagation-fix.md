# Current-project context propagation — fix

## Scope

Closes the "current project" context propagation gap this project first
scoped and deliberately deferred on 2026-08-20, then re-confirmed as still
deferred on 2026-08-22 (see `CLAUDE.md`'s "Recent decisions" for both
entries). At the time, no second real consumer existed beyond the header
Project Switcher pre-selecting its own dropdown. That has since changed —
seven `dashboard-web` routes (Page Inventory, Scan Center, Technical
Center, Change Center, Internal Linking Library, Keyword & Entity Library
— both its keywords and entities routes — and Page Workspace) are all
genuinely project-scoped and each independently grew its own in-page
project picker, reachable via `?projectId=` in the URL.

Not started automatically — built directly after the user pointed at a
live screenshot of the Technical Center page and said the in-page project
selector was "useless," since the top bar already has one. Investigation
found the complaint was correct and sharper than it first looked: the
in-page picker only ever shows when `?projectId=` is absent from the URL
(true on every sidebar-nav visit, since sidebar links carry no query
param) — so it appeared on literally every first visit to any of these
seven pages, regardless of what the header already had selected. Worse,
once a project WAS resolved, the page's own "Switch project" link turned
out to be dead: it pointed at `withProjectId(<bare path>, project.id)` —
the SAME project id already showing — so clicking it only cleared filters,
never actually let you switch projects. Confirmed the exact scope
("Technical Center only" vs. "all 6 project-scoped modules") directly with
the user (`AskUserQuestion`); the user chose the broader fix. Page
Workspace was added to the fix as an eighth affected file — it shares the
identical `CURRENT_PROJECT_COOKIE`-as-picker-default pattern and would have
been left visibly inconsistent with the other seven if skipped.

## As-built

Two changes, applied together:

1. **`ProjectSwitcher` (the header component) now calls `router.refresh()`**
   after writing `CURRENT_PROJECT_COOKIE`, in addition to the write it
   already did. Every project-scoped page is a Server Component that reads
   the cookie per request — without a refresh, a page already on screen
   would only pick up the new project on some unrelated future navigation,
   which is confusing since the header visibly shows the new selection
   immediately.

2. **Each of the eight pages now resolves its project id as
   `projectIdParam ?? defaultProjectId`** (an explicit `?projectId=` in
   the URL still wins when present) instead of `projectIdParam` alone. The
   `cookies()`/`defaultProjectId` read was already present in every one of
   these pages — it just used to be computed only inside the "no project"
   branch, purely to pre-fill the picker's `<select>`. It's now computed
   unconditionally and used as the real fallback. The in-page
   `ProjectPickerForm` prompt only renders now when NEITHER the URL nor
   the cookie resolves to a real project (first-ever visit before the
   header switcher has been touched, or a stale cookie naming a deleted/
   inaccessible project) — the same "smallest honest reading" contract
   `getProject()` already returning `null` for both a malformed id and a
   genuine 404 gave every one of these pages before this fix.

   The dead "Switch project" link was removed from the six pages that had
   one (Page Inventory, Scan Center, Technical Center, Change Center,
   Internal Linking Library, Keyword & Entity Library's keywords and
   entities routes) — `clearFiltersHref`, which it reused, stays in place
   since it's genuinely still needed for the real "Clear filters" action
   on each page. Page Workspace never had a "Switch project" link to begin
   with, so only the cookie-fallback change applies there.

   `ProjectPickerForm`'s own doc comment was corrected — it previously
   described the cookie write as "purely advisory," which is no longer
   true now that the cookie is the real fallback source of truth for every
   project-scoped page; the form still only renders once that fallback
   has ALSO failed to resolve.

No backend change — this is a pure `dashboard-web` routing/UX fix on top
of already-live, already-gated backends. `?projectId=` in a URL (e.g. a
future cross-link from another module) still overrides the header
selection exactly as before; nothing about the RBAC/authorization model
changed, since every fetch still goes through the same already-reviewed
`getProject()`/module-specific fetch functions with the same resolved id.

## Validation

Independently re-run and confirmed: `pnpm --filter dashboard-web
typecheck` clean, `pnpm --filter dashboard-web lint` (`eslint
--max-warnings=0` + CSS-token-check, 99 files) clean, `pnpm --filter
dashboard-web test` — 1823/1823 tests passing, unchanged (no test asserted
on the removed "Switch project" link or the old picker-first behavior),
`pnpm --filter dashboard-web build` clean with all touched routes present,
`prettier --check` clean. Live-rendered in the Browser pane: all seven
project-scoped routes redirect an unauthenticated visitor to `/auth/
sign-in` cleanly with zero console errors — no local `dashboard-api`/
database was available in this environment, so the authenticated success
path (a project auto-resolving from the header cookie with no picker
shown) wasn't visually confirmed, the same limitation several prior
`dashboard-web` slices in this app have already noted for themselves.

## Review

Reviewed at light tier, per the 2026-08-27 "right-size the review
pipeline" standing rule — a frontend-only routing/UX fix touching no new
endpoint, no new RBAC/auth logic, and no new sink; every one of the eight
pages already fetches through its own already-reviewed, already-gated
fetch function with a `projectId` string, and that string's origin (URL
vs. cookie) is the only thing this diff changes. A direct read-through
pass covered: the falsy-string edge case (selecting "All projects" in the
header writes an empty-string cookie value, which the `effectiveProjectId
? ... : null` truthy checks throughout correctly treat as "no project,"
falling through to the picker exactly as a genuinely-unset cookie would);
that `clearFiltersHref` remains legitimately used for "Clear filters" on
every page after the "Switch project" link's removal (confirmed via
`grep -c` per file); and that `router.refresh()` is already exercised by
this app's existing `app-shell.test.tsx` mock, so no test regression was
expected from the header component's own change. No separate security
review — no new endpoint, no new sink, no auth-relevant code touched.
