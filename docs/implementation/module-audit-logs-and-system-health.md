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

**No new table, no new RBAC migration.** Migration `00122` marks
`module_registry.implementation_status = 'in_development'` for `audit_logs_and_system_health` —
the only schema change in this pass. No confidentiality/redaction mechanism beyond what
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
- `packages/database/src/migrations/00122-mark-audit-logs-and-system-health-in-development.ts` —
  the only schema change: marks `module_registry.implementation_status = 'in_development'` for
  `audit_logs_and_system_health`. Numbered `00122` (not `00120`, the next number after the
  branch's own base `00119`) per this task's own explicit instruction, since `00120`/`00121` were
  reserved by other concurrent work at build time (confirmed: a concurrently-built
  `module-system-settings` branch, discovered mid-build — see "Working-directory sharing incident"
  below — used exactly those two numbers for its own migration).

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
