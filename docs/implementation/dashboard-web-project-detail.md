# `dashboard-web` — Project Detail Page (as-built)

**Status:** Records what was actually built for the Project Detail screen, on branch
`dashboard-web-project-detail`, off `main` at `38cffd7` (the commit closing out the Projects list
page's own build-to-production arc).

## 1. Why this exists, and what it isn't

Built directly on the explicit "build the project detail page UI" instruction. Checked what's
actually sourced vs. undesigned before writing any code, same discipline as every prior Projects UI
slice:

- **No approved wireframe exists.** `07_Low_Fidelity_Wireframes.md` has no Projects-specific
  screens — confirmed again for this slice, unchanged from the list page's own finding.
- **The only prior description of a Project Detail screen is
  `module-projects-foundation.md` §8's own unapproved proposal**: "header (name, status, owner,
  actions: pause/archive/edit); tabs: Overview, Team, Environments, Repositories, Roadmap" —
  explicitly flagged in that same document as "this implementer's own reasoned proposal... not
  sourced, and should be confirmed or corrected by the human reviewer."

Given that, this page renders the same content grouping §8 proposes, with two deliberate
deviations from it, both recorded here rather than silently applied:

1. **Sections instead of tabs.** Client-side tabs would be the first client component this app's
   read-heavy pages have needed (every other page — the list, the switcher's one exception aside —
   is fully server-rendered, zero JS). A single scrollable page of `<section>`s renders the exact
   same content grouping without introducing client-side state, matching every other page's own
   established pattern. Not a functional gap — a legitimate simplification.
2. **No pause/archive/edit actions, no Team member list.** The header's proposed mutation actions
   are out of scope, matching the list page's own precedent of shipping read-only UI before any
   mutation UI (no create/edit form exists for the list either). "Team" shows a real, non-fabricated
   headcount only — no member identities — because no user-lookup endpoint exists yet to resolve a
   `userId` to a name, the exact same constraint that already shaped the list page's omission of the
   "owner" column. Showing a raw UUID or a fabricated display name would both be worse than omitting
   the identity.

## 2. What exists

