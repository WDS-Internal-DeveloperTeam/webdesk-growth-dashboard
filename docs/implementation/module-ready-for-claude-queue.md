# Ready for Claude Queue — module #30

## Scope

Built directly on the explicit "start Ready for Claude Queue" instruction, with migration numbers
starting at `00101` per explicit instruction (`00099`/`00100` reserved for other concurrent work).
The 12th real business-module backend on the Phase 1F application shell / canonical module
registry.

**Source material:** `03_Detailed_Module_Specifications.md §30` (field list, actions),
`05_Workflow_State_Machines.md §4` (the bespoke 11-state lifecycle),
`06_Roles_and_Permissions.md`'s high-level matrix row "Ready for Claude" (already seeded verbatim
as the `ready_for_claude` RBAC permission group, `00013-seed-rbac-matrix.ts:199-207`),
`canonical-inputs/Recommended_Module_Roadmap.md` row 30 ("**Critical rule: V1 is manual Claude
Code execution.** No Anthropic API automation.").

**Module registry dependency note:** `module_registry.dependencies` for
`ready_for_claude_queue` names `workflow_and_task_template_library` (module #29, not yet built).
The detailed field list (`03_Detailed_Module_Specifications.md §30`) never actually references a
template id — tasks are authored directly, not instantiated from a template, matching the
roadmap's own "V1 is manual execution" framing. Building now with no template-linkage field is not
a gap against that dependency; it's simply out of this module's own field scope.

### Design decisions confirmed directly with the user (`AskUserQuestion`)

- **D1 — Record link.** The task's "record" field (which business record a task is about) uses
  the same polymorphic `(targetModuleKey, targetId)` shape Review and Approval Center already
  established for the identical problem — `targetModuleKey` validated against the real module
  registry via `AuthorizationService.isValidModuleKey()`, `targetId` an opaque, unvalidated UUID
  (no generic cross-module record-existence lookup exists). Both fields are nullable — a task need
  not be about any specific record (e.g. a general maintenance task).
- **D2 — Dependencies.** The `dependencies` field (other tasks that must complete first) is a
  real, existence-validated array of ids — each checked against this module's own
  `ready_for_claude_tasks` table (cheap same-table lookup, unlike a cross-module array where no
  target table exists yet).

### Further design decisions (not forks — applying established precedent)

- **D3 — `agent`/`agentVersion` stay plain, unvalidated text.** These reference the dashboard's 15
  planned business AI agents (Agent Directory, module #26; Agent Specification Library, module
  #27 — ADR-0019, neither built yet). Matches this codebase's own repeated precedent for a field
  naming a not-yet-built module's records (Service Library's `icpIds` before Persona Library
  existed, Website Strategy Center's `relatedStrategyRecordId` before this module).
- **D4 — Bespoke 11-state workflow**, not the generic 8-value `ArtifactApprovalStatus` every
  content-library module reuses — `05_Workflow_State_Machines.md §4`'s own diagram is a distinct
  shape (`draft → ready_for_claude → claimed → in_progress → awaiting_review → approved →
completed`, plus `changes_requested`/`cancelled`/`paused`/`failed`), the same reasoning that
  already justified Internal Linking Library's own bespoke 4-state workflow. `TRANSITIONS`
  table (in `ready-for-claude-tasks.service.ts`) is the single source of truth for both the legal
  edges and the RBAC action each edge requires:

  | From              | To                | Action  | Notes                   |
  | ----------------- | ----------------- | ------- | ----------------------- |
  | draft             | ready_for_claude  | submit  | "mark Ready for Claude" |
  | draft             | cancelled         | edit    |                         |
  | ready_for_claude  | claimed           | edit    | "claim"                 |
  | ready_for_claude  | cancelled         | edit    |                         |
  | claimed           | in_progress       | edit    | "start"                 |
  | claimed           | cancelled         | edit    |                         |
  | in_progress       | paused            | edit    |                         |
  | paused            | in_progress       | edit    | "resume"                |
  | in_progress       | failed            | edit    |                         |
  | in_progress       | awaiting_review   | submit  | "submit for review"     |
  | awaiting_review   | changes_requested | review  | "request revision"      |
  | changes_requested | ready_for_claude  | submit  | back into the queue     |
  | awaiting_review   | approved          | approve |                         |
  | approved          | completed         | approve | "complete"              |

  Terminal states (no further transition, `update()` rejects a plain-field edit too):
  `completed`, `cancelled`, `failed`. This maps exactly onto the seeded `ready_for_claude` RBAC
  row — mid-tier roles hold `VCSE` (view/create/submit/edit, no review/approve), so they can
  draft/mark-ready/claim/start/pause/fail/submit/cancel their own tasks but can never
  request-revision/approve/complete; only `super_admin`/`owner_growth_approver` hold `VCERAM`.

- **D5 — `projectId` is optional, existence-validated when present, not a mandatory RBAC scope.**
  Unlike Page Inventory/Keyword & Entity Library/Internal Linking Library (whose primary record
  IS project work), a Ready for Claude task can be organization-wide (e.g. an infrastructure
  task) or tied to one project — matches the field list's own framing ("project" as one of many
  optional context fields, not the primary key). RBAC stays organization-wide, matching Review and
  Approval Center's own precedent for a cross-cutting engine.
- **D6 — No confidentiality mechanism.** `module_registry.confidentialityLevel` for
  `ready_for_claude_queue` is `null`, matching every module built without one.
- **D7 — `prUrl`/`stagingUrl` use the shared `safeHttpUrlSchema`** (`@webdesk/validation`),
  matching every prior module with a stored URL field, closing the stored-XSS class this
  codebase already fixed once (Projects' `environment.url`).
- **D8 — Backend-only pass.** No `dashboard-web` UI yet, matching every prior module's own
  backend-first precedent. `description`/`dashboardReview`/`changesRequestedNotes`/
  `productionVerification`/`failureReason` stay plain, unsanitized text for this pass (no
  RichTextEditor wiring needed until a UI exists to author them — matches Website Strategy
  Center's/Service Library's own original backend-only builds).

## As-built

Built directly on `main` (no feature branch), backend only — `apps/dashboard-web` is untouched
(D8), matching every prior module's own backend-first precedent.

### Files added

**`packages/database`**

- `src/migrations/00101-create-ready-for-claude-queue.ts` — the `ready_for_claude_tasks` table, its
  two ENUM types (`priority`, the 11-value `status`), and five indexes: a unique index on
  `public_id`, a `(status, updated_at, id)` composite for the list surface, a bare `project_id`
  index (bare, not a composite leading with `project_id`, because unlike every sibling module
  `project_id` is an OPTIONAL filter here, never a mandatory route-derived scope), a
  `(target_module_key, target_id)` composite for the polymorphic record link, and a `pg_trgm` GIN
  index on `title`.
- `src/migrations/00102-mark-ready-for-claude-queue-in-development.ts`.
- `src/ready-for-claude-queue/{entities,models,entity-mapping,ready-for-claude-task.repository,index}.ts`.
- `src/index.ts` **and** `src/index.cjs.ts` — both barrels updated. The CJS barrel is separately
  maintained and is the one Vercel's Function bundler actually `require()`s in production; missing
  it caused a real production outage once before (`CLAUDE.md`'s own Cautions section).

**`apps/dashboard-api`**

- `src/ready-for-claude-queue/{ready-for-claude-queue.constants,database.providers,ready-for-claude-queue.dto,ready-for-claude-tasks.service,ready-for-claude-tasks.controller,ready-for-claude-queue.module}.ts`.
- `src/app.module.ts` — `ReadyForClaudeQueueModule` wired in, alphabetically among the existing
  module imports.

**Tests**

- `apps/dashboard-api/src/ready-for-claude-queue/ready-for-claude-tasks.service.spec.ts` (55 unit
  tests) — every legal edge of the `TRANSITIONS` table asserted individually along with the exact
  RBAC action it checks, six illegal edges, terminal-state edit rejection, CAS conflict/not-found
  handling, and every `create()`/`update()` validation branch.
- `packages/database/test/module-ready-for-claude-queue.integration.test.ts` (24 tests, real
  disposable PostgreSQL) — migration up/down round-trip, every declared index present (queried from
  `pg_indexes`), `dependencies` confirmed to be a real `uuid[]` column (queried from
  `information_schema`), list filters, `escapeLikePattern()` behaviour on both LIKE
  metacharacters, and both CAS guards including a genuine two-concurrent-writers race.
- `apps/dashboard-api/test/ready-for-claude-queue.e2e-spec.ts` (27 tests, real disposable database
  - the real seeded RBAC roles) — the full three-tier permission matrix over real HTTP, the
    dependency and `targetModuleKey` validation rejections, `safeHttpUrlSchema` rejection, and the
    409 on a stale `expectedStatus`.

### Endpoints

| Method  | Route                                      | Route-level gate                          |
| ------- | ------------------------------------------ | ----------------------------------------- |
| `GET`   | `/ready-for-claude-queue/tasks`            | `ready_for_claude:view`                   |
| `GET`   | `/ready-for-claude-queue/tasks/:id`        | `ready_for_claude:view`                   |
| `POST`  | `/ready-for-claude-queue/tasks`            | `ready_for_claude:create`                 |
| `PATCH` | `/ready-for-claude-queue/tasks/:id`        | `ready_for_claude:edit`                   |
| `POST`  | `/ready-for-claude-queue/tasks/:id/status` | `ready_for_claude:view` + a dynamic check |

Every `@RequirePermission` is method-level, never class-level — `PermissionGuard` only reads
`context.getHandler()` (a deliberate fail-closed design), the exact bug 3+ prior modules
independently had and fixed once already. The status route carries only a baseline `view` gate,
because the real gate varies per requested transition and is checked dynamically inside
`ReadyForClaudeTasksService.changeStatus()` via `AuthorizationService.assertAllowed()` — the same
layered pattern `internal-links.controller.ts`'s and `keywords.controller.ts`'s own status routes
already established.

### A real property of the seeded RBAC matrix, recorded rather than worked around

`00013-seed-rbac-matrix.ts:198-206` seeds `ready_for_claude` as `super_admin: VCERAM`,
`owner_growth_approver: VCERAM`, the four mid-tier roles `VCSE`, `read_only: V`. Expanded, that
means **no role holds both `submit` and `approve`**: `super_admin`/`owner_growth_approver` have no
`submit` grant at all, so they cannot themselves perform the three `submit`-gated transitions
(`draft -> ready_for_claude`, `in_progress -> awaiting_review`, `changes_requested ->
ready_for_claude`), while the four mid-tier roles can never review or approve.

Driving one task through its whole lifecycle therefore genuinely requires two different actors.
This is a real separation of duties inherited from the approved matrix, not a defect in the D4
transition table — no transition was re-gated to work around it, and the e2e suite asserts it
directly (including a `super_admin` receiving a `403` on `draft -> ready_for_claude`). It is
flagged here, and in `ready-for-claude-queue.constants.ts`'s own doc comment, because it is
surprising and would otherwise look like a bug to the next reader.

### Two findings surfaced by this build's own tests

1. **`escapeLikePattern()` coverage was asserted wrongly first.** An early integration test claimed
   a bare `%` search should return zero rows; it correctly returns the one row whose title contains
   a literal `%`. The test was corrected to assert the real (correct) behaviour, and a second
   assertion on `_` — the other LIKE metacharacter — was added, which is the case that genuinely
   distinguishes escaped from unescaped.
2. **`update()`'s `status` exclusion was type-level only.** `ReadyForClaudeTaskRepository.update()`
   originally excluded `status` via its `ReadyForClaudeTaskUpdateFields` type alone, exactly as its
   sibling repositories do. A real integration test proved that a runtime caller passing `status`
   anyway would have it written through. Unreachable over HTTP today (the DTO's Zod schema strips
   an unrecognized `status` key before the service ever sees it), but the doc comment claimed more
   than the code enforced, so `status` is now destructured off the patch at runtime and the test
   proves it. Deliberately **not** retrofitted onto the already-shipped sibling repositories —
   that is its own separate change.

### Deviations from the brief

- **`ReadyForClaudeTaskCasResult<T>` is declared locally**, not imported. The brief suggested
  reusing a central `CasResult<T>`, but no module-neutral one exists: `CasResult<T>` is declared
  inside `review-and-approval-center/review.repository.ts`, and the established precedent is that
  each module declares its own (Design Review Center declared `DesignReviewCasResult<T>` rather
  than importing it; Internal Linking Library declared a non-generic
  `UpdateInternalLinkStatusResult`). Reaching across a module boundary for a three-line structural
  type would couple this module to that one for no benefit.
- **The end-state migration count is 100, not 102.** Numbers `00099`/`00100` are reserved for other
  concurrent work and do not exist in this repository, so `00101`/`00102` are the 99th and 100th
  migrations. Round-trip verified at 100 executed / 0 pending.
- **The `dashboard-api` e2e script is `test:integration`**, not `test:e2e` — there is no `test:e2e`
  script in this repository.

### Validation (every command run against a real disposable local PostgreSQL 17 database)

| Check                                              | Result                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| `@webdesk/database` unit (`pnpm test`)             | 28/28 passed, 6 files                           |
| `@webdesk/database` integration                    | 763/763 passed, 38 files (24 new)               |
| `dashboard-api` unit (`pnpm test`)                 | 1626/1626 passed, 93 files (55 new)             |
| `dashboard-api` integration/e2e                    | 764/764 passed, 38 files (27 new)               |
| Migration round-trip (`up` → `down` → `up`)        | 100 executed / 0 pending, clean both directions |
| `validate:module-registry`                         | 43 modules, 21 permission groups, all resolve   |
| `typecheck` (`@webdesk/database`, `dashboard-api`) | clean                                           |
| `lint --max-warnings=0` (both packages)            | clean                                           |
| `nest build`                                       | clean                                           |
| `prettier --check` (every touched file)            | clean                                           |
| `pnpm audit --audit-level=high`                    | 0 vulnerabilities                               |
| `boundaries:check` (dependency-cruiser)            | 0 violations                                    |

### Independent code review — high effort, 8-angle finder pass, 1-vote verification

7 candidates survived dedup and verification, **all 7 CONFIRMED, all 7 fixed** (commit `ec29767`):

1. **`changeStatus()` had no separation-of-duties check on `review`/`approve` transitions.** The
   module's own original doc comment argued this was unnecessary since "no role holds both `submit`
   and `approve`" — factually wrong, since `user_roles` has no one-role-per-user constraint
   (`00012-create-user-roles.ts`), so a user holding both a submit-capable role and
   `super_admin`/`owner_growth_approver` simultaneously could self-approve. Fixed by wiring
   `SeparationOfDutiesService.assertDistinctActors()` (already exported by the already-imported
   `AuthModule`) into `changeStatus()`, comparing the actor against `current.createdBy`.
2. **`productionApproval`/`productionApproverUserId` were plain content fields writable through the
   generic `edit`-gated `PATCH .../tasks/:id` route** — any of the four mid-tier roles (hold `edit`,
   never `approve`) could fabricate a production sign-off with zero involvement of the real,
   `approve`-gated `TRANSITIONS` table. Fixed by removing both from `createReadyForClaudeTaskSchema`/
   `updateReadyForClaudeTaskSchema` and `ReadyForClaudeTaskContentFields` entirely (server-managed,
   like `status`); `ReadyForClaudeTaskRepository.updateStatus()` now stamps both atomically, in the
   same `UPDATE`, only when `nextStatus === "completed"` — reachable only via the `approve` action.
3. **The `dependencies` "must complete before this one" contract was validated for existence only,
   never actually enforced.** Fixed with a new `assertDependenciesCompleted()` check, applied at the
   one transition where it matters — `claimed -> in_progress` ("start") — not at every earlier,
   purely-administrative transition a task may legitimately reach before its blockers finish.
4. **`targetModuleKey`'s Zod schema was missing `.min(1)`**, so an empty string silently skipped
   `assertValidTargetModuleKey()`'s truthy-check guard and got persisted — neither `null` nor a real
   module key. Fixed by adding `.min(1)` to all three schemas that declare the field (create, update,
   list-query).
5. **`assertDependenciesExist()` issued one `existsById()` query per dependency id** (up to 50,
   concurrent but still N round trips) instead of one batched `IN (...)` query. Fixed with a new
   `ReadyForClaudeTaskRepository.existingIds()` method, mirroring `ServiceRepository.findByIds()`'s
   own established pattern.
6. **`unwrapCasResult()` was a third independent hand-copy** of the identical CAS-outcome-unwrapping
   helper already duplicated in `ReviewsService`/`DesignReviewsService`. Extracted into a new shared
   `apps/dashboard-api/src/common/cas-result.util.ts` — used by this module only; the two
   pre-existing sibling copies are deliberately left as-is, matching this codebase's own repeated
   practice of not retrofitting an extraction onto already-shipped siblings in the same pass.
7. **`updateReadyForClaudeTaskSchema` hand-duplicated all ~26 fields** from
   `createReadyForClaudeTaskSchema` instead of deriving via `.omit({publicId, projectId}).partial()`
   — the pattern at least 7 sibling DTOs already use. Fixed by deriving it.

Re-validated after the fix round: 767/767 `@webdesk/database` integration tests (4 new), 1634/1634
`dashboard-api` unit tests (8 new — separation-of-duties rejection/skip cases, dependency-completion
blocking/allowing/scoping), 764/764 `dashboard-api` integration/e2e tests (unchanged, confirms no
regression), a fresh migration round-trip (100 executed / 0 pending), `validate:module-registry`
unaffected, typecheck/lint/prettier all clean, `pnpm audit` 0 vulnerabilities.

### Security review — 0 findings above threshold

A dedicated pass, focused specifically on the second commit's own changes (the separation-of-duties
wiring, the `productionApproval` server-management fix, the new `existingIds()` batched query, and
the `targetModuleKey` fix). Confirmed: no residual path exists to set `productionApproval`/
`productionApproverUserId` outside `updateStatus()` (the DTO types structurally lack them, Zod's
default `strip` mode would drop them even if sent, and the repository `update()` input type excludes
them too); `existingIds()`'s `where: { id: ids }` is Sequelize's standard parameterized `IN (...)`
shorthand, not string interpolation — no injection surface, and `ids` is additionally bounded by
`z.array(z.string().uuid()).max(50)` before it ever reaches the query; a caller cannot use a
fabricated `expectedStatus` to obtain a cheaper RBAC action than a transition actually requires,
since the atomic CAS write only succeeds when `expectedStatus` matches the row's true current
status; the status route's baseline-`view`-plus-dynamic-check pattern was confirmed to have no
skip branch. One informational, sub-threshold note recorded (not a finding): the human-readable
production-tracking text fields (`productionCommit`, `productionVerification`, etc.) remain
editable via the generic `edit` action at any workflow stage — consistent with the module's own
documented design (D8), not an RBAC bypass.

### Not built (each its own separate, not-yet-requested step)

- No `dashboard-web` UI (D8).
- No link to Workflow and Task Template Library (module #29, not built) — see the Scope section's
  own dependency note: this module's field list never references a template id.
- No automatic execution, dispatch, or Anthropic API call of any kind — V1 is manual Claude Code
  execution, per the roadmap's own critical rule.
- Second-role human review, a gate decision, push/PR, and merge — each a separate,
  not-yet-requested next step.
