# `dashboard-web` — Projects List Page (as-built)

**Status:** Records what was actually built for the Projects list screen, on branch
`dashboard-web-projects-list`, off `main` at `7cfb6c5` (the commit closing out the Project
Switcher's own build-to-production arc).

## 1. Why this exists, and what it isn't

Built directly on the explicit "build the Projects list page UI" instruction. Before writing any
code, checked what's actually sourced vs. undesigned, since the Projects module has a real
precedent of unsourced UI proposals being flagged rather than treated as settled:

- **No approved wireframe exists.** `07_Low_Fidelity_Wireframes.md` has 11 numbered screens; none
  is "Projects." The only two mentions of "Projects" anywhere in that document are the sidebar nav
  item and the header "Project Switcher" label — confirmed independently by
  `docs/task-packages/module-projects-foundation.md` §8's own note.
- **The module spec (`03_Detailed_Module_Specifications.md` §2) names records and actions only** —
  "create/update project, assign users, define approvers, set active phase, pause project, archive
  project" — no screens, columns, filters, or list-view behavior.
- **The only prior description of a "Project List" screen is `module-projects-foundation.md` §8's
  own unapproved proposal** (table: name/status/active phase/owner/updated; search; status filter;
  sort), explicitly flagged in that same document as "this implementer's own reasoned proposal...
  not sourced, and should be confirmed or corrected by the human reviewer."

Given that, this page renders exactly what `GET /projects` actually returns and supports today —
name, status, public ID, updated-at, search, a status filter, column sort, and offset pagination —
and deliberately **does not** show "active phase" or "owner" columns from that unapproved
proposal: `ProjectEntity` only carries `activePhaseId`/`ownerUserId` as bare foreign keys, with no
name-resolution endpoint. Showing a raw UUID would be useless; inventing a joined display name
would be fabricating data the backend doesn't provide. Omitting the column until a real
"resolve to a display name" capability exists is the honest choice.

## 2. What exists

- **`packages/shared-types/src/index.ts`** — `Project`, a second, wider projection of
  `ProjectEntity` alongside the header switcher's existing `ProjectSummary` (not a replacement for
  it — the switcher stays on its own narrower, already-validated type). Carries `id`, `publicId`,
  `name`, `description`, `status`, `confidentiality`, `createdAt`, `updatedAt` — deliberately still
  not the full backend entity (`activePhaseId`/`ownerUserId` excluded per §1 above;
  `retentionCategory`/`createdBy`/`updatedBy` are operational metadata, not list content).
- **`apps/dashboard-web/lib/projects.ts`**:
  - `parseProjectsSearchParams()` — validates the untrusted `searchParams` object (a reader can
    type anything into the URL) against the exact same enums `GET /projects`'s own
    `listProjectsQuerySchema` accepts, so a garbled URL degrades to the default query instead of
    round-tripping an invalid value to the backend.
  - `buildProjectsHref()` — builds sort-column and pagination links, resetting `offset` to 0
    whenever a filter/sort override lands without an explicit new offset (changing the query while
    on page 3 shouldn't silently return zero results for an offset that no longer makes sense).
  - `projectStatusBadge()` — maps the module's own `active`/`paused`/`archived` vocabulary onto the
    shared design system's semantic status tokens (`healthy`/`degraded`/`unknown`) — the one place
    that translation happens, since project status isn't itself one of `statusTokens`' keys.
  - `getProjects()` — fetches the real, richer project list. Unlike the header switcher's
    `fetchProjectSummaries()`, this **never** degrades a failure to an empty list: this page's
    entire content _is_ the project list, so a fetch failure is a real error (propagates to the
    nearest `error.tsx`), not incidental chrome that can silently disappear.
- **`apps/dashboard-web/app/(shell)/projects/page.tsx`** — a fully server-rendered page (no client
  component, no JS required for search/filter/sort/pagination — all of it is plain `<form
method="get">` submissions and `<a>`/`next/link` hrefs built from the current query state).
  Matches the route already registered for the `projects` module key
  (`packages/database/src/migrations/00035-populate-module-registry-fields.ts`:
  `route: "/projects"`) — the sidebar nav link now resolves to a real page instead of 404ing.
  Renders `EmptyState` with a distinct message when filters exclude everything vs. when the
  organization genuinely has no projects yet, and never links a row to a project-detail page,
  since no such page exists (linking to something that 404s would be worse than not linking, same
  reasoning the Project Switcher itself already established).
  - Calls `getServerSession()` first as a defensive fallback before `getProjects()` — the `(shell)`
    layout already redirects unauthenticated callers, but without this guard an unauthenticated
    request still fired `getProjects()` in parallel with the layout's own redirect check (caught
    live during Playwright verification: a real `ECONNREFUSED` error logged server-side, discarded
    either way once the layout's redirect won the race). Same pattern `home/page.tsx` already uses.

## 3. What was deliberately not built

- **Project detail page** (`/projects/:id`) — separate, larger, unrequested scope.
- **Create/edit project form** — same.
- **"Active phase" and "owner" columns** — no name-resolution capability exists yet (§1).
- **Client-side interactivity** (live search-as-you-type, client-side sort) — the page is fully
  server-rendered by design; every interaction is a real navigation, matching this app's existing
  pattern (only `AppShell`/`ProjectSwitcher` are legitimately client components, both for real
  interactive-state reasons this page doesn't share).
- **A bespoke visual design** — plain table markup styled via the existing
  `--webdesk-dashboard-*` CSS custom properties, composed from `@webdesk/ui`'s existing
  `PageHeader`/`ContentContainer`/`StatusBadge`/`EmptyState` — no new shared components were added
  to `packages/ui` (a reusable `<Table>` doesn't exist there yet; building one was judged
  out of scope for a single list page pending a second real consumer).

## 4. Testing

- `apps/dashboard-web/tests/unit/projects.test.tsx` — 14 tests: `parseProjectsSearchParams()`
  (defaults, valid values, invalid/garbled enum fallback, blank search, negative-offset clamping,
  duplicate-param handling), `buildProjectsHref()` (default/no-op, non-default fields only, offset
  reset on filter change, explicit offset preserved, untouched fields preserved),
  `projectStatusBadge()` (all three statuses), and `getProjects()` (throws on non-OK response,
  sends the expected query string).
- `apps/dashboard-web/tests/e2e/smoke.spec.ts` — 1 new test: an unauthenticated visit to
  `/projects` redirects to sign-in, mirroring the existing `/home` coverage.
- Full validation: typecheck, lint, `next build` (confirms `/projects` compiles as a real dynamic
  route), and the full Playwright smoke suite (7/7) all pass. The authenticated table itself still
  has no Playwright coverage — same already-documented gap as the rest of the shell (no test-only
  session mechanism exists) — proven instead by the unit suite plus a live dev-server check
  confirming the unauthenticated redirect renders cleanly with zero console/server errors.
