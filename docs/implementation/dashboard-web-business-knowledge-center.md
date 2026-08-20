# `dashboard-web` Business Knowledge Center UI (as-built)

**Status:** Built, fully validated, not yet reviewed, gated, or merged. Branch
`dashboard-web-business-knowledge-center`, off `main` at `9e1abb6` (the commit recording PR #43's
merge as live in production).

## 1. Why this exists, and what it isn't

Built directly on the explicit "build the dashboard-web UI for it" instruction, following the
Business Knowledge Center backend's own build-to-production arc (PR #43, merged and gated
2026-08-20). Closes the module's last named gap — no `dashboard-web` UI existed for it, matching
the same backend-first-then-UI sequencing already established for the Projects module.

No approved wireframe or spec exists for this module's screens (the canonical spec names 10 record
types and a 5-value status vocabulary but has no field-level schema, workflow doc, or wireframes,
same gap the backend task package already flagged) — every screen here renders exactly what the
already-reviewed, already-gated backend actually returns and supports, matching the Projects
module's own "smallest honest reading" precedent for its own list/detail/form pages.

## 2. What exists

- **`packages/shared-types`** — `BusinessKnowledgeRecordType`, `BusinessKnowledgeRecordStatus`,
  `BusinessKnowledgeRecord`, following this file's own header rule ("no business-module types until
  their owning module is actually authorized and implemented" — now true). `content`/`notes` are
  typed as genuinely _optional_, not just nullable — the backend's confidential-field redaction
  deletes both keys outright from the JSON response for a `restricted` record when the caller lacks
  `view_confidential` (currently every caller, since that action is zero-seeded for every role), so
  the type honestly reflects that the keys can be absent, not merely `null`.
- **`apps/dashboard-web/lib/business-knowledge-query.ts`** — zero-non-type-import file (matching
  `lib/projects-query.ts`'s own precedent, written client-safe from the start rather than reactively
  hitting the `next/headers` client-bundle trap `CLAUDE.md` has already flagged twice): page size,
  query type, `parseBusinessKnowledgeSearchParams`/`buildBusinessKnowledgeHref`, the record-type
  label map, and the status→badge-token map (`mandatory`/`advisory` share the `healthy` token,
  `draft` → `unknown`, `restricted` → `degraded`, `deprecated` → `notConfigured`).
- **`apps/dashboard-web/lib/business-knowledge.ts`** — server-side fetch functions:
  `getBusinessKnowledgeRecords()` (list, same "request one row past the display page size" technique
  `getProjects()` uses, since the backend returns no total count) and `getBusinessKnowledgeRecord()`
  (single record; `null` on 404 — including a client-side malformed-UUID short-circuit before any
  network call, same precedent as `lib/projects.ts`'s `getProjectDetail()`).
- **`apps/dashboard-web/components/business-knowledge-record-form.tsx`** — create/edit form
  (`recordType`/`title`/`content`/`notes`). `recordType` is create-only (the backend's
  `updateBusinessKnowledgeRecordSchema` doesn't accept it either), shown as read-only text on edit,
  matching `ProjectForm`'s own `publicId` pattern. `status` is never a field here — only
  `BusinessKnowledgeStatusActions` (via the dedicated `POST .../:id/status` route) may change it.
- **`apps/dashboard-web/components/business-knowledge-status-actions.tsx`** — status-transition
  buttons mirroring `ALLOWED_TRANSITIONS` in `business-knowledge-records.service.ts` by hand (same
  approach `ProjectStatusActions` already uses for its own 3-state machine). Only the `deprecated`
  transition is confirmed (the one this 5-state machine can never reverse). A concurrent status
  change elsewhere (the backend's atomic compare-and-swap losing a race) surfaces as a real `409`,
  shown via `parseApiErrorMessage()` — `ConflictException` was added to `lib/api-errors.ts`'s
  allowlist for this, the first route in this app whose service layer can throw one.
- **Four routes** under `app/(shell)/business-knowledge-center/`: list (`page.tsx`, filters by
  `recordType`/`status`, offset pagination — no search or sort, since the backend's `list()`
  supports neither), detail (`[recordId]/page.tsx`, sections not client-side tabs, matching
  `ProjectDetailPage`'s own simplification — a redacted `restricted` record's Content/Notes sections
  render an inert notice instead of the real text), create (`new/page.tsx`), and edit
  (`[recordId]/edit/page.tsx`).

## 3. The redacted-content edit-form design decision

A `restricted` record's `content`/`notes` may be redacted for the current viewer. Letting someone
"edit blind" against content they've never actually seen would risk silently overwriting real
confidential content with whatever an empty textarea submits — so `BusinessKnowledgeRecordForm`
renders a redacted field as an inert notice instead of an editable input, and omits it entirely from
the submit payload (the backend's `update()` leaves an omitted field unchanged, since every field on
`updateBusinessKnowledgeRecordSchema` is optional). `content === undefined` unambiguously means
"redacted" — a real record always has non-empty content, so the key is never legitimately absent for
any other reason; `notes === undefined` follows the same signal, distinct from `notes === null`
("genuinely no notes, and visible").

## 4. Route path

`/business-knowledge-center` — taken directly from the already-seeded `module_registry` row's own
`route` field (`00035-populate-module-registry-fields.ts`), not invented; the sidebar nav (already
listing this module under the "libraries" cluster with its `book-open` icon, already mapped in
`lib/module-icons.tsx`) now links to a real page instead of a 404.

## 5. Validation

- **32 new `dashboard-web` unit tests** (18 lib-function tests covering
  `parseBusinessKnowledgeSearchParams`/`buildBusinessKnowledgeHref`/`businessKnowledgeStatusBadge`/
  `getBusinessKnowledgeRecords`/`getBusinessKnowledgeRecord`, including the malformed-id
  short-circuit and a redacted-record fixture; 8 for `BusinessKnowledgeStatusActions` covering every
  transition set, the deprecate confirmation, the 409-conflict message path, and the
  render-nothing-for-an-unknown-status fallback; 6 for `BusinessKnowledgeRecordForm` covering
  create/edit submission shapes and the redacted-content omit-from-payload behavior) — 221/221
  `dashboard-web` unit tests overall.
- Full re-validation: typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean across
  `packages/shared-types` and `dashboard-web`.
- **15/15 Playwright tests passing** (unchanged — no new route added to the a11y/smoke suites,
  matching the Projects module's own precedent of not expanding that suite's scope for a UI-only
  slice). One local-environment-only false failure was diagnosed and ruled out along the way: a
  manually-started `preview_start` dev server on port 3000 was reused by Playwright's own
  `webServer` config (`reuseExistingServer: !process.env["CI"]`) instead of Playwright spinning up
  its own with `PLAYWRIGHT_E2E_TEST_MODE=1` set — stopping the manual server and re-running fixed
  it; not a real regression.
- **Live-rendered in the Browser pane**: confirmed `/business-knowledge-center` and
  `/business-knowledge-center/new` both correctly redirect an unauthenticated visitor to
  `/auth/sign-in`, with zero server errors (`preview_logs`) and no console errors beyond the
  expected local HMR artifact already documented elsewhere in this project. No local `dashboard-api`
  is available in this environment, so the authenticated success-path rendering (the actual list/
  detail/form content) wasn't visually confirmed here — the same limitation the Projects list page's
  own as-built record already noted for itself.

Not yet reviewed, gated, or merged — code review, security review, second-role human review, a gate
decision, and merge authorization are each their own separate, not-yet-requested next step,
unchanged from this project's standing discipline.
