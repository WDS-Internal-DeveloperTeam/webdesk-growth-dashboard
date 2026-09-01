# `dashboard-web` Case Study Library UI — Approval Checklist

**Status:** Built, fully validated. Reviewed at light tier (1 finding, fixed) per this project's
2026-08-27 "right-size the review pipeline" standing rule. Awaiting required second-role human
review, gate decision, push, PR, and merge — each a separate, not-yet-requested next step.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it" instruction, following the backend's own build-to-production arc ([PR #92](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/92), merge commit `b54442cd428a25098f6827bd83935f07b0074009`)                    |
| 2   | Genuine scoping confirmed                  | ✅ Mirrors Case Study Studio's own UI structure (closest sibling), minus a status-actions component — this record has no lifecycle of its own, it's a pure extension over `case_studies` (D1)                                                                                           |
| 3   | Required tests pass                        | ✅ 1432/1432 `dashboard-web` unit tests (23 new — 17 lib/query, 6 component), unaffected `dashboard-api` suite (backend untouched)                                                                                                                                                      |
| 4   | Full validation clean                      | ✅ typecheck clean across `packages/shared-types`/`apps/dashboard-web`; `eslint --max-warnings=0` clean; CSS-token check clean (73 files); `next build` clean, all 4 new routes present; `prettier --check` clean on every touched file                                                 |
| 5   | Independent review complete (light tier)   | ✅ A direct read-through pass (not the 8-angle fan-out, per the 2026-08-27 standing rule for a small frontend-only slice consuming an already-reviewed, already-gated backend) — 1 finding, fixed (see below)                                                                           |
| 6   | Security review                            | Skipped per the same standing rule — no new endpoint, no new RBAC/auth logic, no new sink; the one client-side check (`relatedPageIds` UUID-format validation) is convenience only, the backend still existence-validates every id server-side                                          |
| 7   | Known out-of-scope gaps flagged, not fixed | The create form's case-study picker does not exclude a case study that already has a library record (no cheap existence check exists for that client-side) — picking one just surfaces the backend's own real 409, documented directly in `lib/case-study-library.ts`                   |
| 8   | Live-rendered / verified                   | `next build` confirms all 4 new `/case-study-library` routes compile and are present in the route table; lib/component unit tests cover the fetch and add/remove-testimonial paths directly — no local `dashboard-api` was available to visually confirm the authenticated success path |
| 9   | Documentation updated                      | This checklist; no separate implementation doc, per the collapsed-file convention (backend's own `docs/implementation/module-case-study-library.md` already covers this module)                                                                                                         |
| 10  | Exact branch/commit verified               | Branch `dashboard-web-case-study-library`, commit `e759985` — not yet pushed to `origin`                                                                                                                                                                                                |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — the Case Study Library backend
  (`apps/dashboard-api/src/case-study-library/*`) is unchanged, already live in production.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — matches the module registry's own precedent;
  no confidentiality field exists on `CaseStudyLibraryRecordEntity`.

## Light-tier review — summary

A single direct read-through pass verified: the create-only field contract
(`publicId`/`caseStudyId`, both `.omit()`'d from `updateCaseStudyLibraryRecordSchema`) against the
real backend DTO; the `PATCH`-not-`POST .../update` submit method, matching the backend's own real
HTTP-method convention (`case-study-library.controller.ts`'s `@Patch(":id")`); the create form's
case-study picker filtered to `CREATABLE_FROM_STATUSES` (`published`/`unpublished`/`archived`),
matching D5's `CaseStudyLibraryService`'s own gate; `testimonials`' `quote`/`author`/`role` max
lengths (2000/255/255) and the 20-row cap, matching `case-study-library.dto.ts`'s
`testimonialSchema`/`MAX_TESTIMONIALS`; and reuse of every established shared helper
(`detail-section-styles.ts`, `list-filter-styles.ts`, `list-table-styles.ts`, `pagination.ts`,
`action-link-style.ts`, `api-errors.ts#postMutation`, `TagListField`/`RelationshipPicker` from
`@webdesk/ui`) instead of re-implementing any of them.

**1 finding, fixed**: the form's client-side `relatedPageIds` UUID-format check hand-duplicated the
regex literal `lib/uuid.ts#isUuid()` already exports (the exact duplication class this project's
own review history has flagged repeatedly on other branches) — fixed to import and call `isUuid()`
directly. While fixing it, also corrected the testimonials list's row markup to use the
established `rowMain`-wrapped structure (`project-subresource-section.module.css`) instead of three
bare flex children directly inside `.row`, so the Remove button sits at the row's trailing edge via
`justify-content: space-between` the way every sibling sub-resource row already does, rather than
wrapping inline with the quote text.

A separate `security-review` pass was skipped per the standing rule — the diff adds no new
endpoint, no new input reaching a dangerous render path (`testimonials` is plain text, never
rendered via `dangerouslySetInnerHTML`), and every mutation still routes through the backend's own
unchanged `OriginCheckGuard`/`PermissionGuard`/existence-validation.

## Sign-off

**Required second-role human review:** _Pending — this checklist is the review artifact for
Jitesh D, per the light-tier convention (no separate published packet)._

**Gate:** _Not yet requested._
