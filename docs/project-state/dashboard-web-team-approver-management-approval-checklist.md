# dashboard-web Team Management + Approver Assignment UI — Approval Checklist

**Status:** Code review and security review complete, review packet published. **Awaiting the
required second-role human review** — not yet reviewed, gated, or merged.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision for
this slice can be requested.

| #   | Item                                            | Status                                                                                                                                                                                                                      |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UI built against the real backend contract      | ✅ Reuses already-built, already-reviewed backend endpoints (`GET/POST/DELETE /projects/:projectId/team`, `GET/POST /projects/:projectId/approvers`, `DELETE /authz/users/:userId/roles/:roleId`) — no backend code touched |
| 2   | Required tests pass                             | ✅ 128/128 `dashboard-web` unit tests (25 new across the build and the fix round), 15/15 Playwright e2e tests                                                                                                               |
| 3   | Full validation clean                           | ✅ typecheck, lint (`--max-warnings=0`), `next build`, and prettier formatting all clean                                                                                                                                    |
| 4   | Independent code review complete                | ✅ 8-angle finder pass (high effort) — 10 candidates, all 10 CONFIRMED, 9 fixed and re-validated, 1 recorded as accepted out-of-scope debt (needs new backend code, this branch is UI-only). See the review packet.         |
| 5   | Security review complete                        | ✅ `security-review` skill run separately — 0 findings above threshold; the backend (`OriginCheckGuard`, `PermissionGuard`) confirmed as the sole authoritative enforcement point. See the review packet.                   |
| 6   | Review packet produced for second-role reviewer | ✅ Published as a Claude artifact — code review + security review findings, fixes, and validation evidence, with a decision section                                                                                         |
| 7   | Documentation updated                           | ✅ `CLAUDE.md`, `docs/implementation/dashboard-web-team-approver-management.md`, this checklist                                                                                                                             |
| 8   | Exact branch/commit verified and recorded       | ✅ Branch `dashboard-web-team-approver-management`, off `main` at `2d79a77`, PR #34, latest commit `249faa80db5d947924bf431a01f36d6c6af7ec97`                                                                               |

## Forbidden-actions check

- No new backend code, no new mutation surface, no new RBAC grant — every endpoint this PR calls
  already existed and was already reviewed/gated under `module-projects-foundation` and
  `module-projects-backend-closeout`.
- The one accepted, unfixed finding (`getUsersByIds()` using N parallel requests instead of the
  backend's existing `findByIds()` batch method) was not silently left unaddressed — it was
  surfaced directly with its full reasoning and recorded as tracked, out-of-scope debt in both
  `CLAUDE.md` and the implementation doc, not glossed over.

## Required second-role human review — PENDING

- [ ] Code-review findings (9/10 fixed, 1 accepted as out-of-scope debt) — awaiting review.
- [ ] Security-review findings (0 above threshold) — awaiting review.

## Sign-off

**Not yet complete.** A gate decision (G4-team-approver-management or similar) and merge
authorization remain separate, not-yet-requested next steps, unchanged from this project's standing
discipline for every prior slice — each requires its own explicit request after this review is
recorded as complete.

| Field                         | Value                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | _pending_                                                                                                                                                |
| Review date                   | _pending_                                                                                                                                                |
| Decision                      | _pending_                                                                                                                                                |
| Scope reviewed                | Full code-review disposition (9/10 fixed, 1 accepted as out-of-scope debt) and full security-review disposition (clean), via the published review packet |
| Disputes raised               | _pending_                                                                                                                                                |
