# Persona Library module backend (as-built)

**Status:** Built, fully validated (independently re-verified, not just trusted from the build's
own report), independently code-reviewed (9/10 confirmed findings fixed, 1 accepted as tracked
debt), not yet security-reviewed, gated, or merged. Branch `module-persona-library`, off `main` at
the commit recording PR #49's merge as live in production.

## 1. Why this exists, and its scope

The fourth real business-module backend on the Phase 1F application shell / canonical module
registry, after Projects, Business Knowledge Center, and Service Library — module #4 in the
project-owner-supplied `canonical-inputs/Recommended_Module_Roadmap.md`. Built directly on the
explicit "Start the Persona Library" instruction.

Two scoping decisions were resolved directly with the user (`AskUserQuestion`) before building,
since both would have been costly to redo after the schema shipped:

1. **Edit-while-approved behavior.** The roadmap's own special instruction for this module reads:
   "The Growth Director may recommend changes but cannot silently modify approved personas."
   ("Growth Director" turned out to be one of the dashboard's 15 planned AI business agents, per
   `01_Dashboard_Master_Specification.md` — not a human RBAC role — so this rule is really about
   never letting any writer, human or future-AI, bypass the review workflow.) Chosen: content
   edits (`update()`) stay completely independent of `approvalStatus`, mirroring Service Library's
   own precedent exactly — the rule is already satisfied by the existing gated transition table,
   since nothing can reach `approved` without going through `submit`+`review` first.
2. **Whether to retrofit Service Library's `icpIds`.** Service Library's own `icpIds` field has
   been an unvalidated string array since its own build, with its hint text explicitly noting "no
   persona library exists yet to look these up against." Now that Persona Library exists, that
   retrofit is technically possible. Chosen: **not in this pass** — Persona Library stays fully
   standalone; the retrofit remains a separate, not-yet-requested follow-up.

## 2. Schema

Migration `00052-create-persona-library.ts` creates a single table, `personas` — unlike Service
Library's normalized multi-table shape, since the canonical spec
(`03_Detailed_Module_Specifications.md` §21) is a flat field list with no basis for splitting
persona data across separate entities: "persona ID, buyer type, company size, roles, industries,
geography, goals, pains, triggers, objections, decision criteria, services, bad-fit signals,
messaging track, CTA preferences, status, version."

Fields, with design notes for anything not directly named in the spec:

- `public_id` (unique, immutable) — mirrors every other module's stable-identifier precedent.
- `name` (required) — the spec's "persona ID" alone isn't a display label; added for the same
  reason Service Library has both `publicId` and `canonicalName`.
- `buyer_type`, `company_size`, `geography` — plain nullable strings.
- `roles`, `industries` — string arrays, `NOT NULL DEFAULT '{}'` (an empty array and "unset" are
  equivalent here, avoiding null-handling asymmetry against the third array field below).
- `goals`, `pains`, `triggers`, `objections`, `decision_criteria`, `bad_fit_signals`,
  `messaging_track`, `cta_preferences` — plain nullable text, capped at 20,000 characters. These
  are **plain text, not rich text** — this module was not in scope for the separate,
  already-shipped rich-text-editor rollout (Service Library's 7 Positioning fields and Projects'
  `description` only).
- `related_service_ids` — the spec's "services" field, modeled as a plain unvalidated string
  array (see scoping decision 2 above), the same pattern Service Library's own `icpIds`/
  `relatedPageIds`/`relatedCaseStudyIds` already use.
- `approval_status` — enum, governed only via a dedicated transition endpoint, never through
  `create()`/`update()` directly.
- `version` — integer, defaults to 1, server-managed (see §3).
- `created_by`/`updated_by`, `created_at`/`updated_at` — standard audit columns.

Organization-wide, not project-scoped (no `project_id` column) — matches Service Library and
Business Knowledge Center. No `confidentiality` field — the module registry's own seeded row has
`confidentialityLevel: null` for this module, unlike Service Library's.

## 3. Workflow and the `version` field

The `approvalStatus` enum and its `TRANSITIONS` table are reused **verbatim** from Service
Library's own already-code-reviewed version (`draft → submitted → under_review → approved`, with
`revision_requested`/`rejected → draft` requiring `submit` — the exact fix Service Library's own
code review already made once for this identical shape — and `superseded`/`archived` both
terminal). Status changes go through `changeApprovalStatus()`, using the same atomic
compare-and-swap `updateStatus()` pattern Service Library's own repository already uses
(`ConflictException` on a concurrent-write race), which itself traces back to
`IdempotencyKeyRepository.reserve()`'s original conditional-`UPDATE` pattern.

