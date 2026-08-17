# `dashboard-web` — Create/Edit Project Form (as-built)

**Status:** Records what was actually built for the Projects module's create/edit form, on branch
`dashboard-web-project-form`, off `main` at `e6a5577` (the commit closing out the Project Detail
page's own build-to-production arc).

## 1. Why this exists, and what it isn't

Built directly on the explicit "build the create/edit project form" instruction. The only prior
description of this screen is `module-projects-foundation.md` §8's own unapproved proposal:
"Create/Edit Project — form (name, description); status/archival handled via the dedicated
transition action, not this form" — explicitly flagged there as "not sourced... should be confirmed
or corrected." Built to that scope, with `confidentiality` added (a real, already-live field on
`GET /projects/:id` with no separate transition endpoint of its own, unlike status) and `publicId`
handled as create-only per the backend's own contract (`updateProjectSchema` has no `publicId`
field at all — migration `00036`'s doc comment: "never regenerated once assigned").

Deliberately **not** built, matching precedent already established by the list/detail pages:

- **Status/archival actions.** `POST /projects/:projectId/status` is its own dedicated endpoint per
  the design note above — a separate, not-yet-built UI action, not part of this form.
- **`ownerUserId` as a form field.** No user-lookup/picker capability exists anywhere in this app
  yet — the same constraint that already shaped the list page's omission of an "owner" column and
  the detail page's owner field rendering only "Assigned"/"Not assigned", never an identity.
- **Environments/repositories/roadmap/objectives editing.** Out of scope — this form covers the
  `projects` table's own name/description/confidentiality fields only, per §8's own scoping note.

## 2. What exists

- **`apps/dashboard-web/lib/project-confidentiality.ts`** (new) — `CONFIDENTIALITY_LABEL`/
  `CONFIDENTIALITY_VALUES`, extracted out of the detail page (which previously defined its own
  local copy) so both the detail page (a Server Component) and the new form (a Client Component)
  share one definition. Has no `next/headers` dependency, unlike the rest of `lib/projects.ts`, so
  it's safe to import from client code.
- **`apps/dashboard-web/components/project-form.tsx`** (new, `"use client"`) — `ProjectForm`,
  handling both `mode="create"` and `mode="edit"` via a discriminated-union prop. Submits with a
  direct browser `fetch()` (`credentials: "include"`), the one existing real-mutation pattern in
  this app (`app/auth/emergency/page.tsx`) — `dashboard-api`'s `OriginCheckGuard` on every mutating
  Projects route checks the request's real `Origin` header, which only a genuine browser fetch sets
  automatically; a Next.js Server Action would have needed that header injected by hand instead.
  Field length limits (`publicId` ≤ 64, `name` ≤ 255, `description` ≤ 10,000) mirror
  `projects.dto.ts`'s Zod schemas by hand, the same approach `lib/projects.ts`'s
  `parseProjectsSearchParams` already uses for the list page's query — this app has no runtime
  access to the backend's schemas. On success, navigates to `/projects/:id`. On a non-OK response,
  shows the backend's real `error.message` (e.g. `"publicId already in use: X"` for the duplicate-
  publicId case) — confirmed by reading `AllExceptionsFilter`/`ZodValidationPipe` that a plain
  service-layer `BadRequestException`'s string message survives to the client this way, while a Zod
  validation failure's per-field `issues` array does not (NestJS's `HttpException.initMessage()`
  only promotes the object's own `.message` string, `"Validation failed"`, into the field the filter
  reads — the `issues` detail is dropped). Client-side length limits keep that generic path
  practically unreachable in normal use.
- **`apps/dashboard-web/components/project-form.module.css`** (new) — plain form styling using the
  same `--webdesk-dashboard-*` token set `project-switcher.module.css` already established; no
  bespoke `Button`/`Input` component exists yet anywhere in this app (`app-shell.tsx`'s own "Sign
  out" and mobile-nav-toggle controls are plain styled `<Link>`/`<button>`, not a shared component
  either), so this form's submit button and the two pages' new "New project"/"Edit" action links
  follow that same precedent rather than inventing one for a single consumer.
- **`apps/dashboard-web/app/(shell)/projects/new/page.tsx`** (new) — thin Server Component wrapper:
  the standard defensive `getServerSession()` guard (matching every other page), a `PageHeader`, and
  `<ProjectForm mode="create" />`.
- **`apps/dashboard-web/app/(shell)/projects/[projectId]/edit/page.tsx`** (new) — Server Component:
  session guard, `getProjectDetail(projectId)` (already built for the detail page — reused as-is,
  `notFound()` on a miss), then `<ProjectForm mode="edit" .../>` seeded with the current values.
- **`apps/dashboard-web/app/(shell)/projects/page.tsx`** — added a "New project" link to
  `PageHeader`'s `contextActions` slot.
- **`apps/dashboard-web/app/(shell)/projects/[projectId]/page.tsx`** — added an "Edit" link to
  `PageHeader`'s `contextActions` slot; updated the page's own doc comment, which previously stated
  "the header's proposed pause/archive/edit actions are deliberately not built" — now only true for
  pause/archive.

## 3. Validation

- **Unit tests** (`apps/dashboard-web/tests/unit/project-form.test.tsx`, new — 6 tests): create-mode
  payload shape (including `description: null` when left blank), edit-mode's read-only `publicId`
  display and its omission from the update payload, the real backend error message surfacing on a
  non-OK response, and the generic fallback message on a network failure. Full suite:
  50/50 `dashboard-web` unit tests passing (6 new).
- **E2E** (`apps/dashboard-web/tests/e2e/smoke.spec.ts`) — 2 new tests: an unauthenticated visit to
  `/projects/new` and to `/projects/:id/edit` both redirect to sign-in. Full suite: 13/13 passing.
- Typecheck, lint, and `next build` all clean; `next build`'s route table confirms both new routes
  (`/projects/new`, `/projects/[projectId]/edit`) render as dynamic server routes.
- A live dev-server check confirmed both new routes redirect an unauthenticated visitor cleanly,
  with zero server or browser console errors.

## 4. Not yet reviewed or merged

Pushed as its own branch (`dashboard-web-project-form`). Code review, security review, second-role
human review, a gate decision, and merge authorization are each their own separate, not-yet-
requested next step, unchanged from this project's standing discipline for every prior slice.
