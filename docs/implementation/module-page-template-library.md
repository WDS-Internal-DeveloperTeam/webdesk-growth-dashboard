# Page Template Library module

## Scope

The Page Template Library module — module #19 on the Recommended Module Roadmap
(`canonical-inputs/Recommended_Module_Roadmap.md`), sourced from
`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §16` and
`04_Data_Model_and_Ownership.md:152`. Defines reusable page architecture by page type (homepage,
service, platform, industry, location, case study, portfolio, landing, article, About, Contact,
Team, Careers, archive/category, confirmation, 404, campaign/event) — required/optional sections,
supported components, content requirements, search requirements, conversion goal, and the related
PHP template file. Built directly on the explicit "start Page Template Library" instruction,
mirroring Component Library (module #17, the most recent sibling in the same `creative_design`
RBAC domain, same real-version-history pattern) file-for-file as the structural template.

### Design decisions

**D1 — real multi-row version history, single physical table**, matching Design Token
Library/Component Library/Section and Pattern Library/Website Strategy Center's own established
precedent: every version is its own physical row in `page_templates`; `recordId` is the stable
logical-record identity copied forward across versions; `isCurrent` flags exactly one row per
`recordId`; `publicId` uniqueness is a PARTIAL unique index `WHERE is_current = true`;
`(recordId, versionNumber)` is uniquely indexed. `approvalStatus` reuses the shared generic
8-value `TRANSITIONS` table verbatim (submit/review/approve actions), with the same deliberate
"no `approved -> superseded` edge" deviation every version-history module in this codebase shares
— supersede is an automatic side effect of a new version's own `-> approved` transition,
via `supersedeOtherApprovedVersion()`.

**D2 — `requiredSections`/`optionalSections`: REAL, existence-validated relationships into
`section_and_pattern_records`** (Section and Pattern Library, already live). Stored as
`requiredSectionIds`/`optionalSectionIds: string[]` — each entry a Section and Pattern Library
`recordId`. Validated via a new narrow, read-only `SectionAndPatternLibraryService
.existingRecordIds()` delegating method (mirroring `DesignTokensService.existingTokenIds()`'s own
already-reviewed pattern) backed by a new `SectionPatternRecordRepository.findByIds()`. Confirmed
directly with the user (`AskUserQuestion`).

**D3 — `supportedComponents`: REAL, existence-validated relationship into `components`**
(Component Library, already live). Stored as `supportedComponentIds: string[]` — each entry a
Component Library `recordId`. Validated via a new narrow, read-only
`ComponentsService.existingComponentIds()` delegating method, backed by
`ComponentRepository.findByIds()` (mirrors `assertTokenIdsExist()`'s pattern exactly). Confirmed
directly with the user.

**D4 — `wireframes`: plain, UNVALIDATED string array (`wireframeReferences`)**, not a real
relationship. `wireframe_library` doesn't exist yet — it and `page_template_library` are a real
co-dependent cycle in the seeded module registry (`docs/phase-plans/module-implementation-roadmap.md`
§4.2: "a template references its wireframe and a wireframe references the template it
implements"). Matches the precedent already set for Service Library's `icpIds`/Persona Library's
`relatedServiceIds` when their own target module didn't exist at build time. Confirmed directly
with the user — link it for real once Wireframe Library is built.

**D5 — `pageType`: a finite ENUM**, not free text. The spec's own list is closed and short (17
values: `homepage`, `service`, `platform`, `industry`, `location`, `case_study`, `portfolio`,
`landing`, `article`, `about`, `contact`, `team`, `careers`, `archive_category`, `confirmation`,
`not_found`, `campaign_event`) — unlike Component Library's own 40+-item non-exhaustive
`category`, this is a genuinely closed set worth an ENUM, matching Design Token Library's own
`group` precedent.

**D6 — RBAC: reuse `creative_design` verbatim, no new migration.** Same group Component
Library/Design Token Library/Section and Pattern Library already use. No publish/unpublish
mechanism — matches every sibling's own established precedent (the group's seeded `P`/`X` grants
stay unwired).

