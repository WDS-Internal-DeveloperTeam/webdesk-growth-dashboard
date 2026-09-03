# Fix: Decision and Activity Log `limit` cap — Approval Checklist

## Scope

A live production bug, reported directly by the user via screenshot: selecting the largest
(100-row) page size on `/decision-and-activity-log`, or applying a filter while it was already
selected, rendered the app's generic "Something went wrong" error screen.

Root cause and fix: see
`docs/implementation/module-decision-and-activity-log.md`'s "Incident — `limit` cap too low for
the largest page size" section. One-line fix — `decision-and-activity-log.dto.ts`'s `limit` schema
field raised from `.max(100)` to `.max(200)`, matching every one of the other ~45 list-query
schemas in this codebase, all of which already cap at 200 specifically to leave headroom for
`dashboard-web`'s "request `pageSize + 1` rows" next-page-detection pattern.

## Independent review (light tier)

A one-line schema-cap fix bringing an outlier module in line with every sibling module's own
identical, already-reviewed convention — no new endpoint, no new RBAC action, no new sink, no
behavior change beyond widening an arbitrary upper bound that was already an outlier. A direct
read-through pass confirmed:

- No other file in `decision-and-activity-log/` references the old `100` cap.
- The DTO spec's replacement tests correctly prove both sides of the real boundary (101 now
  succeeds, 201 still rejected) — the cap itself stays real and enforced, not removed.
- The service/controller/repository require no change — `AuditEventRepository.list()`'s own
  `limit` parameter is already a plain number with no independent bound.

**0 findings.** No separate security review — raising an arbitrary pagination ceiling from 100 to
200 (still identical to every sibling module) introduces no new exposure.

## Validation

- 9/9 `decision-and-activity-log.dto.spec.ts` unit tests (2 new/updated), 4/4 service unit tests.
- 7/7 `decision-and-activity-log.e2e-spec.ts` e2e tests, 832/832 `dashboard-api` e2e/integration
  tests overall (no regression) — real disposable local PostgreSQL 17 database.
- Typecheck, `eslint --max-warnings=0`, `prettier --check` all clean.

## Sign-off

Required second-role human review, per ADR-0010: light tier — this checklist's own findings
summary (0 findings) serves as the review artifact, given directly in response to the user's own
live bug report on the just-shipped feature.

Gate `G4-fix-decision-and-activity-log-limit-cap`: **CONFIRM** — WebDesk Solution, 2026-09-03,
approved commit (recorded at push time) on branch `fix-decision-and-activity-log-limit-cap`.
