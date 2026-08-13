# Phase 1E Validation Report — Six Operational-Infrastructure Architecture Slices

**Status:** Consolidates the real, independently-verified state of all six Phase 1E slices as of
2026-08-13 — implementation validation (already run per-branch during this session's CI-fix pass,
reproduced here in summary), plus this document's own new work: the first independent code review
and first security review either has ever received. Follows the same discipline as
`docs/project-state/phase-1a-validation-report.md` through `phase-1d-validation-report.md`.

**Environment:** Node.js 22.18.0 (nvm-managed), pnpm 11.20.0 via corepack — same documented
Node-version note as every prior phase's report. Local PostgreSQL 17 (Homebrew), one fresh
disposable database per branch.

---

## 1. Scope — six slices, exact commit SHAs (item 14 of the Phase 1E completion checklist)

| Slice                   | Branch                             | Exact pushed SHA                           | PR                                                                                    | Merge status                                                   |
| ----------------------- | ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Audit foundation        | `phase-1e-audit-foundation`        | `f9a32bb49c7a910eff3a48bfd8dd3728ee93d74e` | [#11](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/11) | **Merged**                                                     |
| Audit schema expansion  | `phase-1e-audit-schema-expansion`  | `b0e4eefa0f31849be5e1bb95f50d29500f80b449` | [#13](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/13) | **Merged** (main @ `a0a86688b32c8594497a34a87fabadc022fa68bf`) |
| Job architecture        | `phase-1e-job-architecture`        | `084782aae4ae1d168b1b32d738faf1c994552d8a` | [#14](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/14) | Open                                                           |
| Notification foundation | `phase-1e-notification-foundation` | `e6a19bba952d1918eeca9ae97b63d6c2be1cd504` | [#15](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/15) | Open                                                           |
| Retention architecture  | `phase-1e-retention-architecture`  | `5839c3f325cafc2ac5c4ac6468f5c759313449a3` | [#16](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/16) | Open                                                           |
| Operational contacts    | `phase-1e-operational-contacts`    | `ae7aa967729a930b87f95694600053889d58951a` | [#17](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/17) | Open                                                           |
| System events & health  | `phase-1e-system-events-health`    | `b3b88a70ea6122518ca91039b6b5f66d99085d18` | [#18](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/18) | Open                                                           |

Every branch (except the already-merged audit foundation) has had `main` (post-PR-#13) merged into
it as of the SHAs above, resolving the migration-number collision every branch independently hit
and adding the missing `AuditEventType` category-map entries — see each branch's own rebase commit
message for details. All five open branches' CI is green on GitHub Actions as of these SHAs
(Typecheck, Lint, Formatting validation, Unit tests, Integration tests, Database migration test,
Production build, Dependency vulnerability audit, Secret-pattern scan, Workspace-boundary check —
14/14 checks passing on each).

## 2. Per-slice test counts (re-verified fresh during this session's CI-fix pass)

| Slice                   | Unit tests              | DB integration tests                                                               | e2e tests | Migration round-trip |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------- | --------- | -------------------- |
| Job architecture        | 182/182                 | 65/65 (incl. `00001`→`00022`)                                                      | 44/44     | Clean                |
| Notification foundation | — (unchanged by rebase) | —                                                                                  | —         | Clean                |
| Retention architecture  | 170/170                 | 61/61 (incl. `00001`→`00022`)                                                      | 46/46     | Clean                |
| Operational contacts    | 169/169                 | 60/60 (incl. `00001`→`00022`)                                                      | 44/44     | Clean                |
| System events & health  | 161/161                 | 64/64 (incl. `00001`→`00023`, and the previously-failing FK-link test now passing) | 50/50     | Clean                |

`pnpm audit`: 0 vulnerabilities on every branch. Prettier/ESLint/`tsc --noEmit`: clean on every
branch (including two pre-existing prettier issues in as-built docs, fixed as part of this pass).

## 3. Independent code review (item 9)

Performed for the first time across all six slices this session (audit foundation had never had
one either, despite being merged). Full findings recorded via this session's `ReportFindings`
tool calls, not reproduced verbatim here — summarized by severity:

- **PR #13 (audit schema expansion) — 1 CONFIRMED critical finding, now FIXED**: migration `00019`'s
  backfill `UPDATE` statements would have unconditionally failed against any `audit_events` table
  that already has rows, because migration `00018`'s immutability trigger blocks all `UPDATE`s with
  no escape hatch (unlike `DELETE`, which has a session-local authorization flag). Never triggered
  in production (migration `00019` was never run there before the fix landed). **Fixed in
  [PR #20](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/20)**: the
  backfill now runs inside a transaction that disables the trigger for its own four `UPDATE`s only,
  then re-enables it — migration `00018` itself (already applied in production) was left untouched.
  A regression test proves both the bug (verified failing without the fix) and the fix (passing
  with it, and confirming immutability is still enforced afterward).
- **PR #11 (audit foundation) — 4 CONFIRMED correctness bugs**: the missing-CJS-export bug (already
  independently discovered and fixed post-merge via commit `2e03a57`, not part of this PR's own
  fix); three instances of a fallible `auditService.record()` write sitting between a real state
  change and its consequence (session revocation not reached on audit-write failure; SoD-denial
  audit write able to mask the original `ForbiddenException`; recovery-request create/decide
  committing before a still-fallible audit write).
- **PR #14 (jobs) — 2 CONFIRMED, 3 PLAUSIBLE**: a genuine concurrency race in idempotency-key
  reissue-after-failure (two concurrent requests can both "win" the same key); a job creation
  failure permanently stranding its idempotency reservation (`IdempotencyService.fail()` is never
  called from `JobService`); plus three plausible races/inconsistencies in the retry/cancellation
  state machine.
- **PR #15 (notifications) — 4 PLAUSIBLE**: no row-locking on concurrent state transitions; a
  `retryEligible` flag that goes stale on the `sent_to_smtp` transition; an unreachable
  administrative-recovery path for a stuck two-phase handoff; an unverified `attemptCount` handling
  asymmetry in `confirmRejected`.
- **PR #16 (retention) — 2 CONFIRMED, 1 PLAUSIBLE**: `RetentionCleanupService.run()` can perform
  real soft-deletions and then lose the entire audit trail if a later candidate in the same batch
  throws; the `retention_holds_scope_shape` CHECK constraint allows a hybrid entity+category row
  neither the schema comment nor any consumer expects; a TOCTOU race on concurrent hold releases.
- **PR #17 (operational contacts) — 3 CONFIRMED**: `businessDaysBetween()`'s off-by-one inflates
  elapsed SLA time (a medium-severity incident reads as "met" almost immediately after opening);
  `activeStatus=false` on the list-contacts query coerces to `true` via `z.coerce.boolean()`'s
  plain `Boolean()` semantics, silently inverting the filter; an overnight (`start > end`)
  working-hours window is accepted with no validation and then silently excludes that contact from
  every escalation chain forever.
- **PR #18 (system events/health) — 2 PLAUSIBLE, both minor**: `recordCheck()`'s audit event drops
  `correlationId` even though it's available; the status-read route's "unknown for any unrecognized
  key" design is intentional but asymmetric with the write route's 404 for the same input.

**None of these findings were fixed in this pass** — reviewing was the requested scope, not
remediation. They are tracked here as the concrete, actionable output of item 9.

## 4. Security review (item 10)

See `docs/security/threat-model-phase-1e-operational-infrastructure.md` in full — a STRIDE pass
covering all six slices as one document (self-reviewed only; second-role human review still
outstanding, same as every prior phase's threat-model doc required before its own gate). Ten gaps
surfaced, most notably: `POST /retention/holds`'s `approvedByUserId` is client-attributable with no
verification (Spoofing); `JobService.create()` and the entirety of `NotificationService` have zero
audit-trail coverage, not merely fallible coverage (Repudiation — this is a stronger finding than
the code-review pass's "fallible audit write" findings, since these two write paths have no audit
call at all); `operational_contacts` PII (name/email/phone) has no confidential-field gating
comparable to the Phase 1D-expanded precedent (Information Disclosure); two list endpoints
(`OperationalContactRepository`, `RetentionHoldRepository`) have no pagination cap, and
`JobRetryService.manualRetry()` doesn't respect `maxAttempts` (Denial of Service).

## 5. Documentation and traceability (item 11)

`docs/implementation/requirements-traceability-matrix.md`, `outputs/webdesk-growth-dashboard/HANDOFF.md`,
and `docs/phase-plans/phase-1-foundation-plan.md` were all previously silent on every Phase 1E
slice — confirmed via grep before this session's update, zero matches for "Phase 1E" in any of the
three. All three now have a dated addendum (traceability matrix, phase plan) or an updated live
section (HANDOFF) recording Phase 1E's actual scope and status, appended rather than rewriting
their own historical narrative, per this project's standing pattern.

## 6. What remains before any Phase 1E gate can be requested

- Fix or explicitly accept each finding above (owner decision, not made in this pass).
- Second-role human review of both the code-review findings and
  `docs/security/threat-model-phase-1e-operational-infrastructure.md`.
- Merge decisions for PRs #14–#18 (each independent, each its own separate authorization).
- `docs/project-state/phase-1e-approval-checklist.md` (item 13) records the sign-off table itself —
  currently all rows unsigned.