### Other fields — judgment calls

- **`requiredSections`/`optionalSections`/`supportedComponents`**: real relationships per D2/D3.
- **`contentRequirements`, `searchRequirements`, `conversionGoal`**: plain nullable long text
  (`TEXT`, capped 4,000 chars at the DTO layer) — narrative/prose fields, rich-text-eligible once
  a `dashboard-web` UI exists (2026-08-22 standing rule applies at that point, not this backend
  pass).
- **`phpTemplateRelationship`**: plain nullable text (path/reference string, capped 2,000 chars) —
  matches Component Library's `phpPath` precedent (factual, not narrative).
- **`name`**: required string, capped 255 chars, matching every sibling.
- **`replacementRecordId`**: nullable self-referential `recordId`, existence-checked in-module,
  not immutable across the version chain — matches Component Library's identical field exactly.
- No `projectId` scoping — organization-wide, matching every other library-shaped module. No
  confidential-field mechanism — the module registry's own seeded `confidentialityLevel` for
  `page_template_library` is `null` (migration `00035`).

Backend-only pass — `dashboard-web` UI is a separate, not-yet-requested next step, matching every
prior module's own backend-first precedent.

## As-built

Built file-for-file mirroring Component Library (`packages/database/src/component-library/*`,
`apps/dashboard-api/src/component-library/*`, migrations `00078`/`00079`) as the structural
template. Migration numbers `00082`/`00083` (confirmed next via `ls
packages/database/src/migrations/ | tail`, not assumed).