- **`packages/shared-types/src/index.ts`** — five new types:
  - `ProjectDetail` (extends `Project`) — legitimately carries `activePhaseId`/`ownerUserId` again,
    unlike the list page's `Project`: the detail page also fetches the project's own roadmap items
    in the same request pass, so `activePhaseId` can be resolved to a real name by
    cross-referencing that array (no fabrication). `ownerUserId`'s raw value is used only to render
    a boolean "assigned"/"not assigned" state, never displayed as an identity.
  - `RoadmapItem`, `ProjectObjective`, `ProjectEnvironment`, `ProjectRepository` — one projection
    each of the corresponding backend entity, `createdBy`/`updatedBy` omitted as operational
    metadata (matching `Project`'s own precedent).
  - `ProjectTeamEntry` — carries only `id`; the detail page uses this array's `.length` only, as a
    real headcount, never an entry's identity.
- **`apps/dashboard-web/lib/projects.ts`**:
  - `formatTimestamp()` — moved here from the list page (was a private, unexported function there)
    since both pages now need identical UTC-timestamp formatting; the list page now imports it
    instead of duplicating it.
  - `roadmapItemStatusBadge()` / `objectiveStatusBadge()` — map each sub-resource's own status
    vocabulary onto the shared design system's five status tokens, same pattern
    `projectStatusBadge()` already established. `active`/`complete` roadmap-item statuses share the
    `healthy` (green) token deliberately — both are non-problem states, and `StatusBadge` always
    pairs a colored dot with a text label, so the label (not color alone) disambiguates them; the
    token palette has no dedicated "success, distinct from healthy" concept to reach for instead.
  - `getProjectDetail(projectId)` — fetches `GET /projects/:projectId` first and gates on it:
    returns `null` specifically on a 404 (the caller renders `notFound()`), throws on any other
    non-OK status (403, 5xx — a real error, not a false "doesn't exist"). Only once the project is
    confirmed to exist does it fan out to the five sub-resource endpoints
    (`roadmap-items`/`objectives`/`environments`/`repositories`/`team`) in parallel. This ordering
    is required, not stylistic: `GET /projects/:projectId/*` list endpoints don't themselves
    validate the parent project's existence — a bogus `projectId` returns an empty array (200), not
    a 404 — so the primary fetch is the only way to detect a genuinely missing project.
- **`apps/dashboard-web/app/(shell)/projects/[projectId]/page.tsx`** — a fully server-rendered page
  (no client component). Calls `getServerSession()` first as the same defensive fallback pattern
  `home/page.tsx` and the list page both already use, then `getProjectDetail()`, calling Next.js's
  `notFound()` when it returns `null` (renders the existing root `app/not-found.tsx` — no
  shell-scoped not-found boundary exists yet, so the authenticated shell chrome doesn't wrap it;
  an existing, unrelated limitation, not something this page introduces). Renders:
  - **Header** — `PageHeader` with a `Projects / {name}` breadcrumb (the first real use of
    `PageHeader`'s `breadcrumbs`/`linkComponent` props anywhere in this app) and the project's
    status badge.
  - **Overview** — public ID, confidentiality, active phase (resolved by cross-referencing
    `activePhaseId` against the already-fetched roadmap items — legitimate, not fabricated, since
    `active_phase_id` has a real DB-level FK to `roadmap_items.id` with `ON DELETE SET NULL`, so a
    non-null value is always resolvable), owner (assigned/not assigned only), team headcount,
    created/updated timestamps, and the description (or a "No description." fallback).
  - **Roadmap** — every roadmap item, backend-ordered by `sequence`, each with its own status badge
    (the item whose `status` is `"active"` is, by the backend's own `setActivePhase()` invariant,
    always the same item `activePhaseId` points to — kept in sync server-side, not duplicated logic
    here).
  - **Objectives**, **Environments** (external `url` link if set), **Repositories** (links to
    `https://github.com/{repoOwner}/{repoName}`, `target="_blank" rel="noopener noreferrer"`) — each
    a simple list, each with its own "no X yet" empty state.
- **`apps/dashboard-web/app/(shell)/projects/page.tsx`** — two small, necessary follow-on changes
  now that a detail page exists: each row's project name is now a real link to
  `/projects/{project.id}` (previously plain text — a list with nowhere to go would have been an
  incomplete pairing with this page, not a deliberate omission), and its local `formatTimestamp()`
  was removed in favor of importing the newly-shared one from `lib/projects.ts`.

## 3. What was deliberately not built

- **Pause/archive/edit actions** — §8's proposed header actions; a real mutation UI is separate,
  larger, unrequested scope, matching the list page's own "no create/edit form" precedent.
- **Team member identities** — no user-lookup endpoint exists to resolve a `userId` to a name; only
  a real headcount is shown (§1 above).
- **Client-side tabs** — sections instead, a deliberate simplification (§1 above) that keeps this
  page's zero-client-JS property consistent with the rest of the app.
- **A "past the last item" or pagination concern for any sub-resource list** — none of the five
  `GET /projects/:projectId/*` list endpoints are paginated on the backend (confirmed by reading
  each controller); they return every row, already ordered.

## 4. Testing

- `apps/dashboard-web/tests/unit/projects.test.tsx` — 24 tests total (10 new): `formatTimestamp()`,
  `roadmapItemStatusBadge()`/`objectiveStatusBadge()` (every status value), and `getProjectDetail()`
  (404 → `null` without fetching any sub-resource; non-OK/non-404 primary response → throws;
  a sub-resource failure after a successful primary fetch → throws; the success path, asserting
  every one of the six expected URLs was requested and the team headcount is derived from the raw
  array length).
- `apps/dashboard-web/tests/e2e/smoke.spec.ts` — 1 new test: an unauthenticated visit to
  `/projects/{a well-formed id}` redirects to sign-in, mirroring the existing `/projects` coverage.
  Also live-verified against the dev server (no real backend available in this sandboxed
  environment): the redirect renders cleanly with zero server-side or console errors, confirming the
  defensive `getServerSession()` guard prevents the same wasted-fetch class of issue the list page's
  own live check caught earlier.
- Full validation: typecheck (`packages/shared-types` rebuilt first — its compiled `dist/` output is
  what `dashboard-web`'s typecheck actually resolves against, so a source-only edit isn't visible
  until rebuilt), lint, `next build` (confirms `/projects/[projectId]` compiles as a real dynamic
  route), and the full Playwright smoke suite (11/11) all pass.
