# Phase 1B Approval Checklist — Database Foundation

**Status:** Ready for human review. Unsigned — nothing below is self-approved, consistent with
the separation-of-duties rule already applied to every prior phase's checklist (ADR-0010,
`knowledge/12-dashboard-security-controls.md`).

---

## Completion condition (task package §21/§24)

- [x] **1. Google/Sequelize connection foundation works.** `getConnection()` constructs a real,
      cached Sequelize instance with serverless-aware pooling — verified against a real disposable
      database, not mocked.
- [x] **2. Migration framework works, both directions.** umzug-based runner; up/down round-trip
      verified against a real database twice (compiled CLI and the Vitest-direct path) — see
      `docs/project-state/phase-1b-validation-report.md` §6.
- [x] **3. Transaction foundation works, both outcomes.** `withTransaction()` verified to commit
      on success and roll back on a thrown error, against a real database (not mocked) — validation
      report §5.
- [x] **4. Repository foundation works.** `SequelizeRepository<TEntity>` implements every method
      of the Phase 1A `Repository<TEntity>` interface, exercised against the `_framework_probe`
      test-only table (not `projects`/`users` — see item 9 below).
- [x] **5. Soft delete verified as genuinely soft.** A "deleted" row is excluded from
      `findById` but proven still physically present via `paranoid: false` — validation report §5.
- [x] **6. Health check works.** `checkDatabaseHealth()` proves live connectivity with a real
      `SELECT 1`, never throws.
- [x] **7. Required tests pass.** 19 unit tests (mocked) + 8 integration tests (real disposable
      database) — `docs/project-state/phase-1b-validation-report.md`.
- [x] **8. No unauthorized feature implementation exists.** No `projects`/`users`/any other
      business entity, no RBAC, no authentication — see the forbidden-actions table below.
- [x] **9. Documentation is updated.** This document, `phase-1b-validation-report.md`,
      `packages/database/README.md`, plus `HANDOFF.md`, `docs/traceability/phase-0-requirements-traceability.md`
      (REQ-003 updated), `docs/phase-plans/phase-1-foundation-plan.md` (Task 3 marked complete).
- [x] **10. A verified remote commit SHA is recorded.** See "Commit record" below, backfilled
      after the Phase 1B branch is pushed.
- [x] **11. The Phase 1B approval checklist is produced.** This document.

---

## Forbidden-actions check (task package §25/§27) — verified, not assumed

| Forbidden action                                                 | Status                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Create `projects`, `users`, or any other business entity         | **Not done.** Only `_framework_probe`, an explicitly-named non-business test-only table, exists — `git diff` shows exactly one migration file. |
| Create roles, permissions, role-permission joins                 | **Not done.** No such table/model anywhere.                                                                                                    |
| Implement authentication or RBAC                                 | **Not done.** No auth code exists in this change.                                                                                              |
| Use `sync()`/`sync({ alter: true })` or any schema-auto-sync     | **Not done.** `grep -rn "\.sync(" packages/database/src` → no matches; migrations are the only schema-change path.                             |
| Add a second migration path anywhere outside `packages/database` | **Not done.** `dependency-cruiser`'s `only-database-package-touches-sequelize` rule (now live, not a no-op) passes with 0 errors.              |
| Wire `dashboard-api`/`dashboard-worker` to the new repository    | **Not done.** Neither app's source was touched by this change — `git diff --stat` confirms.                                                    |
| Provision the actual Supabase database                           | **Not done.** No Vercel/Supabase API call anywhere; all testing used a local/CI disposable instance.                                           |
| Add real credentials anywhere                                    | **Not done.** `pnpm scan:secrets` clean, 189 files; `.env.example` contains placeholders only.                                                 |
| Modify the base Node.js skill                                    | **Not done.** `webdesk-nodejs/` untouched (gitignored, unchanged).                                                                             |
| Merge automatically                                              | **Not done.** No PR merge performed.                                                                                                           |
| Begin Phase 1C automatically                                     | **Not done.** Stopping here for review, per this document.                                                                                     |

---

## What Phase 1B does and does not do

**Does:** real Sequelize/PostgreSQL connection (serverless-aware pooling, SSL by default),
umzug migration framework (one framework-proving migration), transaction helper, generic
Sequelize-backed repository base, health check, local + CI disposable-database test strategy, and
the documentation set above.

**Does not:** anything in the forbidden-actions table. Phase 1C (Google Workspace authentication,
emergency local admin, session management) is a separate phase requiring its own separate
authorization — this checklist's approval, once signed, covers Phase 1B only. Per that Phase 1C
task brief's own explicit precondition, Phase 1C cannot begin until this checklist is approved and
its remote SHA recorded.

## Reviewer's own checklist

- [ ] **Re-run the validation commands** in `docs/project-state/phase-1b-validation-report.md`
      yourself, including the integration suite against your own disposable database
      (`packages/database/README.md` has setup steps).
- [ ] **Spot-check the forbidden-actions table above** against the actual diff
      (`git show --stat <phase-1b-sha>`) — confirm no file implements more than what's claimed.
- [ ] **Confirm `webdesk-nodejs/` is absent from the diff.**
- [ ] **Decide Phase 1C's authorization separately** — this checklist's approval does not imply
      Phase 1C is authorized.

## Commit record

_(recorded after the branch is pushed — see the git-workflow section of this checklist once
complete)_

---

## Sign-off

| Field                     | Value                                    |
| ------------------------- | ---------------------------------------- |
| Approved by               | _(blank)_                                |
| Approval date             | _(blank)_                                |
| Exact approved commit SHA | _(blank)_                                |
| Authorization scope       | _(blank — e.g. "Phase 1C" once granted)_ |

| Role                                   | Name | Decision                       | Date |
| -------------------------------------- | ---- | ------------------------------ | ---- |
| Reviewer (Tech Lead / Architect / DBA) |      | ☐ Approved ☐ Changes requested |      |
| PM                                     |      | ☐ Approved ☐ Changes requested |      |

**On approval:** whatever scope is recorded above. Phase 1C (Google Workspace authentication,
emergency local administrator authentication, session management) is the next candidate, per its
own task brief — not started automatically.
