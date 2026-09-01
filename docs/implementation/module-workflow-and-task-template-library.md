# Workflow and Task Template Library — implementation record

## Scope

Module key: `workflow_and_task_template_library`. Module #29 on the advisory
`Recommended_Module_Roadmap.md` (Wave 6, order #29 — that document's own text says
"Do not start building these... we will tell you when to start"); the dependency-computed
`docs/phase-plans/module-implementation-roadmap.md` places it in Wave 1 instead, since the
seeded `module_registry.dependencies` for this key is `null` (no upstream prerequisite) and
`ready_for_claude_queue` (Wave 2) depends on it. This conflict between the two roadmap docs was
surfaced to the project owner directly before any code was written; the "start workflow and task
template library" instruction was confirmed as the explicit go-ahead the advisory roadmap's own
text was withholding.

Backend-only pass — no `dashboard-web` UI in this slice, matching every prior module's own
backend-first precedent.

**Design, mirroring Brand Library file-for-file** (the closest existing sibling: single table,
enum discriminator, org-wide, standard workflow, no confidentiality, no cross-module
relationships):

- Single table `workflow_task_templates`. A `templateType` enum (11 values, taken directly from
  `03_Detailed_Module_Specifications.md §29`'s own template list: `existing_page_audit`,
  `new_page_opportunity`, `search_brief`, `content`, `case_study`, `design`, `development`,
  `code_review`, `security`, `qa`, `release`) — create-only/immutable, matching Brand Library's
  own `recordType` rule.
- Fields per the spec: `authorizedStage`, `requiredInputs`, `expectedOutputs`, `restrictions`
  (including the roadmap's own explicit design note — "Templates never authorize execution by
  themselves" — as free text, not an enforced mechanism, since no execution engine exists yet),
  `agentAssignment` (plain text, no FK — no agent-registry table exists in this schema),
  `validationCriteria`, `requiredApprovals` (plain text description, deliberately NOT wired to any
  automatic status transition).
- Standard 8-value `ArtifactApprovalStatus` workflow, server-managed `version`.
- **No** publish/unpublish mechanism — the `ready_for_claude` RBAC group's seeded actions
  (`view, create, edit, submit, review, approve, configure`) have no publish/unpublish grant,
  unlike Brand Library's own `creative_design` group.
- **No** confidentiality field (registry's seeded `confidentialityLevel` is `null`).
- **No** `project_id` (organization-wide) and **no** cross-module relationship fields.
- Long-text fields (`requiredInputs`/`expectedOutputs`/`restrictions`/`validationCriteria`) are
  plain nullable `TEXT` with no HTML sanitization — a deliberate backend-only-pass decision
  matching Persona Library's/Service Library's own original backend builds; sanitization is added
  alongside the `dashboard-web` UI in a later slice, per the 2026-08-22 standing rule.
- RBAC: reuses the already-seeded `ready_for_claude` permission group verbatim (also shared with
  the not-yet-built `agent_directory`, `agent_specification_library`, and `ready_for_claude_queue`
  modules) — no new RBAC migration. Real seeded grants give a genuine separation of duties:
  `super_admin`/`owner_growth_approver` hold `view, create, edit, review, approve, configure` (no
  `submit`); `marketing_editor`/`designer_creative_reviewer`/`developer`/`qa_security_reviewer`
  hold `view, create, submit, edit` (no `review`/`approve`); `read_only` holds `view` only. Unlike
  Brand Library's own `creative_design` group (where `designer_creative_reviewer` holds
  submit+review+approve together, permitting self-approval), no single role here can both submit
  and review/approve the same template.

## As-built

Built by a background agent with a fully-specified prompt mirroring Brand Library's file
structure, then independently re-verified in full by the orchestrating session (file-list diff,
migration content, both barrel-file exports, controller RBAC decorator placement, CAS/terminal-
state guard logic, shared-helper reuse) before any review ran — every test suite re-run fresh
against a real disposable local PostgreSQL 17 database, not trusted from the agent's own report.

Files:

- `packages/database/src/workflow-and-task-template-library/{entities,models,entity-mapping,workflow-task-template.repository,index}.ts`
- `packages/database/src/migrations/00099-create-workflow-and-task-template-library.ts`,
  `00100-mark-workflow-and-task-template-library-in-development.ts`
- `apps/dashboard-api/src/workflow-and-task-template-library/{workflow-and-task-template-library.constants,database.providers,workflow-and-task-template-library.dto,workflow-and-task-template-library.service,workflow-and-task-template-library.service.spec,workflow-and-task-template-library.controller,workflow-and-task-template-library.module}.ts`
- Test files: `packages/database/test/module-workflow-and-task-template-library.integration.test.ts`,
  `apps/dashboard-api/test/workflow-and-task-template-library.e2e-spec.ts`
- Edited: `packages/database/src/index.ts`, `packages/database/src/index.cjs.ts` (both barrels —
  the documented Vercel-bundler caution), `apps/dashboard-api/src/app.module.ts`.

Validation, independently re-verified: `packages/database` unit 28/28, `packages/database`
integration 759/759 (20 new), `dashboard-api` unit 1597/1597 (29 new), `dashboard-api`
e2e/integration 753/753 (17 new, real disposable database + real seeded RBAC, including the full
submit/review/approve separation-of-duties matrix, a terminal-state edit rejection, and a
repository-level CAS-race test), a real migration up/down/up round-trip (100 migrations),
`validate:module-registry` (43 modules, 21 permission groups, unaffected), `pnpm audit` 0
vulnerabilities, typecheck/lint (`--max-warnings=0`)/prettier all clean across both packages.

**Independent code review then ran** (this project's own `code-review` skill, high effort,
8-angle finder pass via parallel subagents, 1-vote verification) — 2 findings CONFIRMED and
fixed: this file itself was missing despite migration `00099`'s own doc comment citing it by
name; and a doc comment in `workflow-and-task-template-library.service.ts` incorrectly claimed
the `ready_for_claude` RBAC matrix gives submit/review/approve "the identical role split" as
Brand Library's `creative_design` group — corrected in place (the two are materially different:
`creative_design`'s `designer_creative_reviewer` holds submit+review+approve together, permitting
self-approval, while `ready_for_claude` genuinely separates those actions across role tiers).

