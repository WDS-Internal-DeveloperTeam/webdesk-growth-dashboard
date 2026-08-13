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

Run against a single fresh disposable PostgreSQL 17 database, all 33 migrations applied in one
pass, immediately before this document was finalized:

- **Typecheck / Lint:** clean, 14/14 turbo tasks.
- **Unit tests (`dashboard-api`):** 266/266 passing (34 test files).
- **Database integration tests (`packages/database`, real disposable Postgres):** 108/108 passing
  (10 test files).
- **`dashboard-api` e2e tests (real disposable Postgres):** 72/72 passing (10 test files).
- **Migration round trip:** clean up/down/up on all 33 migrations, including the immutability
  trigger's own regression test.
- **`pnpm audit`:** 0 vulnerabilities specific to this work. (A separate, pre-existing high-severity
  `nanoid` advisory — `GHSA-2v37-7h3g-55p8`, dev-tooling only via `@nestjs/cli`/webpack/vitest's
  postcss chain — surfaced on `main` independent of any Phase 1E change; not part of this scope,
  flagged separately.)
- **Secret-pattern scan:** clean, 481 tracked files.

CI on each of the 7 merged PRs (#14, #20, #21, #16, #15, #17, #18) was independently confirmed
green (13/14 checks; the 14th being the same pre-existing `nanoid` finding) immediately before
each merge.

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
covering all six slices. Ten numbered gaps originally surfaced; disposition:

**Fixed (5 — the non-policy gaps, each closed with its own commit and re-validated):**

- `JobService.create()` had zero audit-trail coverage — fixed (commit `e6306a8`).
- `NotificationService`'s five mutating methods had zero audit-trail coverage — fixed (commit
  `1c9e822`).
- `SystemHealthService.recordCheck()`'s audit emission was conditional on `checkedByUserId` being
  truthy — made unconditional (commit `eb4b916`).
- `OperationalContactRepository.list()`/`findActiveForArea()` had no pagination cap — fixed
  (commit `8db3bd7`).
- `RetentionHoldRepository.listAll()` had no pagination cap — fixed (commit `79a265e`).

**Still open — genuine policy questions, deliberately left for human decision** (per this
project's standing pattern of surfacing rather than silently resolving; explicitly scoped this
way by the user rather than fixed unilaterally):

1. `POST /retention/holds`'s `approvedByUserId` is client-attributable with no verification a
   named user actually approved anything (Spoofing).
2. `POST /notifications` accepts `recipientUserId`/`recipientContactId`/`projectId` with no
   existence/ownership check (Tampering).
3. `GET /jobs`/`GET /notifications` accept an unchecked `projectId` query filter with no
   route-level project scoping — latent (zero project-scoped grants exist today), same class of
   issue as the already-tracked Phase 1D `Op.in` finding (Elevation of Privilege).
4. `operational_contacts` PII (name/email/phone) has no confidential-field gating comparable to
   the Phase 1D-expanded `view_confidential`/`edit_confidential` precedent (Information
   Disclosure).
5. `JobRetryService.manualRetry()` doesn't respect `maxAttempts` — a policy question (manual
   override vs. automatic cap), not a straightforward bug (Denial of Service).

## 5. Documentation and traceability

`docs/implementation/requirements-traceability-matrix.md`, `outputs/webdesk-growth-dashboard/HANDOFF.md`,
and `docs/phase-plans/phase-1-foundation-plan.md` all carry a dated Phase 1E addendum, now updated
to reflect the final merged state rather than the mid-merge "5 PRs open" snapshot they originally
recorded.

## 6. What remains before a Phase 1E gate can be requested

- Second-role human review of both the code-review findings (§3, now closed) and
  `docs/security/threat-model-phase-1e-operational-infrastructure.md`'s 5 still-open policy
  questions (§4) — neither has had one yet.
- A human decision on each of the 5 open policy questions in §4: fix, accept as tracked debt, or
  dispute.
- `docs/project-state/phase-1e-approval-checklist.md` records the sign-off table itself —
  currently unsigned; recording the approved SHA there is a separate, explicit human step, not
  something this document does on its own.
