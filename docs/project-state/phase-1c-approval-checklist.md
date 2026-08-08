# Phase 1C Approval Checklist — Authentication and Session Management

**Status:** Approved 2026-08-07, scope Phase 1C only, **with one explicitly tracked open
condition** (see "Open condition" and "Sign-off" below) — signed by the human approver directly in
chat, not by the authoring agent, consistent with the separation-of-duties rule already applied to
every prior phase's checklist (ADR-0010, `knowledge/12-dashboard-security-controls.md`). This
checklist itself was authored and this gate recorded **after** PR #7 was already merged (2026-08-07)
and after Phase 1D (RBAC) was subsequently built, validated, and merged via PR #8 in the same
session — the approval is retroactive to the already-shipped code, not a precondition that blocked
either merge. See "A note on sequencing" below.

---

## Open condition — read before treating this gate as fully closed

`docs/security/threat-model-authentication-session-handling.md` (the required STRIDE pass for
"Authentication" and "Session handling", per `docs/security/threat-model-plan.md`'s procedure and
this task package's own §7/§8) is **still a self-review only, authored by the same agent that
built Phase 1C**. ADR-0010's separation-of-duties principle and the threat-model plan's own
procedure both require a second, human role to review it before the implementation is normally
considered ready for its G4 gate.

That second-role review **has not happened**. The human approver explicitly chose, when asked, to
approve this gate now anyway, with the review recorded as a still-outstanding action item — not to
wait for the review, and not to have the review silently marked complete. See "Sign-off" for the
exact decision recorded and `docs/project-state/setup-input-register.md` for this item being
tracked as a standing blocker going forward.

---

## Completion condition (task package §6-9, adapted from the Phase 1A/1B pattern)

- [x] **1. Google Workspace OIDC flow works.** Authorization Code + PKCE, built against the real
      `openid-client` v6 functional API, exercised end-to-end against an offline/mocked
      `Configuration` (no real Google OAuth client exists yet) — `test/auth.e2e-spec.ts`.
- [x] **2. Restricted emergency-administrator TOTP flow works, both steps.** Password step issues
      a short-lived pending session; TOTP step elevates it; wrong-password, wrong-TOTP, and
      malformed-code cases all independently verified — `docs/project-state/phase-1c-validation-report.md`
      §6.
- [x] **3. Session issuance/validation/revocation works.** Opaque, server-hashed tokens (never a
      JWT); pending→elevated round-trip; single and bulk revocation with a recorded reason —
      validation report §5/§6.
- [x] **4. Account lockout works, both scopes.** Per-identifier (`emergency_login`) and
      per-pending-session (`emergency_totp`) lockout independently verified, including that a
      _subsequently correct_ password is still rejected once locked — validation report §6.
- [x] **5. CSRF defenses verified.** OAuth `state`+PKCE for the SSO flow; `OriginCheckGuard` +
      `SameSite=Strict` for other state-changing endpoints, both proven to reject in the e2e suite.
- [x] **6. Required tests pass.** 115 unit tests (mocked) + 15 real-database integration/e2e tests
      — `docs/project-state/phase-1c-validation-report.md`.
- [x] **7. No unauthorized feature implementation exists.** No RBAC, no general audit-log
      subsystem, no user-management CRUD beyond the minimal identity table — see the
      forbidden-actions table below. (Phase 1D/RBAC was subsequently built and merged separately,
      under its own explicit authorization — see `docs/project-state/phase-1d-approval-checklist.md`
      status, not yet produced as of this document, and its own task package.)
- [x] **8. Documentation is updated.** This document, `phase-1c-validation-report.md`,
      `docs/security/threat-model-authentication-session-handling.md`, plus `HANDOFF.md`,
      `docs/traceability/phase-0-requirements-traceability.md` (REQ-005 updated),
      `docs/phase-plans/phase-1-foundation-plan.md` (Tasks 4/5 marked complete).
- [x] **9. A verified remote commit/merge SHA is recorded.** See "Commit record" below.
- [x] **10. The Phase 1C approval checklist is produced.** This document.
- [ ] **11. Required second-role human security review completed.** **Not done — the open
      condition above.** Explicitly left unchecked rather than marked complete; tracked as a
      standing follow-up action, not silently absorbed into this approval.

---

## Forbidden-actions check (task package §9, adapted) — verified, not assumed

| Forbidden action                                               | Status                                                                                                                                                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-service emergency-admin account creation                  | **Not done.** Only the operator-run CLI (`apps/dashboard-api/src/auth/scripts/provision-emergency-admin.ts`) can create one — no HTTP endpoint exists.                                             |
| JIT (just-in-time) user provisioning on SSO login              | **Not done.** Pre-provisioned-only, resolved this session — an unmatched Google account is rejected, never auto-creates a `users` row.                                                             |
| Implement RBAC/roles as part of this phase                     | **Not done as part of Phase 1C's own approval scope.** (RBAC was subsequently built as Phase 1D, a separate, explicitly authorized phase — not folded into this checklist's own completion claim.) |
| Wire a real Google OAuth client or test against a real account | **Not done.** All testing uses an offline/mocked `Configuration`; no real client ID/secret used anywhere in code or tests.                                                                         |
| Wire a real SMTP send for emergency-admin login alerts         | **Not done.** `LoggingEmergencyAdminLoginNotifier` logs only; the real-send implementation is deferred, documented as a known gap in the threat model's "Summary of accepted gaps".                |
| Provision the actual Supabase database                         | **Not done.** All testing used a local/CI disposable database.                                                                                                                                     |
| Add real credentials anywhere                                  | **Not done.** `pnpm scan:secrets` clean.                                                                                                                                                           |
| Merge automatically                                            | **Not done.** PR #7 was merged only after an explicit, separate "merge the PR" instruction from the human approver.                                                                                |

