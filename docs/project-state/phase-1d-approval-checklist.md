# Phase 1D (Expanded) Approval Checklist — RBAC, Permissions & Separation of Duties

**Status:** NOT approved. Implementation complete and validated by this document's author; PR #9
merged to `main` (merge commit `67a4955`, 2026-08-08) under explicit authorization at each step,
including the merge itself; CI green on every real check both before and after a rebase onto PR
#10's dependency-upgrade work. **No gate has been requested or recorded yet** — merging is a
separate action from gate approval, same as PR #8. This document exists so the completion state is
honestly recorded as work finishes, not backfilled after approval — consistent with how every
prior phase's checklist in this project was produced.

Scope: `docs/task-packages/phase-1d-rbac-permissions-expanded.md` (the expanded brief), built on
top of the already-merged, already-approved-pending PR #8 narrower Phase 1D. This checklist covers
the expansion only — PR #8's own scope is covered by
`docs/project-state/phase-1d-validation-report.md`'s original (pre-addendum) sections.

---

## Completion condition (task package §30 "Acceptance criteria")

- [x] **1. All seven approved roles are represented.** Seeded in migration `00013` (unchanged by
      this expansion); representative grant checks exercised for Super Admin, Owner/Growth
      Approver, Marketing Editor, and Read-Only across unit, integration, and e2e suites — see
      `docs/implementation/phase-1d-role-permission-matrix.md` for the full 7-role matrix.
- [x] **2. Deny-by-default authorization works.** `AuthorizationService.evaluate()` denies on
      unknown user, disabled user, unknown module, no roles, or no grant — every path independently
      unit-tested (`authorization.service.spec.ts`) and proven against real seeded data
      (`phase1d-authz.integration.test.ts`, `authz.e2e-spec.ts`).
- [x] **3. Server-side permission enforcement works.** `PermissionGuard` is the sole enforcement
      point; no frontend-only check exists anywhere in this phase (no frontend exists yet).
