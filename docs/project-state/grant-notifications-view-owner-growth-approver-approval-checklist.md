# Grant `notifications_view` to `owner_growth_approver` — Approval Checklist

**Status:** Built, fully validated. Reviewed (security-focused, RBAC change) — 0 findings.
Required second-role human review complete. Gate
`G4-grant-notifications-view-owner-growth-approver` approved (WebDesk Solution, CONFIRM). Branch
pushed to `origin`. Not yet opened as a PR, merged, or run against production.

## Completion condition

| #   | Item                                       | Status                                                                                                                                                                         |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build                     | ✅ Explicit "start whatever missing in the notification center" → `AskUserQuestion`: "Widen notifications_view RBAC grant"                                                     |
| 2   | Genuine scoping confirmed                  | ✅ `AskUserQuestion`: `owner_growth_approver` (already holds nearly every other `system_settings` action); `notifications_configure` and every other role stay zero-seeded     |
| 3   | Required tests pass                        | ✅ A real migration up → down → up round-trip against a fresh local disposable PostgreSQL 17 database (`webdesk_notif_test`), confirming exactly two roles hold the grant      |
| 4   | Full validation clean                      | ✅ typecheck clean; `prettier --check` clean                                                                                                                                   |
| 5   | Independent review complete                | ✅ Direct security-focused read-through (RBAC change — this project's standing rule reserves the full tier for these by default) — 0 findings                                  |
| 6   | Security review                            | ✅ Folded into item 5 above — no application/enforcement code changed, purely additive seed data through the existing, unmodified `PermissionGuard`/`@RequirePermission`       |
| 7   | Known out-of-scope gaps flagged, not fixed | `notifications_configure` and every other role remain zero-seeded — explicitly declined for this request; a dedicated RBAC group and real SMTP delivery both remain unbuilt    |
| 8   | Live-rendered / verified                   | N/A — a pure database-seed change, not a UI/route change; verified only against a local disposable database, per item 3                                                        |
| 9   | Documentation updated                      | ✅ `docs/implementation/grant-notifications-view-permission.md` (Slice 2)                                                                                                      |
| 10  | Exact branch/commit verified               | Branch `grant-notifications-view-owner-growth-approver`, off `origin/main` at `35e612e`, commits `75ee2c2` (migration + docs) and `4f63c76` (gate record) — pushed to `origin` |

## Forbidden-actions check

- No new backend endpoint, no application/enforcement code change — the migration only inserts
  one additive `role_permissions` row.
- No new npm dependency.
- No broader RBAC change — only `owner_growth_approver`'s grants are touched, and only by one row.
- The real production database was never touched by this session — validated against a local
  disposable database only; running the real migration against production remains the user's own
  action, per this project's standing credential-handling discipline.

## Review — summary

See `docs/implementation/grant-notifications-view-permission.md`'s "Slice 2" Review section for
the full account. **0 findings.**

## Sign-off

**Required second-role human review:** Complete — via the direct "Approve as-is, gate it, and push
the branch" instruction. The findings above served as the review artifact; there were no open
findings of any kind on this branch to accept as tracked debt.

**Gate:** `G4-grant-notifications-view-owner-growth-approver` approved — WebDesk Solution, decision
CONFIRM (clean pass, not an override), approved commit `75ee2c2` on branch
`grant-notifications-view-owner-growth-approver`. See
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-grant-notifications-view-owner-growth-approver`).

**Push/PR/merge:** Pushed to `origin` under the same combined instruction. **A real
working-directory collision with a concurrent session occurred while editing `project.json` for
this gate record, discovered and resolved before committing** — a background build agent (a
different session, building the `dashboard-web` UI for Audit Logs and System Health on a shared
checkout) checked out its own branch in between this session's own `git checkout` and the
`project.json` edit, causing the edit to briefly land against the wrong branch's file state
(confirmed via `git reflog`/`git branch --contains`: no commit history was actually contaminated —
only an uncommitted working-tree edit was affected, which was discarded harmlessly by the
collision itself). Re-verified the correct branch was checked out, redid the edit, and committed
immediately with no gap, confirming the branch and gate/audit-log counts were correct before and
after each step. Opening a PR and merging remain their own separate, not-yet-requested
authorizations.

**Production migration:** Not yet requested — remains the user's own action, per this project's
standing credential-handling discipline for production migrations.
