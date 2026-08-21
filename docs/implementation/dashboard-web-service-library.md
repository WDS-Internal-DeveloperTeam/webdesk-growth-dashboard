# `dashboard-web` Service Library UI (as-built)

**Status:** Built, fully validated, not yet reviewed, gated, or merged. Branch
`dashboard-web-service-library`, off `main` at the commit recording PR #47's merge as live in
production (the Service Library module backend).

## 1. Why this exists, and what it isn't

Built directly on the explicit "Start the dashboard-web UI for Service Library" instruction,
following the Service Library backend's own build-to-production arc (PR #47, merged and gated
2026-08-21). Closes the module's last named gap — no `dashboard-web` UI existed for it, matching
the same backend-first-then-UI sequencing already established for Projects and Business Knowledge
Center.

Unlike those two modules, this one has a real, sourced design brief:
`docs/design/dashboard-ui/15-representative-screen-specifications.md` §4 names Service Library
explicitly — archetype list → detail → editor, field groups Identity/Positioning/
Relationships/Status, and calls for the shared `ApprovalBlock` component on the status workflow.
Built to that brief's own field grouping and archetype, with one deliberate, explicitly-flagged
deviation (§4 below).

## 2. What exists

- **`packages/shared-types`** — `ServiceConfidentiality`, `ServicePublicationStatus`,
  `ServiceApprovalStatus`, `Service`, `ServiceDetail extends Service`, `ServiceCategory`,
  `Deliverable`, `PlatformTechnology`, `EngagementModel` — following this file's own header rule
  ("no business-module types until their owning module is actually authorized and implemented" —
  now true for Service Library).
