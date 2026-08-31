# Wireframe Library — module implementation

## Scope

Module #16 on the Recommended Module Roadmap (`canonical-inputs/Recommended_Module_Roadmap.md`
line 54), module 17 in `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md`
§17. Built directly on the explicit "start Wireframe Library" instruction, following the
established backend-first module precedent (Section and Pattern Library, Design Token Library,
etc.).

**Spec field list (§17):** page/module, viewport, version, file/image, annotations, interaction
notes, related template, status, reviewer, approval.

### Real dependency cycle with `page_template_library`

`docs/phase-plans/module-implementation-roadmap.md` §4 flags `page_template_library` ↔
`wireframe_library` as a real, unresolved cycle in the seeded module-registry data — a template
references its wireframe and a wireframe references the template it implements.
`page_template_library` does not exist yet. Following the established precedent for this exact
situation (Website Strategy Center ↔ Internal Linking Library, Service Library's
`relatedPageIds`/`relatedCaseStudyIds`), **`relatedTemplateId` is stored as a plain, unvalidated
string** — no FK, no existence check — to be linked for real once Page Template Library exists.

### Design decisions confirmed directly with the project owner (`AskUserQuestion`)

1. **Version model: real multi-row version history.** File-for-file mirrors Design Token
   Library's/Section and Pattern Library's own pattern — every version of a record is its own
   physical row, sharing a stable `recordId`; exactly one row per `recordId` has `isCurrent: true`;
   editing an `approved` record forks a new version rather than mutating in place; a new version's
   own `-> approved` transition automatically supersedes whichever other version of the same
   `recordId` currently holds `approved`. Chosen over a simple mutable-row + integer `version`
   (Persona Library's shape) since wireframes are inherently revision-driven planning artifacts
   (v1/v2/v3 comparison is the whole point of "version" appearing in the spec's own field list).
2. **File field: a plain URL reference, not a new attachment mechanism.** `fileReference` is a
   nullable, `safeHttpUrlSchema`-validated URL (e.g. a Figma link), mirroring Brand Library's own
   `fileReference` exactly. No new Blob/attachment infrastructure — none is provisioned in
   production (a known, already-recorded gap — see `CLAUDE.md`'s "Open client blockers").

### Field mapping

| Spec field        | Column                                    | Type / notes                                                                                                                                                                                                                                                                                             |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| page/module       | `page_or_module`                          | Required plain text — the page/module this wireframe plans.                                                                                                                                                                                                                                              |
| viewport          | `viewport`                                | Required enum: `mobile` \| `tablet` \| `desktop`.                                                                                                                                                                                                                                                        |
| version           | `record_id`/`version_number`/`is_current` | Real multi-row version history (see above).                                                                                                                                                                                                                                                              |
| file/image        | `file_reference`                          | Nullable, `safeHttpUrlSchema`-validated URL.                                                                                                                                                                                                                                                             |
| annotations       | `annotations`                             | Nullable long text. Real content once a `dashboard-web` UI exists — per the 2026-08-22 standing rule, wire write-time (`sanitizeNullableRichText`/`sanitizeNullableRichTextIfChanged`) + render-time (`SanitizedRichText`, when the UI is built) sanitization now, even though no UI ships in this pass. |
| interaction notes | `interaction_notes`                       | Nullable long text — same rich-text sanitization treatment as `annotations`.                                                                                                                                                                                                                             |
| related template  | `related_template_id`                     | Nullable, unvalidated plain string (see cycle note above).                                                                                                                                                                                                                                               |
| reviewer          | `reviewer_user_id`                        | Nullable, existence-validated FK into `users` (mirrors `ownerUserId`/`assignedApproverUserId` precedent).                                                                                                                                                                                                |
| status / approval | `approval_status`                         | The shared generic 8-value `ArtifactApprovalStatus` vocabulary, reused verbatim (Design Token Library's/Section and Pattern Library's own `TRANSITIONS` table, no `approved -> superseded` edge — supersede is automatic).                                                                               |

Plus `public_id` (stable across versions, partial-unique-indexed `WHERE is_current = true`),
`created_by`/`updated_by`, timestamps.

No confidentiality mechanism (module registry's seeded `confidentialityLevel` for
`wireframe_library` is `null`, matching Section and Pattern Library/Persona Library). No
publish/unpublish action — nothing in the spec names one (matching Design Token Library/Section
and Pattern Library over Content Template Library/Brand Library). Reuses the already-seeded
`creative_design` RBAC permission group verbatim — no new RBAC migration. Organization-wide, not
project-scoped. Backend-only pass — `dashboard-web` UI is a separate, not-yet-requested next step.

## As-built

Migrations `00084`/`00085` (renumbered from an initial `00082`/`00083` after a concurrent
merge — `00082`/`00083` were claimed by another module — see the migration-file names and every
in-file cross-reference for the final numbers). File-for-file mirrors
`packages/database/src/section-and-pattern-library/` and
`apps/dashboard-api/src/section-and-pattern-library/`: `wireframe_records` (real multi-row version
history, partial unique indexes on `public_id`/`record_id` scoped to `is_current = true`, a
`(record_id, version_number)` unique index, and supporting indexes for `list()`'s query shape and
`supersedeOtherApprovedVersion()`'s update). `pageOrModule` is immutable across a record's own
version chain (mirrors `patternType`'s treatment); `viewport` is NOT immutable — a later version
may legitimately re-plan the same page/module at a different viewport. `reviewerUserId` is a real,
existence-validated FK, checked via the shared `UsersService.assertUserExists()` helper
(`module-review-and-approval-center`'s own consolidation of the pattern
`ProjectService.assertOwnerExists()`/`InternalLinksService.assertApproverExists()` each
independently hand-copied) rather than a 4th hand-copy. `relatedTemplateId` is a plain,
unvalidated string (the real `page_template_library` dependency cycle). `annotations`/
`interactionNotes` are wired to `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`
even though no `dashboard-web` UI ships in this pass. `fileReference` uses the shared
`safeHttpUrlSchema`. `approvalStatus` reuses the standard 8-value `TRANSITIONS` table verbatim
(no `approved -> superseded` edge — supersede is automatic). RBAC: `creative_design`, method-level
`@RequirePermission` decorators throughout (never class-level).

Validation performed against a real disposable local PostgreSQL 17 instance (a throwaway data
directory + a non-default port, provisioned specifically for this build since no `DATABASE_URL`
was otherwise configured in this environment — not the machine's existing system Postgres
service): a full migration up round-trip (83 migrations from empty, 0 pending after), a dedicated
down/up round-trip isolated to migrations `00084`/`00085`, `validate:module-registry` (43 modules,
21 permission groups, all references resolve), 24/24 new `packages/database` integration tests,
26/26 new `dashboard-api` e2e tests (the full `creative_design` RBAC submit/review/approve
3-tier matrix, `reviewerUserId` existence validation, `relatedTemplateId`'s unvalidated-string
behavior, rich-text sanitization over real HTTP, and a full version-history round trip), 46/46
new `dashboard-api` unit tests, `pnpm audit` (0 vulnerabilities), and typecheck/lint/`nest
build`/prettier all clean across `packages/database` and `apps/dashboard-api`. No `dashboard-web`
UI exists yet for this module — a separate, not-yet-requested next step, matching every prior
module's own backend-first precedent.

_(filled in after the build)_
