# Case Study Library — Module #24

## Scope

Module #24 on the Recommended Module Roadmap, built directly on the explicit "start Case Study
Library" instruction. Depends on Case Study Studio (module #23, already live in production).

**Design fork confirmed directly with the project owner first** (`AskUserQuestion`): the canonical
spec (`03_Detailed_Module_Specifications.md §8`) describes Case Study Library as "published and
unpublished case study records, with relationships to services, pages, technologies, industries,
claims, assets, and testimonials" — almost entirely the same data Case Study Studio already owns
(`relatedServiceIds`, `relatedClaimIds`, `industry`, `visibility`, `status`), plus a few fields
Studio's own schema doesn't have (`relatedPageIds`, `technologies`, `testimonials`). Three options
were presented — a fully separate table with its own copy of core fields, no new table at all (just
a browse view over Studio), or an extension table FK'd to Studio storing only the missing fields.
**The project owner chose the extension-table approach.**

### Design decisions

- **D1 — extension table, not a duplicate.** `case_study_library_records` carries a real,
  unique DB-level FK into `case_studies` (one library record per case study). It stores only
  `relatedPageIds`/`technologies`/`testimonials`; every other field (status, visibility, client
  name, project title, industry, etc.) is read by joining the parent `case_studies` row at the
  service layer — never copied.
- **D2 — `relatedPageIds` is existence-validated, org-wide, against the real Page Inventory
  `pages` table.** Since a case study can legitimately reference a page in any project, this
  needed a new org-wide (non-project-scoped) existence check: `PageRepository.findByIds()`
  (packages/database) and `PagesService.existingPageIds()` (apps/dashboard-api), mirroring
  `ServicesService.existingServiceIds()`'s own bare-`Set<string>` shape.
- **D3 — `technologies` is a plain, unvalidated string array** — no dedicated "technologies"
  module exists anywhere in this codebase, mirroring Service Library's own `icpIds` precedent.
- **D4 — `testimonials` is a JSONB array of `{quote, author, role}`** — short, structured plain
  text (not long-form content), validated for shape/length at the Zod DTO layer only. No
  rich-text/HTML, no sanitization mechanism.
- **D5 — a library record may only be CREATED once the parent case study's status is
  `published`/`unpublished`/`archived`** — matching the spec's own framing of this module.
  Enforced at the service layer (`case_studies.status` lives in a different table a migration
  can't `CHECK` against).
- **D6 — no confidentiality/redaction mechanism**, deliberately mirroring Case Study Studio's own
  D9 precedent (`00091-create-case-study-studio.ts`): the module registry's seeded
  `confidentiality_level` text for `case_study_library` describes the joined parent's own
  `visibility` workflow vocabulary, not a new redaction axis this module introduces or enforces on
  read — Studio's own migration explicitly decided `visibility` is a workflow/publication concept,
  not a per-field redaction axis, and Library follows that same precedent for consistency (the
  same case study's same content shouldn't be redacted through one route and not the other).
- RBAC: reuses the real, seeded `case_studies` permission group verbatim (declared as its own
  local `CASE_STUDY_LIBRARY_MODULE_KEY` constant, not imported across the module boundary — see
  the code-review fix below) — no new RBAC migration. No delete route (no `D` action in the seeded
  matrix) and no independent status-transition route (this record has no independent lifecycle).

## As-built

Built by a background agent with a fully-specified prompt (exact schema, file layout, known bug
classes from prior modules to avoid — terminal-state CAS races, class-level RBAC decorators, raw
repository exports across module boundaries), then independently re-verified in full by the
orchestrating session — every high-risk file read directly (migration, service, controller RBAC
placement), every test suite independently re-run against a fresh local disposable PostgreSQL 17
database, not trusted from the agent's own report.

- `packages/database/src/migrations/00093-create-case-study-library.ts`,
  `00094-mark-case-study-library-in-development.ts`
- `packages/database/src/case-study-library/{entities,entity-mapping,models,
case-study-library-record.repository,index}.ts`
- `packages/database/src/index.ts` and `index.cjs.ts` — both updated together
- `packages/database/src/page-inventory/page.repository.ts` — added `findByIds()`
- `apps/dashboard-api/src/page-inventory/pages.service.ts` — added `existingPageIds()`
- `apps/dashboard-api/src/case-study-library/{case-study-library.constants,dto,service,
controller,module,database.providers}.ts` + unit spec
- `apps/dashboard-api/src/app.module.ts` — wired in `CaseStudyLibraryModule`
- `apps/dashboard-api/test/case-study-library.e2e-spec.ts`
- `packages/database/test/module-case-study-library.integration.test.ts`

Backend-only pass — no `dashboard-web` UI, matching every prior module's own backend-first
precedent.

### Validation (independently re-run, not trusted from the build agent's own report)

- Migration up/down/up round-trip against a real local disposable PostgreSQL 17 database: clean
  (94 migrations)
- `packages/database` unit: 28/28; integration: 690/690 (16 new)
- `dashboard-api` unit: 1494/1494 (30 new, after the code-review fix round); e2e: 690/690 (13 new,
  after the code-review fix round) — full RBAC matrix, the D5 status gate, the D1
  one-record-per-case-study conflict, D2 page-id validation, empty-patch rejection, 404s, and the
  new archived-parent edit rejection
- `pnpm validate:module-registry` — 43 modules, 21 permission groups, clean
- `pnpm audit` — 0 vulnerabilities
- typecheck/lint (`--max-warnings=0`)/prettier — clean across `apps/dashboard-api` and
  `packages/database`

### Independent code review

High effort, 8-angle finder pass (3 correctness angles, reuse, simplification, efficiency,
altitude, conventions), 1-vote verification. 10 candidates verified after dedup — 5 CONFIRMED, 3
PLAUSIBLE, 2 REFUTED. All 5 CONFIRMED findings fixed:

1. **`update()` had no terminal-state guard on the parent case study's status**, contradicting its
   own doc comment's claim to check it — an archived case study's library record stayed freely
   editable forever. Fixed by fetching the parent up front and rejecting edits once
   `status === "archived"`, mirroring every sibling module's own terminal-state guard (Page
   Inventory, Content Template Library, Website Strategy Center) — this restructuring also
   removed the now-redundant second parent-fetch at the end of the method.