1 CONFIRMED finding left as accepted, tracked debt, matching an already-accepted precedent in a
sibling module: `changeApprovalStatus()`'s same-status no-op short-circuit returns before the
per-transition `assertAllowed()` check runs, letting a caller holding only `view` "confirm" a
status without holding submit/review/approve — no state mutation or extra data exposure results
(identical data to the identically-gated `GET`), and the identical ordering is already accepted
debt in Keyword & Entity Library's own review. Fixing only this module would diverge from that
established, already-accepted pattern.

4 PLAUSIBLE findings left as accepted, tracked debt, each matching an already-established,
self-documented duplication class present in 10-15+ sibling modules across this codebase: a
redundant `findByPublicId()` pre-check in `create()` (byte-identical to Brand Library's own,
already accepted there); the `TRANSITIONS` approval-workflow table hand-copied rather than
extracted into a shared structure (self-documented as accepted debt in this module's own comment
and nearly every prior module's review); `toEntityWithIsoDates()` per-module re-declaration
(self-documented as established precedent); and the 11-value `templateType` enum hand-copied
across 4 layers (migration/model/TS union/DTO) with no code-generation step in this codebase to
keep them in sync.

A separate `security-review` skill run, the required second-role human review, a gate decision,
and merge authorization for the backend each remain their own separate, not-yet-requested next
steps.

## As-built — `dashboard-web` UI

Built directly on the explicit "Start the dashboard-web UI for it" instruction, on this same
branch, on top of the still-unmerged backend above. No approved wireframe/screen spec exists for
this module (`03_Detailed_Module_Specifications.md §29` is a flat field list) — sections mirror
that grouping (Identity, Task details, Governance, Status), the smallest honest reading of an
unsourced screen, matching every sibling module's own precedent. File-for-file mirrors Brand
Library's UI structure — the closest sibling (single table, standard 8-value approval workflow, no
publish mechanism, no sub-resources).

Per the 2026-08-22 standing rule requiring every `dashboard-web` long-text field to use
`RichTextEditor`, this build also closed the backend's own deferred sanitization gap in the same
pass, rather than shipping a UI that types HTML into fields the backend still stores as plain,
unsanitized text: `requiredInputs`/`expectedOutputs`/`restrictions`/`validationCriteria` are wired
into `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`
(`WorkflowAndTaskTemplateLibraryService.create()`/`update()`), and `LONG_TEXT_MAX_LENGTH` raised
4,000 → 8,000 (both DTO and form), the standard 2x markup-overhead ratio every prior rich-text
conversion in this codebase uses. `authorizedStage`/`agentAssignment`/`requiredApprovals` stay
plain text (short descriptive fields, matching how `title`/`name` never convert anywhere in this
codebase).

Files:

- `packages/shared-types/src/index.ts` — added `WorkflowTaskTemplate`/
  `WorkflowTaskTemplateApprovalStatus`/`WorkflowTaskTemplateType`.
- `apps/dashboard-web/lib/workflow-and-task-template-library-query.ts` (zero-non-type-import file,
  client-safe) / `workflow-and-task-template-library.ts` (server-side fetch functions) — the same
  split every sibling module's own `-query.ts`/plain file pair uses.
- `apps/dashboard-web/components/workflow-task-template-form.{tsx,module.css}`,
  `workflow-task-template-status-actions.{tsx,module.css}` — the status-actions component reuses
  `useSyncedState()` (not a hand-rolled `useEffect`, the current convention as of Motion and
  Interaction Library) and mirrors the backend's `TRANSITIONS` table verbatim, including keeping
  `approved -> superseded` as a real, reachable target (unlike Motion/Section/Page Template/
  Wireframe Library, whose own backends dropped that edge — this module's backend still has it).
- Four routes under `app/(shell)/workflow-and-task-template-library/` (list, detail, create, edit)
  at the module registry's own seeded `route` field.
- Test coverage: `tests/unit/workflow-and-task-template-library.test.tsx` (20 tests — query
  parsing/href building/badge mapping/fetch functions), `workflow-task-template-status-actions.test.tsx`
  (10 tests), `workflow-task-template-form.test.tsx` (8 tests) — 38 new tests total, mirroring
  Brand Library's own equivalent 3-file test-coverage shape.

Validation, independently re-run: 1578/1578 `dashboard-web` unit tests (38 new), 1602/1602
`dashboard-api` unit tests (2 new — sanitization on create and on a changed field, mirroring Brand
Library's own equivalent tests), a clean `next build` with all 4 new routes present, `eslint
--max-warnings=0` clean, the CSS-token check clean, `prettier --check` clean across both apps and
`packages/shared-types`.

A separate `security-review` skill run, the required second-role human review, a gate decision,
and merge authorization for the combined backend + UI branch each remain their own separate,
not-yet-requested next steps.
