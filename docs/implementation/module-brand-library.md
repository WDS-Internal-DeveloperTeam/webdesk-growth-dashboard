# Brand Library (module #13) — scope and as-built record

> **New template, effective 2026-08-27**: this single file replaces the old task-package +
> implementation-doc pair. The `## Scope` section below is written before any code exists; the
> as-built sections are appended once the module is built and verified.

## Scope

### Pre-implementation verification

| Check                                | Result                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Recommended roadmap position         | Row 13, Wave 4 — `canonical-inputs/Recommended_Module_Roadmap.md`                 |
| Dependency-computed roadmap position | Wave 1, no dependencies — `docs/phase-plans/module-implementation-roadmap.md`     |
| Registry dependency                  | `null` — no prerequisite module                                                   |
| RBAC permission group                | `creative_design`, already seeded (migration `00013`) — **no new RBAC migration** |
| Confidentiality level (seeded)       | `null` — organization-wide, no confidential-field mechanism needed                |
| Open Critical/High security finding  | None                                                                              |
| Blocking credential                  | None                                                                              |

Source material: `03_Detailed_Module_Specifications.md §10` (flat field list: logos, colors,
typography, photography, illustration, icon rules, tone, visual personality, dos/don'ts,
deprecated assets — "every active asset has status, version, approval, file reference, and usage
rules"). No wireframe, no data-model table cluster, and no workflow-state-machine section name
this module specifically — the smallest-honest-reading precedent every module since Projects has
followed applies here too.

### In scope

One organization-wide table, `brand_library_records`, RBAC-gated on the seeded `creative_design`
group.

### Design decisions (all user-confirmed via `AskUserQuestion` before any code was written)

**D1 — Single generic table, `recordType` discriminator.** Mirrors Business Knowledge Center's
precedent for a heterogeneous flat field list with no per-type schema basis in the canonical spec.
`recordType` enum: `logo | color | typography | photography | illustration | icon_rule | tone |
visual_personality | dos_dont`. No project scoping (brand identity is organization-wide, matching
the seeded `confidentialityLevel: null` and every other creative/library module's own
organization-wide precedent).

**D2 — `fileReference`: plain nullable URL field, not a new attachment mechanism.** A
`safeHttpUrlSchema`-validated (`@webdesk/validation`) nullable string. Guidance-only records
(`tone`, `visual_personality`, `dos_dont`) legitimately have no file; asset-like records
(`logo`, `photography`, `illustration`) do. No Asset Library module and no provisioned Vercel Blob
store exist yet (open blocker in `CLAUDE.md`) — building real upload/storage infrastructure for
this module now would be premature, matching Service Library's/Persona Library's own precedent of
deferring heavy infra until a dedicated module needs it.

**D3 — Deprecated is a status, not a recordType.** Any record of any type can be marked
deprecated — matches the no-hard-delete precedent every module in this codebase already follows
(e.g. Business Knowledge Center's own `deprecated` status). No separate `deprecated_asset`
recordType.

**D4 — Standard 8-value `ArtifactApprovalStatus` workflow, reused verbatim.** The seeded
`creative_design` RBAC row (`designer_creative_reviewer: VCERAS`, `marketing_editor: VR`,
`developer: V`, `qa_security_reviewer: VR`, only `super_admin`/`owner_growth_approver` hold `P`)
matches the same submit/review/approve vocabulary Service Library/Persona Library/Content Template
Library already use, not Business Knowledge Center's own bespoke 5-value status. Reuses the exact
`TRANSITIONS` table (byte-for-byte, matching the established precedent of copying this table
verbatim into each new module rather than sharing it — already-accepted, tracked debt recorded at
each prior occurrence).

**D5 — Real publish/unpublish, orthogonal to approval.** The seeded `creative_design` group's
unused `P` grant gets the same real mechanism Content Template Library built: `isPublished`/
`publishedAt`, gated on `publish`/`unpublish` RBAC actions, atomic compare-and-swap on both the
approval-status CAS guard (mirrors `ContentTemplateRepository.updatePublishState()`) and the
publish-state CAS guard itself. `publish()` requires `approvalStatus === "approved"`; `unpublish()`
has no status restriction (an operator must always be able to pull a published record down).
`publishedAt` stamped once via `COALESCE`, never cleared, never overwritten.

**D6 — `version` is server-managed**, incremented by 1 on every successful content update
(never on a status-transition or publish/unpublish call) — mirrors `personas.version`/
`content_templates.version`.

**D7 — No sub-resources, no cross-module relationship fields.** The spec names no relationships
for this module (unlike Service Library's `icpIds` or Persona Library's `relatedServiceIds`).

### Deliberately out of scope this pass

No `dashboard-web` UI — backend only, matching every prior module's own backend-first precedent.

---

## As-built

Built directly, mirroring Content Template Library's backend structure exactly (schema, DTOs,
service, controller, module wiring, RBAC placement, CAS-guard patterns). One organization-wide
table, `brand_library_records` (migration `00070`), plus `00071` marking the module
`in_development` in `module_registry`.

`packages/database/src/brand-library/`: `entities.ts` (`BrandLibraryRecordType`,
`BrandLibraryApprovalStatus`, `BrandLibraryRecordEntity`), `models.ts`, `entity-mapping.ts`,
`brand-library-record.repository.ts` (`BrandLibraryRecordRepository` — `create`/`findById`/
`findByPublicId`/`list`/`update`/`updateApprovalStatus`/`updatePublishState`, the last two as
atomic compare-and-swap methods mirroring `ContentTemplateRepository`'s own), `index.ts`. Exported
from both `packages/database/src/index.ts` and `index.cjs.ts` (the separate, manually-maintained
CommonJS barrel Vercel's Function bundler uses in production).

`apps/dashboard-api/src/brand-library/`: `brand-library.constants.ts` (`BRAND_LIBRARY_MODULE_KEY =
"creative_design"`, distinct from the `module_registry.key = "brand_library"`),
`brand-library.dto.ts` (Zod schemas; `fileReference` validated via `safeHttpUrlSchema` from
`@webdesk/validation`, not a bare string — closing the same stored-XSS class Projects'
`environment.url` once shipped with unguarded), `database.providers.ts`, `brand-library.service.ts`
(`BrandLibraryService` — reuses `ContentTemplatesService`'s exact `TRANSITIONS` table and
terminal-state/CAS-guard patterns for `update()`/`changeApprovalStatus()`/`publish()`/
`unpublish()`; `description`/`usageNotes` sanitized via `sanitizeNullableRichText()`/
`sanitizeNullableRichTextIfChanged()` per the 2026-08-22 standing rich-text rule — no
`dashboard-web` UI exists yet, but the backend is built sanitize-ready from day one rather than
needing a follow-up pass), `brand-library.controller.ts` (routes under
`brand-library/records`: `GET /`, `GET /:id`, `POST /`, `POST /:id/update`, `POST /:id/status`,
`POST /:id/publish`, `POST /:id/unpublish` — all mutating routes gated on
`OriginCheckGuard`+`PermissionGuard`, `SessionGuard` at controller level), `brand-library.module.ts`
(imports `AuthModule`/`AuthzModule`/`AuditModule` only, no cross-module import per D7). Wired into
`apps/dashboard-api/src/app.module.ts` alphabetically after `AuthzModule`/before
`BusinessKnowledgeModule`.

The real seeded `creative_design` RBAC matrix (`00013-seed-rbac-matrix.ts:136-144`) differs from
`page_content`'s own shape in a way that mattered for the e2e suite: `designer_creative_reviewer`
holds `VCERAS` (view/create/edit/review/approve/**submit**) — a single role that can drive the
entire draft→approved lifecycle alone, unlike Content Template Library's split
`marketing_editor`(submit)/`owner_growth_approver`(approve) roles. Only `super_admin`/
`owner_growth_approver` hold `P` (publish/unpublish).

### Validation (all run directly by this session against a real local disposable PostgreSQL 17

database, `webdesk_brand_library_dev`)

- `packages/database` build (`tsc` ESM + CJS + cjs package.json writer): clean.
- Migration round-trip: `up` (71 total, including `00070`/`00071`) → `down` ×2 → `up` → clean;
  `migrate:status` confirms 71 executed, 0 pending.
- `packages/database` unit tests: 28/28 passing (unchanged — no unit tests touch this module,
  matching Content Template Library's own precedent of integration-only repository coverage).
- `packages/database` integration tests: 416/416 passing overall (389 pre-existing + 27 new, all
  in `test/module-brand-library.integration.test.ts` — CRUD, array/null handling, search
  (`escapeLikePattern`), pagination clamp, the `update()` CAS guard, and both atomic
  compare-and-swap methods under genuine concurrent races plus the TOCTOU publish-guard
  regression test).
- `dashboard-api` unit tests: 970/970 passing overall (925 pre-existing + 45 new in
  `brand-library.service.spec.ts` — create/findById/list/update/changeApprovalStatus/publish/
  unpublish, including sanitization, CAS-guard wiring, and audit-failure-is-logged-not-thrown
  coverage).
- `dashboard-api` e2e tests: 409/409 passing overall (384 pre-existing + 25 new in
  `brand-library.e2e-spec.ts` — 401/403/404/400/409 outcomes, the real
  `designer_creative_reviewer`/`owner_growth_approver`/`marketing_editor`/`read_only` RBAC split,
  the full lifecycle happy path, the unsafe-URL-scheme rejection, and publish/unpublish
  concurrency). Confirmed individually (25/25) and in the full suite; the full 24-file sequential
  suite showed pre-existing, environment-level flakiness unrelated to this module — on 2 of 5 full
  runs a single test failed, each time in a DIFFERENT, already-existing e2e file
  (`business-knowledge.e2e-spec.ts` once, this module's own `brand-library.e2e-spec.ts` once) —
  never the same test twice, consistent with the shared-disposable-database/low-connection-pool
  flakiness this project's own `CLAUDE.md` already documents for its CI Integration-tests job. Not
  a defect in this module's code.
- `dashboard-api` build (`nest build`): clean.
- Lint (`eslint --max-warnings=0`) on both `packages/database` and `dashboard-api`: clean.
- Prettier (`--check`) on every touched file: clean (after one `--write` pass on 4 files
  auto-formatted by this session's own initial draft).
- `pnpm audit`: 0 vulnerabilities (unaffected).
- `validate:module-registry`: 43 modules, 21 permission groups, all references resolve
  (unaffected).

No `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
matching every prior module's own backend-first precedent.
