# /auth/exchange Error-Masking Fix — Approval Checklist

**Status:** Required second-role human review complete (2026-08-19, Jitesh D, **Approved as-is** —
accepting all 5 open code-review findings as tracked debt rather than requesting fixes before
merge). **The gate (G4-error-masking-fix) is approved** — WebDesk Solution, decision CONFIRM,
2026-08-19. Merge authorization remains a separate, not-yet-requested next step.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision for
this slice can be requested.

| #   | Item                                            | Status                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Root cause diagnosed against real evidence      | ✅ Diagnosed directly from live Vercel runtime logs (`dashboard-api`) — a login raced migration `00046`, producing a Postgres `42P01` (`undefined_table`) error, mislabeled `reason=expired` by the pre-existing code. See `docs/implementation/session-exchange.md` §7. |
| 2   | Fix implemented under explicit authorization    | ✅ User asked directly to "fix the /auth/exchange error masking" after the incident diagnosis surfaced the gap.                                                                                                                                                          |
| 3   | Required tests pass                             | ✅ 370/370 `dashboard-api` unit tests, 111/111 `dashboard-api` e2e tests (real disposable local Postgres), 143/143 `dashboard-web` unit tests, all passing.                                                                                                              |
| 4   | Full validation clean                           | ✅ typecheck, lint (`--max-warnings=0`), `next build`, `nest build`, and `pnpm exec prettier --check` all clean across `apps/dashboard-api` and `apps/dashboard-web`.                                                                                                    |
| 5   | Independent code review complete                | ✅ High effort, 8 finder angles, 7 candidates verified individually (1 CONFIRMED, 5 PLAUSIBLE, 1 REFUTED and dropped). The CONFIRMED finding fixed and re-validated; the 5 PLAUSIBLE findings left open for the second-role reviewer's decision.                         |
| 6   | Security review complete                        | ✅ `security-review` skill run separately — 0 findings above threshold. Confirmed diagnostics-only: no attacker-controlled value flows into the redirect target or the rendered message.                                                                                 |
| 7   | Review packet produced for second-role reviewer | ✅ Published as a Claude artifact — code review + security review findings, fixes, and validation evidence, with an explicit decision section listing the 5 open items.                                                                                                  |
| 8   | Documentation updated                           | ✅ `CLAUDE.md`, `docs/implementation/session-exchange.md` (§7), this checklist.                                                                                                                                                                                          |
| 9   | Exact branch/commit verified and recorded       | ✅ Branch `fix-auth-exchange-error-masking`, off `main` at `f9bb065`, PR #36, approved commit `f5ecff6`.                                                                                                                                                                 |

## Forbidden-actions check

- No change to `dashboard-api`'s own session cookie, `SameSite`, `OriginCheckGuard`, or any
  auth/session control flow — diagnostics-only change (which message is shown, what gets logged),
  confirmed by both the code review and the security review.
- The 5 open PLAUSIBLE findings were not silently left unaddressed — each was surfaced directly
  with its full reasoning in the review packet, presented to the second-role reviewer with an
  explicit decision to make, and is recorded below as accepted debt.
- No production deployment or merge has occurred — both remain separate, not-yet-requested next
  steps.

## Required second-role human review — COMPLETE

- [x] Code-review findings (1/6 fixed, 5 accepted as tracked debt) — reviewed by: **Jitesh D**,
      2026-08-19, **Approved as-is**.
- [x] Security-review findings (0 above threshold) — reviewed by: **Jitesh D**, 2026-08-19,
      **Approved as-is**.

## Accepted, tracked debt (all 5 open code-review findings)

1. `AuthErrorReason` taxonomy duplicated as raw strings across `dashboard-api` and `dashboard-web`,
   no shared type in `packages/shared-types` (`apps/dashboard-web/app/auth/exchange/route.ts:32`).
2. The missing/unparseable OIDC transaction cookie branch still masks non-expiry failures as
   `reason=expired` with zero logging
   (`apps/dashboard-api/src/auth/google/google-auth.controller.ts:55`).
3. Unguarded `body.data` destructure could crash instead of showing the new error page, on a
   future API-contract drift between the two apps (`apps/dashboard-web/app/auth/exchange/route.ts:113`).
4. The `reason=error` bucket still collapses five distinct failure classes into one generic message
   (`apps/dashboard-web/app/auth/error/page.tsx:15`).
5. Undocumented assumption that a backend `400` always means "expired," currently unreachable given
   the minimal exchange-code schema (`apps/dashboard-web/app/auth/exchange/route.ts:93`).

## Sign-off

**Second-role human review: complete. Gate G4-error-masking-fix: approved.** Both were their own
separate, explicit human step, per every prior phase's own pattern of keeping the review and the
gate decision distinct — the gate was requested, and approved, only after the review above was
already recorded as complete. Merge authorization remains a separate, not-yet-requested next step.

| Field                         | Value                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | Jitesh D                                                                                                                                                |
| Review date                   | 2026-08-19                                                                                                                                              |
| Decision                      | Approved as-is                                                                                                                                          |
| Scope reviewed                | Full code-review disposition (1/6 fixed, 5 accepted as tracked debt) and full security-review disposition (0 findings), via the published review packet |
| Open items accepted as-is     | See "Accepted, tracked debt" above (5 items)                                                                                                            |
| Disputes raised               | None recorded                                                                                                                                           |

| Field                    | Value                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate                     | G4-error-masking-fix                                                                                                                                                         |
| Approver (gate decision) | WebDesk Solution                                                                                                                                                             |
| Gate date                | 2026-08-19                                                                                                                                                                   |
| Decision                 | CONFIRM (clean pass, not an override — the second-role review was already complete before the gate was requested)                                                            |
| Approved commit          | `f5ecff611261183e6ae9e03ee4edd6fd5ff3a34e` on branch `fix-auth-exchange-error-masking` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` for the full record |
| Scope                    | `fix-auth-exchange-error-masking` (PR #36) only. Merge authorization is a separate, not-yet-requested next step.                                                             |

| Role                          | Name             | Decision         | Date       |
| ----------------------------- | ---------------- | ---------------- | ---------- |
| Reviewer (second-role review) | Jitesh D         | ☑ Approved as-is | 2026-08-19 |
| Approver (gate decision)      | WebDesk Solution | ☑ CONFIRM        | 2026-08-19 |
