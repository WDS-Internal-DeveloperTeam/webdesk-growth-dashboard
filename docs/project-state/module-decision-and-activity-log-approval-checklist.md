# Decision and Activity Log — Approval Checklist

## Scope

Module #37, `decision_and_activity_log`. A read-only, human-friendly query
surface (`GET /decision-and-activity-log/events`) over the existing, already-
live ADR-0017 `audit_events` table — not a new table, not a new write path.
Closes the "query HTTP surface" gap `docs/task-packages/phase-1e-audit-
foundation.md` itself deferred.

Two design decisions confirmed directly with the project owner before
building (`AskUserQuestion`):

1. RBAC — reuse the existing, already-seeded `system_settings` permission
   group as-is (chosen) vs. a new dedicated permission group.
2. Event scope — filter server-side to the canonical spec's own named
   decision/activity event-type subset (chosen) vs. exposing the full
   `audit_events.event_type` vocabulary.

Migrations `00113` (composite `(event_type, created_at)` index on
`audit_events`) / `00114` (mark the module `in_development`) — renumbered
from `00111`/`00112` on explicit instruction to reserve those numbers for
other concurrent work.

## Independent verification

(orchestrating session, not trusted from the build agent's own report)

- Read every changed file directly — the controller/service/DTO/constants,
  the new `AuditEventRepository.list()`/`AuditService.list()` delegation, and
  both migrations.
- Confirmed `@RequirePermission` is applied at the method level (the class
  has only one route, but the decorator itself is correctly placed on the
  handler, not the controller).
- Confirmed the RBAC module key (`system_settings`) is real — cross-checked
  against migration `00013`'s own seeded matrix (`super_admin: "VCERM"`,
  `owner_growth_approver: "VM"` — only these two roles hold `view`).
- Confirmed the new `AuditEventListFilter` type and `AuditEventRepository.
list()` method propagate to both `packages/database/src/index.ts` (ESM) and
  `index.cjs.ts` (the separately-maintained CommonJS barrel Vercel's Function
  bundler uses in production) — both re-export via `export * from
"./audit/index.js"`, so no per-symbol update was needed.
- Renumbered the migrations from `00111`/`00112` to `00113`/`00114`
  (own commit `72c1f55`) and re-verified the full migration up/down/up
  round-trip, `packages/database` unit + integration suites, module-registry
  validation, and `dashboard-api` typecheck/lint/unit/e2e/build against the
  renamed files, all clean.
- Re-ran every validation command directly against a real local disposable
  PostgreSQL 17 database — not trusted from the build agent's own report.

## Independent code review

(this project's own `code-review` skill, high effort — a direct line-by-line
read-through rather than the 8-parallel-agent fan-out, given the diff's
manageable size)

1 finding, CONFIRMED and fixed: `AuditEventRepository.list()` ordered only
by `createdAt DESC` with no tiebreaker, making offset pagination unstable
for rows sharing an identical timestamp — the same bug class this project's
own Persona Library `list()` review already found and fixed once. Fixed by
adding `id DESC` as a secondary sort key (commit `3b37fc2`). Re-verified:
838/838 `packages/database` integration tests, 1793/1793 `dashboard-api`
unit tests, 7/7 module e2e tests, typecheck/lint/build/prettier all clean.

## Security review (separate `security-review` skill run)

**0 findings above threshold.** Confirmed: the RBAC gate is real and narrow
(`system_settings:view`, held by only 2 of 7 seeded roles, verified against
the actual seed data); every query filter (`projectId`/`actorUserId`/
`entityType`/`entityId`/date range/`eventType`) is applied through
Sequelize's parameterized `where` object with no raw-SQL interpolation;
`eventType` is validated against a closed Zod enum, rejecting anything
outside the module's own allowlist with a clean 400 rather than silently
ignoring it; no new write path exists (`AuditService.record()` remains the
sole write path, unmodified); and `beforeState`/`afterState` are returned
unredacted — a deliberate, documented decision (see the service's own doc
comment), not a new exposure this diff introduces, since it makes visible to
the same two already-most-trusted roles data that already exists unredacted
in the write-side audit trail of several already-shipped modules.

## Sign-off

Required second-role human review, per ADR-0010 (the implementing agent
cannot also be its own reviewer): **Approved as-is**, WebDesk Solution,
2026-09-03 — no open findings of any kind on this branch.

Gate `G4-decision-and-activity-log`: **CONFIRM** — WebDesk Solution,
2026-09-03, approved commit `3b37fc2` on branch
`module-decision-and-activity-log`.

This gate approval does not itself authorize opening a PR or merging — each
remains its own separate, not-yet-requested authorization, per this
project's standing "no auto-merge" rule.
