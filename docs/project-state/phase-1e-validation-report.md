# Phase 1E Validation Report — Six Operational-Infrastructure Architecture Slices

**Status:** Consolidates the real, independently-verified state of all six Phase 1E slices.
Originally written 2026-08-13 while five of the six slices were still open PRs; **substantially
rewritten 2026-08-13** now that all six are merged to `main` and the fixable findings from both
reviews below have been closed. Follows the same discipline as
`docs/project-state/phase-1a-validation-report.md` through `phase-1d-validation-report.md`.

**Environment:** Node.js 22.18.0 (nvm-managed), pnpm 11.20.0 via corepack — same documented
Node-version note as every prior phase's report. Local PostgreSQL 17 (Homebrew), one fresh
disposable database per validation pass.

---

## 1. Scope — six slices, all merged to `main`

| Slice                   | PR                                                                                    | Merge commit           | Migrations    |
| ----------------------- | ------------------------------------------------------------------------------------- | ---------------------- | ------------- |
| Audit foundation        | [#11](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/11) | `c62cbc1` (2026-08-12) | `00018`       |
| Audit schema expansion  | [#13](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/13) | `a0a8668` (2026-08-13) | `00019`       |
| Job architecture        | [#14](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/14) | `472725a`              | `00020–00022` |
| Migration 00019 fix     | [#20](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/20) | `1a375e9`              | —             |
| Audit-foundation fix    | [#21](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/21) | `54cf310`              | —             |
| Retention architecture  | [#16](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/16) | `a61752f`              | `00023–00025` |
| Notification foundation | [#15](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/15) | `2da7996`              | `00026`       |
| Operational contacts    | [#17](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/17) | `b681d5f`              | `00027–00029` |
| System events & health  | [#18](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/18) | `f8c04ae`              | `00030–00033` |

`main`'s HEAD as of this rewrite is `f8c04ae5a9981de75e5ac907935b7e0f99348bbe` (before this
documentation PR's own merge). This is a factual anchor point for what's actually on `main` — it
is **not** itself a gate-approval SHA; that remains a separate human decision (see
`docs/project-state/phase-1e-approval-checklist.md`).

Each of PRs #14–#18 independently claimed the same migration numbers (`00020`–`00023`) for
different tables, since each branch was built off an earlier `main` state in parallel. Merging
them one at a time required reconciling `main` into each branch (resolving real, additive
conflicts in `app.module.ts`, `AuditService`'s event-type/category maps, and the ESM/CJS barrel
exports every time a new module was added) and renumbering each branch's own migrations to the
next free slot before merging — recorded in each branch's own "Renumber ... migrations" commit.

## 2. Final test counts (re-verified fresh against `main`'s actual HEAD, not per-branch)

Two passes recorded here: the original 7-PR merge pass, and a second pass for the 3 additional
fixes closing security-review findings (§4).

**After the 7-PR merge pass** (all six slices + 2 reconciliation fixes), run against a single
fresh disposable PostgreSQL 17 database, all 33 migrations applied in one pass:

- Typecheck/lint clean, 14/14 turbo tasks; unit 266/266; database integration 108/108; e2e 72/72;
  clean 33-migration round trip; secret scan clean, 481 files.

**After the 3 additional fixes** (notification recipient existence check, contacts confidential-field
gating, manual-retry `maxAttempts` cap — see §4), re-run fresh on a new disposable database:

- Typecheck/lint clean, 14/14 turbo tasks.
- **Unit tests (`dashboard-api`):** 279/279 passing (35 test files — +13 from the 3 fixes' own
  tests, including a new `operational-contacts.controller.spec.ts`).
- **Database integration tests (`packages/database`, real disposable Postgres):** 108/108 passing
  (10 test files — unchanged, no new migrations in this pass).
- **`dashboard-api` e2e tests (real disposable Postgres):** 72/72 passing (10 test files —
  confirms the NestJS module graph resolves with `AuthorizationService` now injected into
  `OperationalContactsController` and `UserRepository`/`OperationalContactRepository` now injected
  into `NotificationService`).
- **Migration round trip:** clean, all 33 migrations (no new ones).
- **`pnpm audit`:** 0 vulnerabilities specific to this work. (The same pre-existing, unrelated
  high-severity `nanoid` advisory — `GHSA-2v37-7h3g-55p8`, dev-tooling only via
  `@nestjs/cli`/webpack/vitest's postcss chain — still shows on `main`; not part of this scope.)
- **Secret-pattern scan:** clean, 484 tracked files.

CI on each of the 7 merged PRs (#14, #20, #21, #16, #15, #17, #18) was independently confirmed
green (13/14 checks; the 14th being the same pre-existing `nanoid` finding) immediately before
each merge. The 3 additional fixes have not yet been through their own PR/CI cycle — see §6.

## 3. Independent code review — findings and their disposition

Performed across all six slices. Full findings recorded via `ReportFindings` during the original
review pass; disposition since then:

| Slice                   | Findings                 | Disposition                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audit schema expansion  | 1 CONFIRMED (critical)   | **Fixed** — migration `00019`'s backfill was blocked by its own immutability trigger; fixed in [PR #20](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/20) with a regression test proving both the bug and the fix. |
| Audit foundation        | 4 CONFIRMED              | **Fixed** — centralized SoD-denial audit logging, parallelized independent role writes, validated `retention_category` at both layers, in [PR #21](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/21).              |
| Job architecture        | 2 CONFIRMED, 3 PLAUSIBLE | **Fixed** — all 5, on the `phase-1e-job-architecture` branch before merge (commit `8924e83`, "Fix the 5 job-architecture findings from independent code review").                                                                                |
| Notification foundation | 4 PLAUSIBLE              | **Fixed** — state-machine concurrency races and stuck `sent_to_smtp` recovery, on the branch before merge (commit `22dc718`).                                                                                                                    |
| Retention architecture  | 2 CONFIRMED, 1 PLAUSIBLE | **Fixed** — TOCTOU race on hold release, hybrid-scope CHECK gap, cleanup-run audit-trail loss, on the branch before merge (commit `6114e55`).                                                                                                    |
| Operational contacts    | 3 CONFIRMED              | **Fixed** — `businessDaysBetween()` off-by-one, `activeStatus` query-coercion bug, overnight working-hours exclusion, on the branch before merge (commit `90b11fe`).                                                                             |
| System events & health  | 2 PLAUSIBLE (minor)      | **Fixed** — missing `correlationId` on health-check audit events, status-route validation asymmetry, on the branch before merge (commit `b44cfdc`).                                                                                              |

**Every code-review finding across all six slices has been fixed and re-validated.** None remain
open.

## 4. Security review — findings and their disposition

See `docs/security/threat-model-phase-1e-operational-infrastructure.md` in full — a STRIDE pass
covering all six slices. Ten numbered gaps originally surfaced. The user went through all 5
genuine policy questions explicitly, one by one, deciding each rather than having them resolved
unilaterally — 3 "fix now," 2 "accept as tracked debt." Combined with the 5 non-policy gaps
(already fixed in the original review-and-docs pass), **8 of 10 gaps are now fixed and
re-validated; 2 are accepted as tracked technical debt by explicit decision:**

**Fixed (8, each closed with its own commit and re-validated):**

- `JobService.create()` had zero audit-trail coverage — fixed (commit `e6306a8`).
- `NotificationService`'s five mutating methods had zero audit-trail coverage — fixed (commit
  `1c9e822`).
- `SystemHealthService.recordCheck()`'s audit emission was conditional on `checkedByUserId` being
  truthy — made unconditional (commit `eb4b916`).
- `OperationalContactRepository.list()`/`findActiveForArea()` had no pagination cap — fixed
  (commit `8db3bd7`).
- `RetentionHoldRepository.listAll()` had no pagination cap — fixed (commit `79a265e`).
- `POST /notifications` accepted `recipientUserId`/`recipientContactId` with no existence check —
  fixed (commit `df07eb8`); `projectId` deliberately still unchecked, no `Project` entity exists
  yet in `packages/database`.
- `operational_contacts` PII (name/email/phone) had no confidential-field gating — fixed (commit
  `f632e96`), gated behind the existing `view_confidential` action on `system_settings`, the same
  Phase 1D-expanded mechanism used elsewhere.
- `JobRetryService.manualRetry()` didn't respect `maxAttempts` — fixed (commit `a6305c1`), now
  enforces the same cap the automatic retry path already applies.

**Accepted as tracked technical debt (2, explicit human decision, not oversight):**

1. `POST /retention/holds`'s `approvedByUserId` is client-attributable with no verification a
   named user actually approved anything (Spoofing) — no real legal-hold workflow exists yet and
   the permission is zero-seeded; revisit before one goes live.
2. `GET /jobs`/`GET /notifications` accept an unchecked `projectId` query filter with no
   route-level project scoping — latent (zero project-scoped grants exist today), same class of
   issue as the already-tracked Phase 1D `Op.in` finding, and accepted on the same precedent
   (Elevation of Privilege).

## 5. Documentation and traceability

`docs/implementation/requirements-traceability-matrix.md`, `outputs/webdesk-growth-dashboard/HANDOFF.md`,
and `docs/phase-plans/phase-1-foundation-plan.md` all carry a dated Phase 1E addendum, now updated
to reflect the final merged state rather than the mid-merge "5 PRs open" snapshot they originally
recorded.

## 6. What remains before a Phase 1E gate can be requested

- The 3 additional fixes (§4) exist as real commits on branch
  `fix-phase1e-security-review-policy-decisions` — validated fresh (§2), but **not yet pushed,
  not yet a PR, not yet merged to `main`.** That's a separate, explicit "push and open a PR" step,
  then its own separate merge authorization, same pattern as every other Phase 1E branch.
- Second-role human review of the code-review findings (§3, closed), the security-review findings
  (§4, now 8 fixed / 2 accepted as debt), and the 3 new fixes' own diffs — none of these has had
  one yet.
- `docs/project-state/phase-1e-approval-checklist.md` records the sign-off table itself —
  currently unsigned; recording the approved SHA there is a separate, explicit human step, not
  something this document does on its own.
