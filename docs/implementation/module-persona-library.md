# Persona Library module backend (as-built)

**Status:** Built, fully validated (independently re-verified, not just trusted from the build's
own report), not yet reviewed, gated, or merged. Branch `module-persona-library`, off `main` at
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
- **No trigram/fuzzy-search index** — Service Library added one because the canonical data-model
  doc explicitly required it for that module only. Persona Library uses plain `ILIKE` +
  `escapeLikePattern()` search, matching Projects'/Business Knowledge Center's own precedent.

`apps/dashboard-web` is untouched — this is a backend-only slice, matching every prior module's
own build-the-backend-first precedent. No UI exists yet for this module.
