# Change Center Module Backend — Approval Checklist

**Status:** Code review complete (high-effort 8-angle finder pass — 6 findings kept, 5 CONFIRMED
and 1 PLAUSIBLE, all fixed). Security review complete (0 findings above threshold). Required
second-role human review complete via direct instruction. Gate approved.

## Completion condition

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start Change Center and use the migration numbering from 00105" instruction                                                                                                                                                                                                                                                                                           |
| 2   | Genuine scoping decisions surfaced         | ✅ Two real forks confirmed with the user via `AskUserQuestion` before building: the `scan_center` dependency's source-linkage shape (real FK once Scan Center's own `scan_findings` merged, not a free-text placeholder) and the target-record shape (polymorphic optional `targetModuleKey`/`targetId` + required free-text `recordLabel`, mirroring Review and Approval Center) |
| 3   | Real Scan Center dependency confirmed live | ✅ A genuine mid-task blocker — the user referenced migrations `00103`/`00104` on a branch that hadn't reached `origin` yet; work paused until `module-scan-center` (PR #102) actually merged to `main`, then Change Center was built against its real, live `scan_findings` schema, not a placeholder                                                                             |
| 4   | Migration numbering                        | ✅ `00105`/`00106` — the 105th/106th real migrations, verified via a clean up/down (×2) → up round-trip (106 executed, 0 pending), re-run again after the fix round to pick up the added index                                                                                                                                                                                     |
| 5   | Required tests pass                        | ✅ Independently re-run by the orchestrating session against a real disposable PostgreSQL 17 database (not trusted from the build agent's own report): 25/25 `dashboard-api` unit tests, 815/815 `packages/database` integration tests (2 new, proving the fix round's own regressions), 804/804 `dashboard-api` e2e/integration tests                                             |
| 6   | Full validation clean                      | ✅ Migration round-trip clean; typecheck clean on both packages; `eslint --max-warnings=0` clean; `prettier --check` clean; module-registry validation unaffected (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities                                                                                                                                               |
| 7   | Independent code review complete           | ✅ High-effort 8-angle finder pass (line-by-line scan, removed-behavior audit, cross-file trace, reuse, simplification, efficiency, altitude, conventions) run via parallel subagents — 6 findings kept in the final report (5 CONFIRMED, 1 PLAUSIBLE), all fixed                                                                                                                  |
| 8   | Security review complete                   | ✅ Run separately, focused on SQL injection via `col()`/`fn()`/`literal()`, IDOR/project-scoping, RBAC decorator placement and the dynamic per-transition authorization check, mass assignment, and audit/error data exposure — 0 findings above threshold                                                                                                                         |
| 9   | Known out-of-scope gaps flagged, not fixed | ✅ No `dashboard-web` UI yet — a separate, not-yet-requested next step, matching every prior module's own backend-first precedent                                                                                                                                                                                                                                                  |
| 10  | Documentation updated                      | ✅ `docs/implementation/module-change-center.md` (Scope + As-built + independent code review + not-done section, collapsed single-file format)                                                                                                                                                                                                                                     |
| 11  | Exact branch/commit verified and recorded  | ✅ Branch `module-change-center`, commit `c470ca6` — includes the initial build and the full code-review fix round in one commit; not yet pushed to `origin`                                                                                                                                                                                                                       |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own backend-first
  precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `change_center`
  permission group verbatim.
- No hard-delete route — matches ADR-0016's project-wide no-hard-delete policy; `change_records`
  rows are permanent once created.
- `@RequirePermission` is placed on every individual controller method, never at class level —
  confirmed directly and by both the code review and security review.
- Both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained CJS barrel
  Vercel's production bundler actually uses) were updated together — confirmed directly.
- The `"(assigned)"` RBAC qualifier for the four mid-tier roles is deliberately NOT enforced as
  real object-level access control — a blanket role grant plus an app-level `assignedToMe` list
  filter, matching the already-established precedent this project's own security review of the
  RBAC/authorization pass and Review and Approval Center's own build both record explicitly.

## Independent code review — summary

High-effort 8-angle finder pass (each angle run as an independent subagent). 6 findings kept in the
final report (5 CONFIRMED, 1 PLAUSIBLE), all fixed:

- **Most severe.** `updateStatus()`'s own doc comment claimed abandoning `COALESCE(column, NOW())`
  "stamp once" semantics for the actor-id half of `decidedByUserId`/`appliedByUserId`/
  `verifiedByUserId` was unavoidable without string-interpolating `actorUserId` into raw SQL — that
  claim was itself wrong: Sequelize's `fn("COALESCE", col(...), actorUserId)` binds the value as a
  real, parameterized query argument. Fixed by adopting `fn`/`col` (paired with a real
  `COALESCE("column", NOW())` `literal()` for the timestamp half), restoring genuine stamp-once
  semantics and resolving a real, verifiable self-contradiction against `ChangeRecordEntity`'s own
  documented contract. Verified empirically, not just by inspection — a new integration test drives
  a record through two independent re-entries (a decision re-entered via `deferred`, an apply
  re-entered via `apply_failed`) with a different actor each time and asserts the original
  actor/timestamp survived both.
- **`create()`'s and `update()`'s post-write `AuditService.record()` calls were unguarded**, unlike
  `changeStatus()`'s identical call, which is deliberately wrapped so a transient audit-write
  failure doesn't turn an already-committed DB write into an opaque 500. Fixed by wrapping both in
  the identical try/catch + `console.error` pattern; two new unit tests prove the create/update
  call still returns the real record when the audit call rejects.
- **`rollbackGuidance` could never be cleared through the API once set** — the status-change DTO
  rejects any non-`undefined` value paired with a target status other than `apply_failed`, so a
  record recovering via `apply_failed -> applying -> applied -> verified` kept stale rollback
  instructions forever. Fixed in the repository's `updateStatus()`: leaving `apply_failed` for any
  other status without a fresh value now clears it to `null` automatically; a new integration test
  proves this both immediately after the retry and after the record goes on to reach `applied`.
- **`severity` was a real, editable column per the repository's own type derivation, but
  `updateChangeRecordSchema` never exposed it**, with no documented rationale unlike
  `category`/`publicId`'s deliberate immutability. Fixed by adding it to the update DTO; a new unit
  test proves it flows through.
- **No index covered `assigned_to_user_id`**, despite `assignedToMe`/`assignedToUserId` being a
  first-class, documented list filter mirroring Review and Approval Center's own "my queue"
  concept. Fixed by adding a `(project_id, assigned_to_user_id)` composite index to migration
  `00105` (amended in place — not yet deployed anywhere).
- **PLAUSIBLE, fixed as part of the same pass.** `changeStatus()`'s
  `rollbackGuidance: nextStatus === "apply_failed" ? body.rollbackGuidance : undefined` ternary was
  redundant given the DTO's own `superRefine` already guarantees the same invariant, inconsistent
  with the adjacent `decisionNotes` pass-through one line below. Simplified to a direct pass-through
  now that the fix above moved the real clearing logic into the repository layer.

See `docs/implementation/module-change-center.md`'s own "Independent code review" section for the
full account.

## Security review — summary

Run separately from the code review, focused specifically on this diff's new attack surface (a new
module means a new RBAC-gated route family and a new raw-SQL `col()`/`fn()`/`literal()` usage).
**0 findings above threshold.** Confirmed: every raw-SQL helper in `updateStatus()` uses fixed,
hardcoded column-name/SQL-literal strings, with `actorUserId` the only variable value and it is
passed as a bound `fn()` argument, never string-interpolated; the `list()` search filter reuses the
already-audited `escapeLikePattern()` helper; every route carries `:projectId` and every
service-layer read/write resolves the record via a `projectId`-scoped `findById()` that throws
`NotFoundException` (not a leaked 403/200) on a cross-project mismatch, confirmed by a dedicated
e2e test; `@RequirePermission` is method-level throughout, with `changeStatus()`'s own dynamic
per-transition check correctly threading the already-verified `projectId` into
`AuthorizationService.assertAllowed()`; both create/update DTOs correctly exclude every
server-managed field (`status`, the three decision/apply/verify timestamp-and-actor pairs,
`rollbackGuidance`) from client control; and error messages/audit `afterState` entries expose only
caller-already-known values, no internal detail.

## Sign-off

**Required second-role human review complete** — via the direct "gate it and push the branch"
instruction. Since every CONFIRMED and PLAUSIBLE finding across both reviews was fixed and
re-validated (0 open findings of any kind), this checklist's own findings tables serve as the
review artifact rather than a separately published packet.

**The gate (G4-change-center) was then separately requested and approved** — WebDesk Solution,
decision CONFIRM (a clean pass, not an override, since the second-role review was already complete
before the gate was requested). See `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`.

This gate approval does not itself authorize opening a PR or merging — each remains its own
separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule.