**`packages/database/src/page-template-library/`**: `entities.ts` (`PageTemplateEntity`,
`PageTemplateApprovalStatus`, `PageType` — the 17-value closed ENUM per D5), `models.ts`
(`page_templates` table, `underscored: true`), `entity-mapping.ts` (per-module
`toEntityWithIsoDates()`, matching every sibling module's own independent copy),
`page-template.repository.ts` (`PageTemplateRepository` — `create()`/`createNewVersion()`/
`findCurrentByRecordId()`/`findCurrentByPublicId()`/`listVersions()`/`list()`/
`updateInPlace()`/`updateApprovalStatus()`/`supersedeOtherApprovedVersion()`, all mirroring
`ComponentRepository`'s own method shapes and CAS-guard discipline exactly), `index.ts`.
(An initial `findByIds()` on this same repository — for a hypothetical future consumer validating
INTO this table — was added speculatively with no real caller, flagged by code review, and
removed; add it back if/when a real consumer, e.g. Wireframe Library, actually needs it.)

**Migration `00082-create-page-template-library.ts`**: `page_templates` table with the standard
version-history column set (`id`/`record_id`/`public_id`/`page_type`/`version_number`/
`is_current`/`name`/`approval_status`/`created_by`/`updated_by`/timestamps) plus
`required_section_ids`/`optional_section_ids`/`supported_component_ids` (`UUID[]`, real
existence-validated relationships per D2/D3), `wireframe_references` (`VARCHAR(500)[]`, plain
unvalidated per D4), `content_requirements`/`search_requirements`/`conversion_goal` (`TEXT`,
nullable), `php_template_relationship` (`VARCHAR(2000)`, nullable), `replacement_record_id`
(`UUID`, nullable, self-referential). Indexes: partial unique on `public_id WHERE is_current =
true`; unique on `(record_id, version_number)`; plain index on `(record_id, is_current)`; the two
additional indexes Section and Pattern Library's own code review already added
(`(updated_at, id) WHERE is_current = true` for `list()`'s real query shape, and `(record_id,
approval_status)` for `supersedeOtherApprovedVersion()`'s own filter) were included proactively
in this migration's first version, not added in a later fix round; pg_trgm GIN index on `name`.
Migration `00083` marks `page_template_library` `in_development` in `module_registry`.

**Cross-module relationship wiring (D2/D3)**: added `findByIds()` to
`SectionPatternRecordRepository` (`packages/database/src/section-and-pattern-library/
section-pattern-record.repository.ts`, was previously missing — Section and Pattern Library had
never needed a batch-existence lookup before) and a new `SectionPatternsService.existingRecordIds()`
delegating method (`apps/dashboard-api/src/section-and-pattern-library/section-patterns.service.ts`),
both mirroring `DesignTokenRepository.findByIds()`/`DesignTokensService.existingTokenIds()`'s
already-reviewed pattern exactly. `ComponentRepository.findByIds()` already existed (added during
Component Library's own build, previously unconsumed); added the matching
`ComponentsService.existingComponentIds()` delegating method
(`apps/dashboard-api/src/component-library/components.service.ts`) as its first real consumer.
Both are narrow, read-only delegating methods — `PageTemplateLibraryModule` never imports either
module's write-capable repository token directly.

**`apps/dashboard-api/src/page-template-library/`**: `page-template-library.constants.ts`
(`PAGE_TEMPLATE_REPOSITORY`, `MODULE_KEY = "creative_design"`), `page-template-library.dto.ts`
(`listPageTemplatesQuerySchema`/`createPageTemplateSchema`/`updatePageTemplateSchema`/
`changePageTemplateApprovalStatusSchema` — `requiredSectionIds`/`optionalSectionIds`/
`supportedComponentIds` are `z.array(z.string().uuid())` per D2/D3, `wireframeReferences` is
`z.array(z.string().min(1).max(500))` — deliberately NOT uuid-validated per D4;
`updatePageTemplateSchema` rejects an empty patch via `.refine()`, matching every sibling),
`database.providers.ts`, `page-templates.service.ts` (`PageTemplatesService` — the same
`TRANSITIONS` table shape as `ComponentsService`/`DesignTokensService`/`SectionPatternsService`,
including the "no `approved -> superseded` edge" deviation; `assertSectionIdsExist()` (called for
both `requiredSectionIds`/`optionalSectionIds`, parameterized by field name for the error
message), `assertComponentIdsExist()`, `assertReplacementExists()` — all run via `Promise.all`
alongside the publicId-existence check in `create()`/`update()`, mirroring `ComponentsService`'s
own concurrency reasoning), `page-templates.controller.ts` (routes under
`page-template-library/page-templates`: `GET /`, `GET /:recordId`, `GET /:recordId/versions`,
`POST /`, `POST /:recordId/update`, `POST /:recordId/status`), `page-template-library.module.ts`
(imports `AuthModule`/`AuthzModule`/`AuditModule`/`SectionAndPatternLibraryModule`/
`ComponentLibraryModule`), `page-templates.service.spec.ts` (52 unit tests, mirroring
`components.service.spec.ts`'s own coverage plus dedicated tests for the two new relationship
validations and the unvalidated `wireframeReferences` field). Wired into `app.module.ts`
alphabetically between `PageInventoryModule` and `PageWorkspaceModule`.

**Tests added**: `page-templates.service.spec.ts` (52 tests, new), `existingComponentIds` test
added to `components.service.spec.ts` (1 test, new), `existingRecordIds` test added to
`section-patterns.service.spec.ts` (1 test, new),
`packages/database/test/module-page-template-library.integration.test.ts` (27 tests, new, real
disposable PostgreSQL database), `findByIds()` coverage added to
`module-section-and-pattern-library.integration.test.ts` (2 tests, new),
`apps/dashboard-api/test/page-template-library.e2e-spec.ts` (31 tests, new, real disposable
database + real seeded RBAC — covers the full 3-tier submit/review/approve matrix, both real
cross-module existence validations over real HTTP, the unvalidated `wireframeReferences` field,
and a full real end-to-end version-history round trip).

**Validation, all independently run against a real local disposable PostgreSQL 17 database**
(`webdesk_phase1b_dev`): 1292/1292 `dashboard-api` unit tests (54 new/changed), 572/572
`dashboard-api` e2e/integration tests (31 new), 572/572 `packages/database` integration tests (29
new), a full migration up → down → up round-trip (individually reverting/reapplying `00082`/
`00083`, plus the full down-to-0/up-all cycle every integration test file already exercises),
`validate:module-registry` (43 modules, 21 permission groups, all references resolve),
`boundaries:check` (0 errors, 8 pre-existing unrelated warnings), typecheck/lint (`--max-
warnings=0`)/prettier all clean across `packages/database` and `apps/dashboard-api`, `pnpm audit`
0 vulnerabilities.

No `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
matching every prior module's own backend-first precedent. Not yet independently code-reviewed,
security-reviewed, second-role human reviewed, gated, or merged.

## As-built — `dashboard-web` UI

Built directly on the explicit "Start the dashboard-web UI for it" instruction, closing this
module's last named gap. Mirrors **Component Library's** UI structure file-for-file (the closest
sibling — real FK-validated relationships via `@webdesk/ui`'s `RelationshipPicker` plus real
multi-row version history), on branch `dashboard-web-page-template-library`.

**Rich-text conversion, backend-paired**: `contentRequirements`/`searchRequirements`/
`conversionGoal` now go through the existing `RichTextEditor` (Tiptap) component, per the
2026-08-22 standing rule requiring every new `dashboard-web` long-text field to use it. This
required a real backend change in the same branch: `PageTemplatesService.create()`/`update()`
(both the in-place and fork branches) now wire `sanitizeNullableRichText()`/
`sanitizeNullableRichTextIfChanged()`/a local `sanitizeOrInherit()` helper (mirroring
`SectionPatternsService`'s/`WebsiteStrategyRecordsService`'s own identical fork-branch pattern),
and the DTO's length cap was raised 4,000→40,000 to match the converged ceiling every sibling
rich-text conversion lands on. `phpTemplateRelationship` stays plain text (factual, not narrative,
matching Component Library's own precedent).

**Frontend**: `PageTemplateRecord`/`PageTemplateApprovalStatus`/`PageType` added to
`packages/shared-types`; `lib/page-template-library-query.ts`/`lib/page-template-library.ts`
(zero-non-type-import-file split, including cross-module picker-option fetches for Section and
Pattern Library records and Component Library components, plus a self-referential
replacement-record fetch); `PageTemplateLibraryForm` (create-only `publicId`/`pageType`;
`RelationshipPicker` for `requiredSectionIds`/`optionalSectionIds`/`supportedComponentIds`;
`TagListField` for the unvalidated `wireframeReferences`; `RichTextEditor` for the 3 narrative
fields; a self-referential `SinglePageTemplatePicker` for `replacementRecordId`, the 3rd
independent hand-copy of that wrapper shape — already self-documented as accepted debt, matching
`SingleComponentPicker`/`SinglePagePicker`); `PageTemplateStatusActions` mirroring the backend's
`TRANSITIONS` table exactly, including the `approved → ["archived"]`-only divergence; four routes
under `app/(shell)/page-template-library/` (list, detail with a real Version history section,
create, edit).

**Independent code review** (this project's own `code-review` skill, high effort, 8-angle finder
pass via parallel subagents, 1-vote self-verification) — 10 findings kept in the final report (4
CONFIRMED and fixed, 6 PLAUSIBLE left as accepted tracked debt). Fixed: `arrayField()` extracted
into a new `arrayFieldValue()` export in `lib/rich-text.ts` (a 2nd byte-identical copy, past this
codebase's own 2-occurrence extraction threshold already applied to `richTextFieldValue()`),
retrofitted onto `section-and-pattern-library-form.tsx` too, with 3 new regression tests; two
inaccurate doc comments corrected — the status-actions component's self-declared duplication
ordinal (verified via grep that sibling files' own claimed ordinals have already drifted
out of sync with each other and don't track a real count) now points at a grep command instead of
asserting a specific number, and the `RICH_TEXT_MAX_LENGTH=40_000` rationale comment (which
claimed a "10x ratio" every sibling applies, factually inaccurate — the real, verified pattern is
convergence on a fixed 40,000-character ceiling regardless of starting cap, and Section and
Pattern Library was incorrectly cited as an already-converted example) was rewritten to state the
real pattern. Left as accepted, tracked debt (each already matching an established duplication
class elsewhere in this codebase, or too narrow/inherited to justify fixing in this branch): the
audit trail (`afterState`) logging raw pre-sanitization HTML for the 3 rich-text fields (byte-
identical to Website Strategy Center's/Section and Pattern Library's own already-shipped audit
calls); three near-identical option-filtering `useMemo` blocks; selected-chip id-to-label
resolution duplicated 3x; the `replacement` display value resolved via a one-off `useState`
initializer instead of a `useMemo` (low risk today — `props.pageTemplates` never refetches after
mount in this page's own fetch-once pattern); the create/edit empty-value sentinel ternary
independently re-derived 4 times including an inlined copy for `replacementRecordId`; three
near-identical picker-fetch functions; and `plainField()`, an 8th independent hand-copy of the
same closure shape already duplicated across 7 sibling forms with no shared helper ever extracted
(retrofitting one onto all 8 already-shipped forms was judged out of scope for this branch, unlike
`arrayField()`'s narrower 2-occurrence fix).

**Real, out-of-scope bug discovered and flagged, not fixed in this branch**: while verifying the
`RICH_TEXT_MAX_LENGTH` doc-comment fix, found that Section and Pattern Library's own already-
merged `dashboard-web` UI (PR #80) wires `RichTextEditor` for its 3 narrative fields, but that
module's own backend length cap was never raised from 20,000 to the converged 40,000 ceiling to
match, and its own dto comment is now stale (still claims no UI exists yet). This means a user can
currently type up to 40,000 characters of rich content into that module's own editor and have the
submission silently rejected by the backend's stale 20,000-character cap. Flagged as a separate
follow-up task (spawned as a background-task suggestion) rather than fixed here, since it touches
a different, already-merged, already-reviewed module's own backend and needs its own review cycle.

**Re-validated after the fix round**: 1207/1207 `dashboard-web` unit tests (3 new), 1299/1299
`dashboard-api` unit tests (unchanged — the fixes were doc-comment-only on the backend side),
typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean across `packages/shared-
types`, `apps/dashboard-api`, and `apps/dashboard-web`; all 4 new routes present in the build
output.

**A separate `security-review` skill run then found 0 findings above threshold** — confirmed all
3 write paths (`create()`, `update()`'s in-place branch, the fork branch) run sanitization with no
gap, both a `<script>`-strip test on create and on the fork branch exist; every render site for
the 3 rich-text fields (current version and every version-history disclosure entry) routes
exclusively through the shared, already-audited `SanitizedRichText` component; `phpTemplateRelationship`
correctly renders as plain JSX text, never through that component; the relationship pickers render
only plain-text option labels with real enforcement server-side (`assertReplacementExists()`,
the `hasOverlappingSectionIds()` Zod refinement) rather than relying on client-side exclusion
logic; no IDOR (relationship ids are existence-validated against the caller's own already-
permission-filtered list responses); and the picker-fetch functions target only a trusted,
build-time API base URL plus hardcoded paths or a UUID-validated `recordId`, with no SSRF or
credential-leakage surface.

Required second-role human review complete — the project owner reviewed the published review
packet and returned "Approved as-is," accepting the 6 open PLAUSIBLE findings as tracked debt. The
gate (`G4-dashboard-web-page-template-library`) was then separately requested and approved —
WebDesk Solution, decision CONFIRM, approved commit `39e8deb` on branch
`dashboard-web-page-template-library`. Pushed to `origin`, opened as
[PR #83](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/83), all 14
CI checks green. Not yet merged — merge remains its own separate, not-yet-requested
authorization, per this project's standing "no auto-merge" rule.
