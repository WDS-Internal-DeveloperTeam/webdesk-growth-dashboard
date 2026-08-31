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