`version` is new behavior Service Library doesn't have, since the canonical spec explicitly names
it as its own field ("...status, version"). It's server-managed — the caller never supplies it —
and increments by 1 as part of the same `UPDATE` statement as any content edit, via a
Postgres-evaluated `version + 1` literal (Sequelize's `literal()` + `returning: true`, mirroring
`SessionExchangeCodeRepository.redeem()`'s own atomic-update-with-returning idiom), avoiding a
read-then-write race entirely rather than a separate increment-then-reload round trip.
Status-transition calls never touch `version`.

## 4. RBAC

Reuses the existing `service_persona_proof` permission group verbatim — the same group Service
Library already uses — so no new RBAC migration was needed. `@RequirePermission` is placed on
every individual controller method (never at class level), the specific bug Service Library's own
`ServiceLibraryDimensionsController` had and fixed (`PermissionGuard` only reads
`context.getHandler()`, never a class-level decorator).

## 5. Validation

Independently re-verified by the orchestrating session, not just trusted from the build's own
report:

- 493/493 `dashboard-api` unit tests (28 new)
- 28/28 `packages/database` unit tests (unaffected)
- 184/184 `packages/database` integration tests (14 new, real disposable PostgreSQL 17)
- 168/168 `dashboard-api` e2e tests (15 new, real disposable database + real seeded RBAC roles,
  including the full 3-tier submit/review/approve matrix)
- Migration up/down/up round-trip verified directly (53 migrations)
- `validate:module-registry` passing (43 modules, 21 permission groups, unaffected)
- `pnpm audit` — 0 vulnerabilities
- typecheck, lint, and `prettier --check` all clean on every touched/created file

Spot-checked the highest-risk code directly (not just trusting green tests): the migration's
column/index shape, the controller's per-method `@RequirePermission` placement, the service's
`TRANSITIONS` table and audit-failure handling, and the repository's atomic `version + 1` update
and compare-and-swap `updateStatus()` — all consistent with Service Library's own,
already-hardened precedent.

## 6. Deviations from the original brief (flagged, not silent)

- **Malformed-id status code**: a malformed UUID returns `400` (via `ParseUUIDPipe`, NestJS's own
  default), not `404` — matches Service Library's real, already-shipped convention; a
  well-formed-but-nonexistent id returns `404`.
- **No concurrent-race e2e test**: an initial attempt at a real two-concurrent-HTTP-request race
  test was dropped as non-deterministically flaky — `changeApprovalStatus()` treats a request for
  the persona's own current status as a harmless no-op (mirroring Service Library's identical
  short-circuit), so two real concurrent requests targeting the same terminal status can
  legitimately both return `200` depending on read/write interleaving timing. Service Library's
  own e2e suite doesn't attempt this race either. The atomic compare-and-swap conflict path is
  instead covered deterministically at the repository-integration-test and mocked-service-unit-
  test levels.
- **No trigram/fuzzy-search index** at initial build — since fixed in the code-review round below
  (§7), Persona Library now has the same `pg_trgm` GIN index on `name` Service Library has on
  `canonical_name`.

`apps/dashboard-web` is untouched — this is a backend-only slice, matching every prior module's
own build-the-backend-first precedent. No UI exists yet for this module.

## 7. Independent code review

Ran this project's own `code-review` skill (high effort, 8 finder angles, 1-vote verification) —
12 candidates surfaced after dedup, 11 CONFIRMED and 1 downgraded to PLAUSIBLE (inherited
precedent). 10 kept in the final report per the review's own cap; 9 fixed, 1 left as accepted,
tracked debt:

- **Most severe (correctness):** `update()` unconditionally incremented `version` even on a fully
  empty patch (`{}`), since `updatePersonaSchema` had no minimum-field guard — burning a version
  number and an empty-`afterState` audit event for a no-op save. Fixed with a `.refine()` on the
  schema rejecting an empty object with a clean 400.