2. **The TOCTOU race-loser path for a duplicate `publicId` threw `ConflictException` (409)** while
   the deterministic pre-check threw `BadRequestException` (400) for the identical logical error.
   Fixed to consistently throw `BadRequestException`, matching `CaseStudiesService`'s/
   `PersonasService`'s own create() methods.
3. **The same TOCTOU catch collapsed two distinct unique-index violations** (`public_id` vs.
   `case_study_id`) into one ambiguous message, even though the raw Sequelize error still carries
   the real field name. Fixed by reading the caught error's own `.fields` (a duck-typed property
   read, not an `instanceof` check — ADR-0006 only forbids importing the `sequelize` class) to
   report which one actually collided.
4. **`CASE_STUDY_LIBRARY_MODULE_KEY` is now declared locally** with the same literal value
   (`case_studies`) instead of importing `CASE_STUDY_STUDIO_MODULE_KEY` across the module
   boundary — matching every sibling module's own convention for a coincidentally shared
   permission-group value (e.g. Persona Library independently redeclares Service Library's
   identical value rather than importing the symbol).
5. **(Inherited, already-accepted debt — left as-is)** `create()`/`update()` race a
   404-throwing existence check against a 400-throwing validation check via `Promise.all`,
   matching `PersonasService.update()`'s own identical, already-reviewed shape.

3 PLAUSIBLE findings left as accepted, tracked debt:

- The new org-wide, non-project-scoped `existingPageIds()`/`findByIds()` pair has no RBAC scoping
  of its own, reachable from routes gated only on the `case_studies` permission group. Tempered:
  every role currently capable of `case_studies:create`/`edit` in the real seeded matrix also
  holds `page_inventory` grants today, and the check only reveals bare id-existence (not content)
  for already-known 128-bit UUIDs, matching the already-accepted `ServicesService
.existingServiceIds()` shape.
- `list()` resolves each record's parent case study via one `findById()` call per row instead of a
  batch query — a real but modest cost, explicitly justified in the method's own doc comment (no
  batch `findByIds()` exists on `CaseStudiesService` today returning full enriched entities, only
  a bare-`Set` shape).
- `update()`'s original sequential parent-fetch-after-write cost was incidentally eliminated by
  fix #1 above (the parent is now fetched once, up front, and reused).

Regression tests added for all three fixes (2 unit, 1 e2e).

### Security review

`security-review` skill run separately against the fixed branch. **0 findings above the
confidence threshold.** Confirmed: `@RequirePermission` decorators are method-level throughout
(never class-level), `OriginCheckGuard` present on both mutating routes, all inputs validated via
Zod/`ParseUUIDPipe`, all search predicates route through the already-audited
`escapeLikePattern()`, the TOCTOU catch uses the existing duck-typed `isSequelizeUniqueConstraintError()`
helper (no direct `sequelize` import, per ADR-0006), `existingPageIds()`/`findByIds()` return only
a bare id `Set` (no field/PII leakage) and correctly avoid exporting a write-capable repository
across the module boundary, and no confidentiality/redaction gap is introduced beyond what Case
Study Studio's own D9 already establishes.