---

## A note on sequencing

This approval checklist is being produced and the gate recorded **after** three things already
happened in the same overall engagement, in this order: (1) Phase 1C was built, validated, and
merged via PR #7; (2) Phase 1D (RBAC) was built, validated, and merged via PR #8, under its own
separate explicit authorization ("Begin RBAC (Task 6)"), which itself depended on Phase 1C's code
existing but not on this formal gate being recorded; (3) the human approver then said "Phase 1C
approved" and, when asked to clarify scope given the still-pending second-role review, chose to
approve the gate now with that review recorded as an open item. This document formalizes that
decision — it does not retroactively imply the review happened, and it does not claim the gate was
satisfied at merge time.

## Reviewer's own checklist (for whoever eventually performs the still-outstanding second-role review)

- [ ] **Re-run the validation commands** in `docs/project-state/phase-1c-validation-report.md`
      yourself, including the e2e suite against your own disposable database.
- [ ] **Review `docs/security/threat-model-authentication-session-handling.md`** specifically for
      the STRIDE coverage itself — not just re-confirm the tests pass. Focus especially on the
      "Summary of accepted gaps" section and decide whether each is still acceptable.
- [ ] **Update that document's own "Review status" section** once your review is complete, and
      update this checklist's item 11 and "Open condition" section to reflect it.
- [ ] **Confirm no real Google OAuth client or real credential was used anywhere in the diff.**

## Commit record

| Commit                                                 | SHA       | Contents                                                                                                                |
| ------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Phase 1C authentication/session management             | `650a19d` | Google Workspace SSO, emergency-admin TOTP, session management — see `docs/project-state/phase-1c-validation-report.md` |
| Fix CI migration-name mismatch + integration-test gaps | `4eb3c6c` | Real bugs found via CI, fixed on the branch before merge                                                                |

Branch: `phase-1c-authentication-sessions`, pushed to `origin`.

Pull request: [WDS-Internal-DeveloperTeam/webdesk-growth-dashboard#7](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/7),
base `main` ← `phase-1c-authentication-sessions`. **Merged** — merge commit
`102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`, 2026-08-07, under explicit separate "merge the PR"
authorization.

---

## Sign-off

| Field                     | Value                                                                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved by               | WebDesk Solution                                                                                                                                                                                                                                      |
| Approval date             | 2026-08-07                                                                                                                                                                                                                                            |
| Exact approved commit SHA | `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9` (merge commit, PR #7)                                                                                                                                                                                      |
| Authorization scope       | Phase 1C only — RBAC (Task 6) was separately authorized and merged as Phase 1D (PR #8); the general audit-log subsystem (Task 7) and user-management CRUD (Task 8) remain separate, not-yet-granted authorizations                                    |
| Decision                  | **Approve now, with the second-role security review recorded as an outstanding, explicitly tracked open item** — asked directly in chat, and this was the option the approver chose over "review already happened" or "informal acknowledgement only" |

| Role                                   | Name             | Decision                                                                | Date       |
| -------------------------------------- | ---------------- | ----------------------------------------------------------------------- | ---------- |
| Reviewer (Tech Lead / Architect / DBA) | WebDesk Solution | ☑ Approved, gate passed — second-role security review still outstanding | 2026-08-07 |
| PM                                     | WebDesk Solution | ☑ Approved                                                              | 2026-08-07 |

**On approval:** the second-role human review of `docs/security/threat-model-authentication-session-handling.md`
remains an open follow-up action, tracked in `docs/project-state/setup-input-register.md` and
`CLAUDE.md`'s "Open client blockers" — not closed by this gate.