- **Correctness:** `relatedServiceIds` had zero existence validation despite the target table
  (`services`) already existing — weaker than the precedent it claimed to follow (Service
  Library's own unvalidated fields point at genuinely-nonexistent modules). Fixed by adding
  `findByIds()` to `ServiceRepository` (additive, mirroring the dimension repositories' own
  method), exporting `SERVICE_REPOSITORY` from `ServiceLibraryModule`, and wiring a new
  `PersonasService.assertServiceIdsExist()` (mirroring `ServicesService.assertIdsExist()`) into
  both `create()` and `update()`. A malformed (non-UUID) id is filtered out before ever reaching
  the query — the same guard `UsersService.findById()` already uses — since Postgres's `uuid`
  column type would otherwise reject it with a raw driver error instead of a clean 400.
- **Efficiency:** `update()` pre-fetched the full persona via `findById()` purely to 404-check,
  then never used the result — unlike Service Library's identical-looking pattern, where the
  fetched value is load-bearing (FK re-validation, rich-text diffing). Fixed by removing the
  wasted read; the repository's own `update()` already 404s cleanly via its
  null-on-zero-affected-rows return.
- **Efficiency:** `updateStatus()`'s compare-and-swap `UPDATE` omitted `returning: true` and did a
  separate `findByPk` read afterward, inconsistent with the sibling `update()` method in the same
  file, and opening a narrow window where a concurrent write could make the returned entity
  reflect a different write than the one just performed. Fixed to use `returning: true` directly,
  matching `update()`'s own already-correct pattern.
- **Efficiency:** no `pg_trgm` trigram index on `name`, despite Service Library's own migration one
  module earlier adding one for the identical `ILIKE` search shape, citing the same canonical
  requirement. Fixed by adding the extension + GIN trigram index to migration `00052`.
- **Correctness:** array fields (`roles`/`industries`/`relatedServiceIds`) rejected an explicit
  `null` (400) while every scalar field accepted `null` to clear — a real asymmetry within the
  same DTO. Fixed by widening the array Zod schemas to `.nullish()` and normalizing `null` → `[]`
  in the repository's `update()` (the array columns are `NOT NULL`, so `null` can never be stored
  literally).
- **Correctness:** `create()`'s `publicId` uniqueness pre-check is TOCTOU — a losing concurrent
  request's real unique-index violation had no catch, surfacing as a raw 500. Fixed with a
  try/catch around the insert, checked by `error.name === "SequelizeUniqueConstraintError"` (not
  `instanceof`, since `dashboard-api` never imports `sequelize` directly per ADR-0006's
  `only-database-package-touches-sequelize` boundary — this was caught by the typecheck step, not
  assumed).
- **Correctness:** `list()` sorted only by `updatedAt DESC` with no tiebreaker, risking a
  duplicated or skipped row across paginated queries when rows share a timestamp (realistic for a
  bulk import). Fixed by adding `id ASC` as a secondary sort key.
- **Simplification:** `create()`'s and `update()`'s repository input types were hand-typed
  anonymous object literals independently re-listing `PersonaEntity`'s fields, with no
  compiler-enforced relationship to it. Fixed by deriving both via `Omit`/`Pick` from
  `PersonaEntity`, so a future field added there is a compile error here until also handled.
- **1 CONFIRMED finding left as accepted, tracked debt** (altitude): the entire 8-state
  `TRANSITIONS` table and `changeApprovalStatus()` method is a byte-for-byte duplicate of Service
  Library's identical, already-code-reviewed pattern (with its own real bug history — the
  already-fixed `-> draft` RBAC-action bug), with no shared "artifact approval workflow"
  abstraction anywhere in `packages/`. Extracting one would mean new shared infrastructure serving
  a single new consumer during a review-fix pass — judged disproportionate; recorded as a known
  follow-up rather than built speculatively.

New/updated coverage: 7 new `dashboard-api` unit tests (relatedServiceIds validation in both
`create()`/`update()`, the malformed-id guard, the TOCTOU translation, a non-uniqueness-error
passthrough — 35/35 total), 1 new `packages/database` integration test (the array-null-clearing
normalization), 3 new `dashboard-api` e2e tests (real relatedServiceIds validated against a real
service fixture, an empty-patch 400, an explicit-null array clear) plus a rewrite of the one
existing e2e test that assumed `relatedServiceIds` was unvalidated. Re-validated: 500/500
`dashboard-api` unit tests, 185/185 `packages/database` integration tests, 171/171 `dashboard-api`
e2e tests, migration up/down/up round-trip clean, `validate:module-registry` passing, `pnpm audit`
0 vulnerabilities, `boundaries:check` 0 violations (confirming the new `PersonaLibraryModule` →
`ServiceLibraryModule` import and the deliberate avoidance of a direct `sequelize` import in
`dashboard-api` are both architecturally clean), typecheck/lint/prettier all clean across
`apps/dashboard-api` and `packages/database`.
