# Phase 1F Approval Checklist — Application Shell, Module Registry, Observability & Staging Foundation

**Status:** Not yet gated. Written once all Phase 1F work was built and fully validated, following
the same pattern as `docs/project-state/phase-1e-approval-checklist.md`.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a Phase 1F gate
can be requested.

| #   | Item                                         | Status                                                                                                                                                                    |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Canonical 43-module registry extended        | ✅ Migrations `00034`/`00035`, real data sourced from the approved specs — see `docs/implementation/phase-1f-module-registry.md`                                          |
| 2   | Registry + permission-mapping validation     | ✅ `pnpm --filter @webdesk/database validate:module-registry` passes; wired into CI                                                                                       |
| 3   | Registry-driven, permission-aware navigation | ✅ `GET /me/navigation`, real seeded-data e2e proof (super_admin: 43, read_only: 36) — `docs/implementation/phase-1f-navigation-authorization.md`                         |
| 4   | Application shell built                      | ✅ `docs/implementation/phase-1f-application-shell.md` — authenticated frame, session gate, real Home page                                                                |
| 5   | Shared page-shell + UI-state components      | ✅ `docs/implementation/phase-1f-ui-foundation.md` — 5 page-shell + 9 state components                                                                                    |
| 6   | Isolated design-system token foundation      | ✅ 12 token groups, no WordPress dependency — `phase-1f-ui-foundation.md` §1                                                                                              |
| 7   | Accessibility — automated (Axe)              | ✅ 3 real Playwright+axe-core tests, zero violations, on every page reachable without a session                                                                           |
| 8   | Accessibility — manual verification          | ✅ Existing shell/UI patterns spot-checked (skip link, `aria-current`, `aria-expanded`, focus-visible, `role="status"`/`role="alert"`) — `phase-1f-ui-foundation.md` §2-3 |
| 9   | Responsive behavior                          | ✅ Breakpoint tokens for desktop/laptop/tablet/mobile; shell CSS uses them (`app-shell.module.css`)                                                                       |
| 10  | Observability — logging redaction            | ✅ Extended `DEFAULT_REDACT_PATHS` against real field names — `phase-1f-observability.md` §2                                                                              |
| 11  | Observability — build/release metadata       | ✅ `getBuildMetadata()`, wired into `/health`/`/ready` and the request logger — `phase-1f-observability.md` §3                                                            |
| 12  | Observability — Sentry                       | ✅ Mechanism built and tested; deliberately inert (no real `SENTRY_DSN`) — `phase-1f-observability.md` §4                                                                 |
| 13  | Observability — correlation IDs              | ✅ Confirmed already satisfied (Phase 1A middleware), not rebuilt — `phase-1f-observability.md` §1                                                                        |
| 14  | CI foundation completion                     | ✅ Module-registry validation + accessibility checks wired into existing CI jobs; no deploy job added                                                                     |
| 15  | Staging environment foundation               | ✅ Documented at the provisioning boundary — `phase-1f-staging-foundation.md`; no resource provisioned                                                                    |
| 16  | Module implementation roadmap                | ✅ `docs/phase-plans/module-implementation-roadmap.md` — real waves computed from registry dependency data                                                                |
| 17  | Module task-package template                 | ✅ `docs/task-packages/templates/module-implementation-task-template.md`                                                                                                  |
| 18  | Required migrations pass                     | ✅ Fresh disposable database, all 35 migrations, clean up/down round trip — validation report §2                                                                          |
| 19  | Required tests pass                          | ✅ 294 unit (`dashboard-api`) + 108 database integration + 79 e2e + 9 Playwright, all passing — validation report §2                                                      |
| 20  | Code review is complete                      | ✅ 8-angle, high-effort independent review; 9/14 findings fixed, 5 tracked as debt with reasoning — validation report §3                                                  |
| 21  | Security review is complete                  | ✅ `docs/implementation/phase-1f-security-review.md` — no Critical/High finding; one precondition flagged (Sentry scrubbing, before any real DSN)                         |
| 22  | Documentation and traceability updated       | ✅ `docs/traceability/phase-0-requirements-traceability.md`, `outputs/webdesk-growth-dashboard/HANDOFF.md`, `docs/phase-plans/phase-1-foundation-plan.md`                 |
| 23  | Phase 1F validation report is complete       | ✅ `docs/project-state/phase-1f-validation-report.md`                                                                                                                     |
| 24  | Phase 1F approval checklist is produced      | ✅ This document                                                                                                                                                          |
| 25  | Exact branch/commit is verified and recorded | ✅ Branch `phase-1f-application-shell`, off `main` at `dc94d9111fc7321ed2a717925676cdf5044a5227` (the G4-1E approved commit) — see validation report §1                   |

## Forbidden-actions check

- No business functionality for any of the 43 modules was built —
  `module_registry.implementation_status = 'not_started'` for all 43, verified directly against
  the live migrated registry, not assumed.
- No new zero-seeded authorization action or permission grant was added — `GET /me` and
  `GET /me/navigation` both gate on `SessionGuard` only (any authenticated user may see their own
  identity/navigation), no new `PermissionGuard`-checked action exists.
- No production deploy, no CI deploy job added — `.github/workflows/ci.yml`'s own top comment still
  states "NO deploy job exists," unchanged this phase.
- No Vercel/Neon/Sentry resource was provisioned — the staging-foundation and observability
  documents both record real gaps rather than inventing infrastructure (`docs/implementation/
phase-1f-staging-foundation.md` §5, `phase-1f-observability.md` §5).
- No Wave 1 / module-implementation work was started — the roadmap and template are planning
  artifacts only, per their own "Status" lines.

## Required second-role human review — ASSIGNED, NOT YET COMPLETE

Reviewers assigned 2026-08-14 (WebDesk Solution) — Jitesh D and Brijesh D, same reviewers as both
Phase 1D reviews and Phase 1E's review. This is an assignment only, not a completed review — see
`outputs/webdesk-growth-dashboard/project.json`'s `audit_log` for the recorded assignment.

- [ ] Independent code-review findings (validation report §3) and their disposition (9 fixed / 5
      tracked as debt) — reviewer: **Jitesh D and Brijesh D**.
- [ ] `docs/implementation/phase-1f-security-review.md`'s findings and disposition, including the
      Sentry-scrubbing precondition — reviewer: **Jitesh D and Brijesh D**.

## Reviewer's own checklist (for whoever performs the second-role review)

- [ ] Read `docs/project-state/phase-1f-validation-report.md` in full, including §3.
- [ ] Read `docs/implementation/phase-1f-security-review.md` in full.
- [ ] Spot-check that the 9 "fixed" code-review findings are genuinely fixed — each is tied to the
      "Fix findings from independent code review of Phase 1F" commit, not just narrated.
- [ ] Confirm the 5 items accepted as tracked technical debt are acceptable as-is, or dispute any.
- [ ] Confirm the Sentry `beforeSend` scrubbing precondition is understood as a **blocker for
      setting a real `SENTRY_DSN`**, not an optional nice-to-have.
- [ ] Record your decision, then add a "Sign-off" section below, following the exact format
      `docs/project-state/phase-1e-approval-checklist.md`'s own "Sign-off" section uses.

## Sign-off

_Not yet completed — awaiting the required second-role human review above._