- **`apps/dashboard-web/lib/service-library-query.ts`** — zero-non-type-import file (matching
  `lib/business-knowledge-query.ts`'s own precedent): page size, query type,
  `parseServiceLibrarySearchParams`/`buildServiceLibraryHref`, label maps for all three status/
  confidentiality enums, and `serviceApprovalStatusBadge()`/`servicePublicationStatusBadge()`
  (badge-token maps: `draft`/`archived` → `unknown`, `submitted`/`superseded` → `notConfigured`,
  `under_review`/`revision_requested` → `degraded`, `approved` → `healthy`, `rejected` →
  `unavailable`).
- **`apps/dashboard-web/lib/service-library.ts`** — server-side fetch functions:
  `getServices()` (list, same "request `pageSize + 1` rows, slice, `hasNextPage = length >
pageSize`" technique every other list page in this app uses, since no backend total count
  exists), `getService()` (single record; `isUuid()` short-circuit before any network call, `null`
  on 404), and a generic `getDimensionList<T>()` used for all four read-only dimension endpoints
  (`getServiceCategories()`/`getDeliverables()`/`getPlatforms()`/`getEngagementModels()`).
- **`apps/dashboard-web/components/service-library-form.tsx`** — create/edit form, organized into
  the design brief's own four fieldsets: Identity (`publicId` create-only read-only-on-edit,
  matching `ProjectForm`'s own precedent; `canonicalName`; `publicName`; `categoryId`), Positioning
  (`shortPublicDescription`/`audience`/`problems`/`capabilities`/`outcomes`/`exclusions`, plus
  `internalDescription` gated by the redaction rule in §3), Relationships (three
  `RelationshipPicker`-backed FK fields — `deliverableIds`/`platformIds`/`engagementModelIds` — and
  three hand-rolled `TagListField` unvalidated-identifier-list fields — `icpIds`/`relatedPageIds`/
  `relatedCaseStudyIds`, see §5), and Status (`confidentiality` always; `publicationStatus`
  edit-only, matching `updateServiceSchema`'s own contract — a new service always starts `draft`).
  `approvalStatus` is never a field here — only `ServiceStatusActions` (via the dedicated
  `POST .../:id/status` route) may change it.
- **`apps/dashboard-web/components/service-status-actions.tsx`** — status-transition buttons
  mirroring the backend's own `TRANSITIONS` table by hand (same approach `ProjectStatusActions`/
  `BusinessKnowledgeStatusActions` already use for their own state machines). Only a transition
  whose _target_ is itself terminal (`archived`/`superseded`) prompts a confirmation — `rejected`,
  despite sounding negative, stays fully recoverable (`rejected → draft`/`→ archived` both remain
  legal) and gets none, matching the existing precedent that confirmation tracks reversibility, not
  tone. See §4 for why this isn't `ApprovalBlock`.
- **Four routes** under `app/(shell)/service-library/`: list (`page.tsx`, filters by
  `categoryId`/`approvalStatus`/`publicationStatus`/`search`, offset pagination, hand-rolled table
  — Name/Category/Publication/Approval/Updated columns, `PageSizeSelect` reused unchanged), detail
  (`[serviceId]/page.tsx`, four sections mirroring the form's own fieldsets, relationship IDs
  resolved to names by cross-referencing the four dimension lists fetched concurrently with the
  service itself — a redacted `internalDescription` renders an inert notice, matching Business
  Knowledge Center's own precedent), create (`new/page.tsx`, fetches all four dimension lists
  server-side before rendering the form), and edit (`[serviceId]/edit/page.tsx`, fetches the
  service plus the four dimension lists, `notFound()` if the service is missing).

## 3. The redacted-content edit-form design decision

Identical convention to `BusinessKnowledgeRecordForm`: a `restricted` service's `internalDescription`
may be redacted (`undefined`, not `null`) for a viewer lacking `view_confidential`. The form renders
a redacted field as an inert notice rather than an editable textarea, and omits it entirely from the
submit payload — the backend's `update()` leaves an omitted field unchanged. `internalDescription
=== undefined` unambiguously signals redaction; a real record's field is either genuine text or
explicit `null`, never legitimately absent otherwise.

The other long-text fields (`shortPublicDescription`/`audience`/`problems`/`capabilities`/
`outcomes`/`exclusions`) follow the established "omit vs. null" convention: on create, an empty
field is omitted from the payload entirely; on edit, an emptied field is sent as explicit `null`
(clears it), since the edit form always resends every visible field and so has no other way to
express "the user cleared this."

## 4. The `ApprovalBlock` deviation

The approved design brief calls for the shared `@webdesk/ui` `ApprovalBlock` component on this
page. It was deliberately **not used** — `ApprovalBlock` requires real `submitter: string`,
`submittedAt: string`, and a `reviewer` identity, plus typed `onReject(reason)`/
`onRequestRevision(reason)` callbacks capturing a reviewer's stated reason. None of this is
supported by the actual backend: `changeServiceApprovalStatusSchema` accepts only
`{approvalStatus}` — no reason field, and the `services` table tracks no distinct submitter/
reviewer/submitted-at columns. Using `ApprovalBlock` here would mean either fabricating identity/
timestamp data this backend doesn't record, or building UI to capture a rejection/revision reason
the backend would then silently discard — both against this project's own standing practice of
never fabricating or silently dropping data. `ServiceStatusActions` (plain transition buttons,
mirroring the pattern already established for Projects' and Business Knowledge Center's own status
actions) was built instead. Revisiting this — wiring the real `ApprovalBlock` — is a real,
concrete follow-up once the backend's status-transition endpoint is extended to capture a reason,
but that is its own separate, not-yet-requested backend change, not something this UI-only branch
can retrofit.

## 5. `RelationshipPicker` vs. `TagListField`

This is the first real use of `@webdesk/ui`'s `RelationshipPicker` in this codebase (built in the
Dashboard UI Foundation Alignment slice but never previously consumed). It's used for
`deliverableIds`/`platformIds`/`engagementModelIds` — real FK-backed dimension entities with a
`GET` endpoint to search/list them, so a real search-and-select experience is honest.
`icpIds`/`relatedPageIds`/`relatedCaseStudyIds` are, per the backend task package's own D1
decision, plain unvalidated string arrays with no backing entity (the modules that would own real
validation — `persona_library`/`page_inventory`/`case_study_library` — don't exist yet) — using
`RelationshipPicker` for these would imply a search capability that doesn't exist, so a minimal
hand-rolled `TagListField` (free-text input, Enter/comma to add, click-to-remove chips) is used
instead.

## 6. Known, out-of-scope gaps

- **`parentServiceId`/`ownerUserId`** exist on the entity but have no form field — neither is
  named in the design brief's own field-group list, and `ownerUserId` specifically follows the
  exact reasoning that deferred Projects' own owner field until `UserPicker` existed: a real
  user-lookup capability. `UserPicker` does exist now (built for Projects), so wiring `ownerUserId`
  here is a small, real, concrete follow-up — deliberately not done in this pass to keep this
  branch's scope matched to the design brief's own named fields. `parentServiceId` would need a
  service-lookup picker of its own (no `RelationshipPicker`-compatible search endpoint exists for
  services-searching-services yet).
- **List page has no cross-field search** beyond `canonicalName`/`publicName` (the backend's
  `list()` `search` param, confirmed against `service.repository.ts`) — matches the pattern already
  established for Business Knowledge Center's own list page having no search at all.

## 7. Validation

- 262/262 → 308/308 `dashboard-web` unit tests (39 new: 23 in `service-library.test.tsx` covering
  `parseServiceLibrarySearchParams`/`buildServiceLibraryHref`/both badge-token maps/`getServices`/
  `getService`/`getServiceCategories`; 9 in `service-status-actions.test.tsx` covering every
  status's rendered transition set, the no-confirm-for-recoverable/confirm-for-terminal rule, a 409
  conflict, and the immediate-button-update-on-success behavior; 7 in
  `service-library-form.test.tsx` covering required-field enforcement, create-mode payload
  omission, edit-mode null-clearing and `approvalStatus` omission, redacted-field notice + payload
  omission, `RelationshipPicker` selection, tag-input Enter-to-add, and backend error display).
- `tsc --noEmit`, `eslint` (including all new test files), `check-css-tokens.mjs` (16 CSS Module
  files), `next build` (all four new routes — `/service-library`, `/service-library/[serviceId]`,
  `/service-library/[serviceId]/edit`, `/service-library/new` — appear as dynamic routes in the
  manifest), and `pnpm exec prettier --check` all clean.
- Two real test bugs were found and fixed while writing `service-library-form.test.tsx`, both
  traced to jsdom's native HTML constraint validation silently blocking a `submit` event (and thus
  `handleSubmit`) from firing when a required field (`publicId`, in both cases) was left empty —
  neither was an application bug. Fixed by switching the "missing required field" test to assert
  `.toBeRequired()` directly instead of simulating a blocked submission, and by filling in the
  previously-missing `publicId` in the two other affected tests.

## 8. Route path

`/service-library` — taken directly from the already-seeded `module_registry` row's own `route`
field, not invented; the sidebar nav (already listing this module under the "libraries" cluster)
now links to a real page instead of a 404.