- [x] **4. Project-scoped authorization works where required.** Database/repository layer proven
      against a real database (`phase1d-authz.integration.test.ts`'s project-scoping suite); **no
      HTTP route exercises it yet** — honestly not a complete end-to-end proof, see
      `docs/implementation/phase-1d-rbac-architecture.md §3` and
      `docs/implementation/phase-1d-security-review.md`'s accepted-item #3.
- [x] **5. Confidential-field access is independently enforced.** `view_confidential`/
      `edit_confidential` actions real and checked; zero rows seeded for any role (deny-by-default
      preserved) — see `docs/implementation/phase-1d-confidential-field-authorization.md`.
- [x] **6. Separation-of-duties policies work.** Self-role-assignment blocked
      (`assertDistinctActors`); cross-request foundation built (`assertNoPriorConflictingAction`)
      though not yet called by any business workflow (none exists yet) — see
      `docs/implementation/phase-1d-separation-of-duties.md`.
- [x] **7. Privilege escalation protections work.** Self-role-assignment, unauthorized privileged-role
      assignment (owner_growth_approver denial), and object-ID substitution (IDOR — every route
      requires the same module-level grant regardless of target id) all tested — see
      `docs/implementation/phase-1d-security-review.md`'s STRIDE table.
- [x] **8. Role and permission changes take effect safely.** Session revocation on every role
      change (pre-existing, PR #8) plus no-caching-layer per-request resolution (this expansion) —
      see `docs/implementation/phase-1d-rbac-architecture.md §§6–7`.
- [x] **9. Emergency administrator authentication remains separate from authorization.** Unchanged
      from Phase 1C — this expansion adds no coupling between the two.
- [x] **10. Authorization event interfaces work.** `separation_of_duties_denied` now actually
      emitted (previously declared but unused); `role_assigned`/`role_revoked`/
      `privileged_access_denied`/`super_admin_bootstrap` continue to be emitted from PR #8.
      `permission_granted`/`permission_revoked`/`confidential_field_accessed`/
      `authorization_configuration_changed` remain declared-but-unemitted — no real endpoint
      exists yet to emit them from (no grant-editing UI, no confidential business field, no
      configuration-change endpoint) — see `docs/implementation/phase-1d-rbac-architecture.md §6-7`
      note and task package §22.
- [x] **11. No business modules beyond required authorization foundations are implemented.**
      Verified against `docs/implementation/phase-1d-file-inventory.md §10` ("Not touched").
- [x] **12. No full immutable audit subsystem is created.** `authorization_actions` is a narrow,
      purpose-built table for the SoD cross-request check, not a general audit log (Task 7 remains
      untouched).
- [x] **13. Tests pass.** 144 unit + 41 real-database integration + 37 real-database e2e, all
      green — see the validation report addendum for the exact run.
- [ ] **14. Security review passes.** `docs/implementation/phase-1d-security-review.md` is a
      complete self-review; the required second-role human review (ADR-0010) has **not** happened.
      Neither has the still-outstanding second-role review of the original
      `docs/security/threat-model-authorization-rbac.md` (PR #8's own pass).
- [x] **15. Documentation is updated.** All 9 documents from task package §29 exist (this one plus
      the 8 listed in `docs/implementation/phase-1d-file-inventory.md §9`); `HANDOFF.md`,
      traceability, phase plan, and setup-input-register updates are tracked separately (task #138
      in this session's own tracking) — confirm they are complete before treating this item as done
      if reading this checklist out of order.
- [x] **16. Exact remote commit SHA is recorded.** `9973b70` (implementation), merge commit
      `67a4955` — PR #9 merged to `main`. See "Commit record" below.

---

## Forbidden-actions check (task package §33) — verified, not assumed

| Forbidden action                                                   | Status                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Modify the base Node.js skill                                      | **Not done.**                                                                                                  |
| Change approved authentication architecture                        | **Not done.** Phase 1C's `AuthModule` is untouched except a new provider registration for a shared dependency. |
| Grant permissions based solely on email domain                     | **Not done.**                                                                                                  |
| Automatically make Workspace users administrators                  | **Not done.**                                                                                                  |
| Automatically make emergency users Super Admin                     | **Not done.**                                                                                                  |
| Create allow-by-default fallbacks                                  | **Not done.** Deny-by-default preserved and extended (confidential fields, project scoping).                   |
| Enforce permissions only in frontend code                          | **Not done.** No frontend exists yet; all enforcement is server-side.                                          |
| Send confidential fields to unauthorized clients                   | **Not done.** No business entity with confidential fields exists to send.                                      |
| Allow self-assignment of privileged roles                          | **Not done — actively blocked**, the primary new control this expansion adds.                                  |
| Allow controlled work to self-approve where separation is required | **Not done.** `assertDistinctActors` blocks the one real case that exists (role self-assignment).              |
| Bypass authorization for Super Admin unless explicitly permitted   | **Not done.** Super Admin is subject to the same `PermissionGuard`/deny-by-default path as every other role.   |
| Introduce a third-party authorization platform without approval    | **Not done.**                                                                                                  |
| Begin Phase 1E automatically                                       | **Not done.**                                                                                                  |
| Deploy production                                                  | **Not done.**                                                                                                  |

---

## Required second-role human reviews (both still outstanding)

| Document                                                                  | Author (self-review) | Second-role reviewer | Status          |
| ------------------------------------------------------------------------- | -------------------- | -------------------- | --------------- |
| `docs/security/threat-model-authorization-rbac.md` (PR #8's own pass)     | Implementing agent   | Not yet assigned     | **Outstanding** |
| `docs/implementation/phase-1d-security-review.md` (this expansion's pass) | Implementing agent   | Not yet assigned     | **Outstanding** |

Per `CLAUDE.md`'s "Open client blockers", `project.json`'s `assigned_team` is entirely `TBD` — no
specific human has been assigned either review yet.

## Reviewer's own checklist (for whoever eventually performs the still-outstanding reviews)

- [ ] **Re-run the validation commands** yourself: `pnpm --filter @webdesk/dashboard-api test`,
      `pnpm --filter @webdesk/database test:integration` and
      `pnpm --filter @webdesk/dashboard-api test:integration` (both against your own disposable
      database — see `packages/database/README.md`), `pnpm lint`, `pnpm typecheck`.
- [ ] **Review both threat-model documents** for the STRIDE coverage itself, not just re-confirm
      tests pass — focus especially on each document's own "Summary of accepted gaps"/"accepted
      residual items" and decide whether each is still acceptable.
- [ ] **Specifically verify the module-registry-to-permission-group mapping** (migration `00015`),
      flagged in that migration's own doc comment and
      `docs/implementation/phase-1d-permission-catalog.md §3` as this implementer's own reasoned
      cross-reference, not verbatim from a single approved source.
- [ ] **Confirm no real Google OAuth client, real Supabase provisioning, or real credential was
      used anywhere in the diff.**
- [ ] **Update this checklist's items 14/16 and "Sign-off"** once your review and the git workflow
      (push/PR) are both complete.

## Commit record

| Commit                                                                                   | SHA       | Contents                                                        |
| ---------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------- |
| Phase 1D (expanded): centralized authorization, project scoping, ...                     | `9973b70` | The full expansion — see this checklist's own scope note above. |
| Fix stale HANDOFF.md header claiming Phase 1D-expanded work was unpushed                 | `77e932f` | Docs-accuracy fix.                                              |
| Merge pull request #9 from WDS-Internal-DeveloperTeam/phase-1d-rbac-permissions-expanded | `67a4955` | Merge commit — PR #9 merged to `main`.                          |

Branch: `phase-1d-rbac-permissions-expanded`, pushed to `origin` under explicit "push and open PR
now" authorization; later rebased onto the post-PR-#10 `main` (no conflicts) and force-pushed
under explicit "rebase PR #9 onto main and re-run CI" authorization.

Pull request: [WDS-Internal-DeveloperTeam/webdesk-growth-dashboard#9](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/9),
base `main` ← `phase-1d-rbac-permissions-expanded`. **Merged** (merge commit `67a4955`,
2026-08-08), under explicit "merge PR #9" authorization — the first merge attempt was blocked by
the session's own permission classifier, so the user merged it directly on GitHub. CI green on
every real check both before and after the rebase (lint, typecheck, build, unit tests, integration
tests, database migration test, formatting, workspace-boundary check, secret-pattern scan,
**and** "Dependency vulnerability audit" — PR #10's dependency upgrades, merged first, brought
`pnpm audit` to 0 findings, so this check passed cleanly rather than showing the usual pre-existing
finding).

---

## Sign-off

**Not signed.** PR #9 is merged, but no gate has been requested from the human approver for this
expanded scope yet — merging and gate approval are separate, independently-authorized actions in
this project's standing discipline (see PR #8's own history for the same pattern). This section
will be completed once: (1) both required second-role security reviews are either completed or the
approver makes an explicit override decision (as was done for Phase 1C's G4-1C gate), and (2) the
approver is asked directly for a decision on this gate — consistent with how every prior gate in
this project was recorded only
after an explicit approval instruction, never assumed from implementation completion alone.
