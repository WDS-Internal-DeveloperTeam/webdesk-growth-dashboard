# dashboard-web Project Status Change / Archive Actions — Approval Checklist

**Status:** Required second-role human review complete (2026-08-17, Jitesh D, **Approved**). A gate
decision and merge authorization remain separate, not-yet-requested next steps. See "Sign-off"
below.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision for
this slice can be requested.

| #   | Item                                            | Status                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UI built against the real backend contract      | ✅ Mirrors `apps/dashboard-api/src/projects/project.service.ts`'s `ALLOWED_TRANSITIONS` state machine by hand — only the transitions actually valid from the project's current status are ever rendered                                      |
| 2   | Required tests pass                             | ✅ 68/68 `dashboard-web` unit tests (11 new across the build and the fix round), 13/13 e2e tests (unchanged — no new route)                                                                                                                  |
| 3   | Full validation clean                           | ✅ typecheck, lint (`--max-warnings=0`), `next build`, and prettier formatting all clean                                                                                                                                                     |
| 4   | Independent code review complete                | ✅ 8-angle finder pass (medium effort) — 9 candidates, 8 verified real (1 REFUTED), 7 fixed and re-validated, 1 recorded as accepted tracked debt with reasoning. See the review packet.                                                     |
| 5   | Security review complete                        | ✅ `security-review` skill run separately — 0 findings above threshold; the backend (`OriginCheckGuard`, `PermissionGuard`, server-side transition validation) confirmed as the sole authoritative enforcement point. See the review packet. |
| 6   | Review packet produced for second-role reviewer | ✅ Published as a Claude artifact — code review + security review findings, fixes, and validation evidence, with a decision section                                                                                                          |
| 7   | Documentation updated                           | ✅ `CLAUDE.md`, `docs/implementation/dashboard-web-project-status-actions.md`, `docs/implementation/dashboard-web-project-detail.md` (addendum), this checklist                                                                              |
| 8   | Exact branch/commit verified and recorded       | ✅ Branch `dashboard-web-project-status-actions`, off `main` at `b889982`, PR #29, latest commit `98d6b2a7817e912c7f3a8fc46a78dab06dae21b0`                                                                                                  |

## Forbidden-actions check

- No change to the backend's own state machine or transition validation — `project.service.ts`'s
  `ALLOWED_TRANSITIONS` remains the single authoritative source; this UI only mirrors it.
- No new mutation surface beyond the already-reviewed, already-gated `POST /projects/:projectId/status`
  endpoint — no new route, no new permission, no new guard.
- The one accepted, unfixed finding (`router.refresh()` re-fetching the whole route) was not
  silently left unaddressed — it was surfaced directly with its full reasoning and recorded as
  tracked debt in both `CLAUDE.md` and the implementation doc, not glossed over.

## Required second-role human review — COMPLETE

- [x] Code-review findings (7/8 fixed, 1 accepted as tracked debt) — reviewed by: **Jitesh D**,
      2026-08-17, **Approved**.
- [x] Security-review findings (0 above threshold) — reviewed by: **Jitesh D**, 2026-08-17,
      **Approved**.

## Sign-off

| Field                         | Value                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | Jitesh D                                                                                                                                           |
| Review date                   | 2026-08-17                                                                                                                                         |
| Decision                      | Approved                                                                                                                                           |
| Scope reviewed                | Full code-review disposition (7/8 fixed, 1 accepted as tracked debt) and full security-review disposition (clean), via the published review packet |
| Disputes raised               | None recorded                                                                                                                                      |

A gate decision (per this project's own naming convention, likely `G4-project-status-actions`) and
merge authorization are each their own separate, not-yet-requested next steps, unchanged from this
project's standing discipline for every prior slice.
