# Module: Audit Logs and System Health

## Scope

**Module key:** `audit_logs_and_system_health` — already seeded in `module_registry` (migration
`00035`), route `/audit-logs-and-system-health`, navigation group `settings`, no dependencies,
`confidentialityLevel: "immutable events required for critical actions (master spec security
section)"`. RBAC group `system_settings` (migration `00013`, same group as System Settings and
Integrations) — `super_admin` holds `VCERM`, `owner_growth_approver` holds `VM`.

**Canonical spec** (`03_Detailed_Module_Specifications.md §43`): "Login events, permission
changes, data changes, Git sync, webhook status, jobs, queues, scans, malware-scan placeholder
status, failed jobs/retries, cron/WP-Cron, backups, storage, application errors, security events,
agent execution status."

**Scope decision, confirmed directly with the project owner (`AskUserQuestion`):** this module
overlaps heavily with infrastructure already built and already exposed via real HTTP routes —
`system-events`/`system-health/components`/`system-health/status` (Phase 1E,
`system-operations.controller.ts`) and `jobs`/`jobs/:id`/`retry`/`cancel`
(`jobs.controller.ts`) are all already live. Decision and Activity Log (module #37) already
exposes the "decision/activity" half of `audit_events`, and its own doc comment
(`decision-and-activity-log.constants.ts`) explicitly names the complementary event-type set as
**this** module's own territory:

```
login | login_rejected | logout | session_revoked | permission_change |
confidential_field_access_change | user_activation | user_deactivation | retention_run |
webhook_processed | job_created | job_completed | job_failed | job_retry_requested |
job_cancellation_requested | retention_hold_created | retention_hold_released |
notification_created | notification_delivery_outcome | operational_contact_created |
operational_contact_updated | system_health_check_recorded | emergency_admin_login |
account_recovery_request | account_recovery_decision
```

**The user chose "query surface only, over already-existing data"** — this backend pass adds
exactly one new thing: a read-only query endpoint over the `audit_events` table, filtered to the
24-value complement above, mirroring Decision and Activity Log's own module file-for-file. It does
**not** re-expose `jobs`/`system-events`/`system-health` under this module's own route prefix —
those already have real, live, working endpoints elsewhere in the API surface; a future
`dashboard-web` UI pass for this module can call multiple existing endpoints rather than this
backend proxying them. Webhook status, backups, storage, and application errors stay explicitly
out of scope — no table or mechanism for any of them exists anywhere in this codebase yet, matching
Scan Center's/Ready for Claude Queue's own precedent of not building an execution engine that
doesn't exist, and System Settings' own precedent of not duplicating a table that already lives
elsewhere.

**No new table, no new RBAC migration.** Migration `00122` (later renumbered to `00124` — see the
As-built section) marks `module_registry.implementation_status = 'in_development'` for
`audit_logs_and_system_health` — the only schema change in this pass. No confidentiality/redaction
mechanism beyond what
`AuditEventEntity` already carries (this module surfaces `beforeState`/`afterState` unredacted,
matching Decision and Activity Log's own already-accepted precedent).

## As-built

**Structural template**: mirrors `apps/dashboard-api/src/decision-and-activity-log/` and
`apps/dashboard-api/test/decision-and-activity-log.e2e-spec.ts` file-for-file — a thin, read-only
query surface over the existing, already-live ADR-0017 `audit_events` table, same RBAC group
(`system_settings`), same organization-wide scope, no new table. Only the event-type allowlist and
naming were swapped.

### Files created

- `apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.constants.ts`
- `apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.dto.ts`
- `apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.service.ts`
- `apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.controller.ts`
- `apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.module.ts`
- `apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.service.spec.ts`
  (4 unit tests, mocked `AuditService`, mirrors `decision-and-activity-log.service.spec.ts`)
- `apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.dto.spec.ts`
  (9 unit tests, mirrors `decision-and-activity-log.dto.spec.ts`)
- `apps/dashboard-api/test/audit-logs-and-system-health.e2e-spec.ts` (8 e2e tests, real disposable
  database + real seeded RBAC, mirrors `decision-and-activity-log.e2e-spec.ts`)
- `packages/database/src/migrations/00124-mark-audit-logs-and-system-health-in-development.ts` —
  the only schema change: marks `module_registry.implementation_status = 'in_development'` for
  `audit_logs_and_system_health`. Originally numbered `00122` (not `00120`, the next number after
  the branch's own base `00119`) per this task's own explicit instruction, since `00120`/`00121`
  were reserved by other concurrent work at build time (confirmed: a concurrently-built
  `module-system-settings` branch, discovered mid-build — see "Working-directory sharing incident"
  below — used exactly those two numbers for its own migration). **Renumbered a second time, to
  `00124`, after opening the PR** — a real, independently-built Integrations module (module #41)
  merged to `main` claiming `00122`/`00123` for its own migrations, discovered when the PR's CI
  checks never ran (`mergeStateStatus: DIRTY`, `mergeable: CONFLICTING`) — see the "Second
  renumbering" subsection below.

### Files changed

- `apps/dashboard-api/src/app.module.ts` — added the `AuditLogsAndSystemHealthModule` import and
  wired it into the root module's `imports` array, positioned alphabetically (`Audit...` sorts
  immediately before `Auth...`), matching every sibling module's own registration pattern.

### Event-type allowlist — partition check (discrepancy found)

The build prompt described "the EXACT 24-value complement" of
`DECISION_AND_ACTIVITY_LOG_EVENT_TYPES`. Counting the full `AuditEventType` union in
`packages/database/src/audit/entities.ts` (41 values) against
`DECISION_AND_ACTIVITY_LOG_EVENT_TYPES` (16 values) gives a complement of **25 values, not 24** —
the prompt undercounted by one. This 25-value list is exactly what
`decision-and-activity-log.constants.ts`'s own doc comment already names, verbatim, as "module
#43 'Audit Logs and System Health''s own territory" (its "Deliberately EXCLUDED" list), and it is
also exactly what this module's own `## Scope` section above lists (both sourced from the same
original list, which itself already contained 25 items despite the "24-value" label in this
prompt's instruction text). Used the real 25-value list, not a truncated 24-value one — using
only 24 would have left one real `AuditEventType` value (`account_recovery_decision`, the last
item, easy to lose when eyeballing) orphaned, appearing in neither module's allowlist. Verified
programmatically: `41 (full union) = 16 (Decision and Activity Log) + 25 (this module)`, and a
line-by-line diff confirms zero overlap and zero gap — a clean partition. See
`audit-logs-and-system-health.constants.ts`'s own doc comment for the full mapping rationale
against the canonical spec's own §43 field list.

### Working-directory sharing incident (discovered and resolved mid-build)

Partway through validation, a background-task completion notification referenced a
`SystemSettingsModule` and a `module-system-settings` branch that this build had never touched.
Investigation (`git status`, `git branch --show-current`, `git reflog`) found this local checkout
(`/Users/admin/Documents/Jitesh Work/WDS-Dashboard`) is being used concurrently by another,
independent orchestrating session building an unrelated **System Settings** module — that session
had checked out `module-audit-logs-and-system-health` (this branch), found this build's
uncommitted work in progress, ran an automated "preserve WIP before switching away" commit that
swept up not only this module's files but also that other session's own uncommitted `CLAUDE.md`
and `outputs/webdesk-growth-dashboard/project.json` edits (its own System Settings entries) and a
pre-existing untracked `scripts/migrate-production.sh` (present in the working tree since before
this build started, per the session's own initial `git status` snapshot — not created by either
session), then switched to `main` and on to its own `module-system-settings` branch to continue
its own work. This build was still running commands (typecheck, e2e tests) against the on-disk
files during that window; those commands kept succeeding because the file _contents_ under
`apps/dashboard-api/src/audit-logs-and-system-health/` etc. were never actually altered by the
other session, only committed to git.

Resolution: checked out `module-audit-logs-and-system-health` again, confirmed via `git show
--stat` that the auto-preserve commit (`1a7fa8a`) contained byte-identical copies of every file
this build created (line counts matched exactly), then `git reset --soft HEAD~1` to unstage
everything (per this task's own explicit "do not run git commit" instruction — the auto-preserve
commit was made by the other session's own tooling, not by this build, but leaving it committed
would have violated the same instruction, so it was undone). Left the unrelated `CLAUDE.md`/
`project.json`/`scripts/migrate-production.sh` changes as found (staged→unstaged along with
everything else, on disk, untouched in content) rather than discarding them — they represent
real, in-progress work from the other concurrent session and discarding them risked destroying
work this build has no visibility into or ownership of. **The orchestrating session reviewing this
diff should be aware**: `git status`/`git diff` on this branch will show `CLAUDE.md` and
`outputs/webdesk-growth-dashboard/project.json` changes, and an untracked
`scripts/migrate-production.sh` file, that are **not part of this Audit Logs and System Health
build** — only the files listed under "Files created"/"Files changed" above are. Re-verified
`app.module.ts`'s actual diff after the reset (`git diff --cached`) to confirm it contains only
this build's own two-line addition, with no `SystemSettingsModule` cross-contamination.

### Validation — real, independently observed output

Run against a fresh local disposable PostgreSQL 17 database
(`webdesk_audit_logs_system_health_dev`, dropped and recreated cleanly after an initial
"duplicate key value violates unique constraint pg_type_typname_nsp_index" race on the very first
`CREATE TABLE IF NOT EXISTS "SequelizeMeta"` — a transient concurrent-connection race within
Sequelize/umzug's own bootstrap, not a defect in this build's own migration; recreating the
database and re-running cleared it, and the table had in fact been created despite the thrown
error).

- **Migration status/up**: `pnpm --filter @webdesk/database run migrate:status` (before):
  Pending (120), ending in `00122-mark-audit-logs-and-system-health-in-development`. `migrate up`:
  **Applied 120 migration(s)**, clean. `migrate-status` (after): **Executed (120), Pending (0)**.
- **Down/up round-trip** (on the new migration specifically): `migrate down` reverted
  `00122-mark-audit-logs-and-system-health-in-development` cleanly; `migrate up` re-applied it
  cleanly; `migrate-status` confirmed **Executed (120), Pending (0)** again afterward.
- **`packages/database` typecheck**: `pnpm --filter @webdesk/database run typecheck` — clean, 0
  errors.
- **`dashboard-api` typecheck**: `pnpm --filter dashboard-api run typecheck` — clean, 0 errors.
- **`dashboard-api` lint**: `pnpm --filter dashboard-api run lint` (`eslint src test
--max-warnings=0`) — clean, 0 warnings/errors.
- **Prettier**: `pnpm exec prettier --check` on every new/changed file (the new module directory,
  the new e2e spec, `app.module.ts`, the new migration, this doc) — "All matched files use
  Prettier code style!"
- **`dashboard-api` unit tests**: `pnpm --filter dashboard-api run test` — **1865/1865 tests
  passed, 119/119 files passed** (the full suite ran, not a filtered subset — the `--` filter
  argument to the underlying `vitest run` script did not narrow the run; the full-suite result is
  a stronger signal than a filtered one). Includes the 4 new
  `audit-logs-and-system-health.service.spec.ts` tests and the 9 new
  `audit-logs-and-system-health.dto.spec.ts` tests, both passing individually within that run.
- **`dashboard-api` e2e/integration tests**: two runs. (1) The full `test:integration` suite (all
  45 e2e spec files) was started but hit a 120-second background-task timeout and, once retrieved,
  showed **23 failures, all confined to `test/portfolio-library.e2e-spec.ts`**, all `Error: Test
timed out in 5000ms` — a pre-existing, unrelated module's e2e suite, not touched by this build;
  attributed to database/connection contention from the concurrent System Settings session
  running its own migrations/tests against the same local Postgres instance simultaneously (see
  the working-directory sharing incident above), not a regression this build introduced. (2) A
  second, targeted run of only the new file — `npx vitest run --config
vitest.integration.config.mts test/audit-logs-and-system-health.e2e-spec.ts` — passed cleanly:
  **8/8 tests passed, 1 file passed**, covering: 401 with no session cookie; 403 for a
  `read_only` session (no `system_settings` grant); a `super_admin` session listing events
  restricted to this module's own 25-value allowlist (seeded one `login` event and one `approval`
  event — the `approval` event, belonging to Decision and Activity Log's own territory, is
  confirmed absent from the response); a real `owner_growth_approver` session (the `VM` grant
  includes `view`) succeeding; narrowing via an explicit `?eventType=` filter; rejecting an
  `eventType` that belongs to Decision and Activity Log's own allowlist with a clean 400 (not
  silently ignored); rejecting a malformed `actorUserId`/`projectId` UUID query param with a
  clean 400; and pagination via `limit`/`offset`.
- **`validate:module-registry`**: `pnpm --filter @webdesk/database run validate:module-registry` —
  "Module-registry validation passed — **43 modules, 21 permission groups**, all references
  resolve" — unaffected, confirming this module reuses the already-seeded `system_settings` group
  with no drift.
- **`pnpm audit`**: "No known vulnerabilities found" — 0 new vulnerabilities.

No validation step was skipped or could not be run — every command above ran for real against a
real local database, with real, independently observed output (not trusted from any prior
report, since this build did not delegate to a subagent).

### Deviations from the prompt

1. **Event-type allowlist count**: the prompt said "24-value complement"; the real, verified
   partition of the full `AuditEventType` union is **25 values**. Used the correct 25-value list
   (documented above), not a truncated one.
2. Nothing else deviated — the file structure, naming, migration content, route shape, and test
   coverage all mirror Decision and Activity Log file-for-file as instructed.

### Second renumbering — a real collision with the concurrently-built Integrations module

After the gate was approved and PR #126 opened, CI never actually ran on the PR —
`gh pr view --json mergeable,mergeStateStatus` showed `mergeable: CONFLICTING`,
`mergeStateStatus: DIRTY`, which silently prevents GitHub Actions from even creating a
`pull_request` run (the same class of gotcha this project's own history already documents once,
for the Help Center PR #118). Fetching `origin/main` showed it had moved forward: a separate,
independently-built **Integrations** module (module #41, PR #123) had merged, and its own
migrations had themselves been renumbered `00120`/`00121` → `00122`/`00123` after a real
collision with System Settings — landing on exactly the same `00122` this branch's own migration
used.

Merged `origin/main` into this branch. `CLAUDE.md` and `apps/dashboard-api/src/app.module.ts`
merged automatically; `outputs/webdesk-growth-dashboard/project.json` conflicted (both branches
had appended `gates[]`/`audit_log` entries at the same array position) — resolved by
reconstructing the file programmatically from the two branches' pre-merge tips rather than
hand-editing conflict markers in a ~4,000-line JSON file: took `origin/main`'s full `gates[]`/
`audit_log` as the base (it already carries the Integrations module's own entries), then appended
this branch's own new entries (`G4-audit-logs-and-system-health`'s gate object, the
`merged_to_main`/`gate_approved` audit-log entries), re-sequencing `project_version_before`/
`_after` to continue main's own counter. Verified the result is valid JSON and that no gate/
audit-log entry was lost from either side before proceeding.

Renumbered this branch's own migration `00122-mark-audit-logs-and-system-health-in-development.ts`
→ `00124-mark-audit-logs-and-system-health-in-development.ts` (`git mv`, content unchanged — the
file has no hardcoded migration-number string inside it) and updated every reference to the old
number across `CLAUDE.md`, this doc, and the approval checklist (leaving quotes of the user's own
original "number the migration from 00122" instruction untouched, and leaving every reference to
Integrations' own real `00122`/`00123` migrations alone).

**A stale compiled `dist/` artifact caused a real false-duplicate failure along the way** — the
exact class of gotcha this project's own history already documents for the Integrations module's
own renumbering: `tsc` doesn't delete a compiled `.js` file for a source file that's since been
renamed/removed, so `packages/database/dist/migrations/` still held a compiled
`00122-mark-audit-logs-and-system-health-in-development.js` alongside the new
`00124-mark-audit-logs-and-system-health-in-development.js`, and the migration runner (which reads
`dist/`, not `src/`) applied both — surfacing as `Applied 125 migration(s)` including a
duplicate-looking `00122-mark-audit-logs-and-system-health-in-development` entry alongside
Integrations' own genuine `00122-create-integrations`. Diagnosed by listing
`packages/database/dist/migrations/` directly; fixed by `rm -rf packages/database/dist
packages/database/dist-cjs` and rebuilding — not a defect in the migration content itself.

**Full re-validation after both fixes**, against a fresh local disposable PostgreSQL 17 database
(`webdesk_verify_alsh2`):

- `packages/database`/`dashboard-api` typecheck and lint (`--max-warnings=0`) — clean.
- Migration `up`: **Applied 124 migration(s)**, clean, no duplicates. Down/up round-trip on
  `00124` specifically: clean.
- `validate:module-registry`: "43 modules, 21 permission groups, all references resolve" —
  unaffected.
- `dashboard-api` unit tests: **1927/1927 passed, 124/124 files** (up from 1885/119 — the
  difference is Integrations' own 42 new tests, now present on this branch after the merge, not a
  regression).
- `dashboard-api` full e2e/integration suite: **886/886 passed, 47/47 files** (up from 861/46 for
  the same reason).
- `pnpm audit`: "No known vulnerabilities found."
- `prettier --check` on every changed file: clean.

No code inside `audit-logs-and-system-health.*` itself changed during this renumbering — only the
migration's filename and every doc/CLAUDE.md/`project.json` reference to it.

## As-built — `dashboard-web` UI

Closes this module's last named gap, following the backend's own build-to-production arc
(PR #126, merge commit `0ad2a9aa722f3eb5e20121d648c28b866c550ac3`). Built directly on the explicit
"start Audit Logs and System Health dashboard-web UI" instruction. No approved wireframe/screen
spec exists for this module — renders exactly what `GET /audit-logs-and-system-health/events`
returns and supports (an `eventType`, `entityType`, `entityId`, `actorUserId`, `projectId` filter,
a `from`/`to` date range, and offset pagination), mirroring Decision and Activity Log's own list
page file-for-file — the closest sibling (organization-wide, filter-heavy, read-only, reusing the
same `system_settings` RBAC group).

**No detail page and no create/edit form** — this module is a pure read-only query surface over
the existing, immutable `audit_events` table, for the identical reason Decision and Activity
Log's own UI has neither (no write path exists anywhere in it — `AuditService.record()` remains
the sole writer, called by other modules' own services). A single list route
(`/audit-logs-and-system-health`, the module registry's own seeded `route` value) is the entire
UI.

No new `packages/shared-types` were needed — `AuditEventType`/`AuditActorType`/`AuditEvent` (the
full ~41-value union) already exist, added when Decision and Activity Log's own UI was built.
`lib/audit-logs-and-system-health-query.ts` (zero-non-type-import file — query parsing, href
building, and this module's own 25-value event-type allowlist/label map, hand-mirrored from
`apps/dashboard-api/src/audit-logs-and-system-health/audit-logs-and-system-health.constants.ts`'s
`AUDIT_LOGS_AND_SYSTEM_HEALTH_EVENT_TYPES`) and `lib/audit-logs-and-system-health.ts` (the
server-side fetch function) mirror `lib/decision-and-activity-log-query.ts`/
`lib/decision-and-activity-log.ts`'s own split exactly.

Deliberately narrows the backend's own richer query contract to the smallest honest UI, matching
Decision and Activity Log's own choices: a single-value `<select>` for `eventType` (the backend
accepts a repeated array); `from`/`to` as plain `<input type="date">` fields converted to UTC
start-of-day/end-of-day ISO datetimes at request time; `actorUserId`/`projectId` as plain,
client-side UUID-format-checked text inputs (no picker exists), each degrading to "no filter
applied" on an invalid shape rather than round-tripping a garbled value that would 400 the whole
page. The backend's own `limit` cap is `.max(200)` (not the too-low `.max(100)` that caused a real
production incident on Decision and Activity Log, `docs/implementation/module-decision-and-activity-log.md`'s
own "Incident" section) — verified directly before building, so the identical bug class isn't
repeated here. Each row's `before`/`after` state (when present) renders via a
`<details>`/`<summary>` disclosure — zero client JS — rather than a dedicated detail page, since an
audit event has no lifecycle of its own to navigate to. Actor names are resolved via the existing
`getUsersByIds()` (degrades to the raw id on a 403/404) rather than a new lookup mechanism.

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule — a
small, frontend-only UI slice consuming an already-reviewed, already-gated backend with no new
endpoint and no new shared-types. A direct read-through pass verified the filter contract against
the real backend `listAuditLogsAndSystemHealthEventsQuerySchema` (event-type allowlist
enforcement — the 25-value list checked byte-for-byte against the backend's own constant, UUID
validation, length caps), the `from`/`to` UTC-boundary conversion, the actor/project UUID-format
short-circuit before either is ever sent to the backend, the `limit` cap headroom, and reuse of
every established shared helper (`list-filter-styles.ts`, `list-table-styles.ts`, `pagination.ts`,
`search-params.ts`, `uuid.ts`, `format-timestamp.ts`, `users.ts`) — **0 findings**. A separate
security review was skipped per the same standing rule — no new endpoint, no new RBAC action, no
new sink; `before`/`after` state renders via `JSON.stringify()` inside a `<pre>`, never
`dangerouslySetInnerHTML`.

18 new `dashboard-web` unit tests (query parsing, href building, label mapping, and the fetch
function's URL construction, UUID-shape short-circuiting, and pagination trim), 2097/2097 overall;
typecheck clean across `dashboard-web`/`dashboard-api`/`dashboard-worker`, `eslint
--max-warnings=0` + CSS-token check (114 files) clean, `next build` clean with the new route
present, `prettier --check` clean — all independently re-run by the orchestrating session.
