# Grant `notifications_view` to `super_admin` — Approval Checklist

**Status:** Built, fully validated. Reviewed (security-focused, RBAC change) — 0 findings.
Required second-role human review complete. Gate `G4-grant-notifications-view-permission`
approved (WebDesk Solution, CONFIRM). Merged
([PR #117](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/117),
merge commit `2ec8c24dbe5bbd21a2bb4b8c95c5b922c624cfa6`). Migration `00117` run against
production by the user — **now genuinely live and confirmed working.**

## Completion condition

| #   | Item                                       | Status                                                                                                                                                                             |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Grant a role notifications_view permission" instruction                                                                                                               |
| 2   | Genuine scoping confirmed                  | ✅ `AskUserQuestion`: `super_admin` only (already holds every other `system_settings` action); `notifications_configure` and every other role stay zero-seeded                     |
| 3   | Required tests pass                        | ✅ 28/28 `@webdesk/database` unit tests; a real migration up → down → up round-trip against a fresh local disposable PostgreSQL 17 database, confirming exactly one grant lands    |
| 4   | Full validation clean                      | ✅ typecheck clean; `eslint --max-warnings=0` clean; `prettier --check` clean                                                                                                      |
| 5   | Independent review complete                | ✅ Direct security-focused read-through (RBAC change — this project's standing rule reserves the full tier for these by default) — 0 findings                                      |
| 6   | Security review                            | ✅ Folded into item 5 above — no application/enforcement code changed, purely additive seed data through the existing, unmodified `PermissionGuard`/`@RequirePermission` mechanism |
| 7   | Known out-of-scope gaps flagged, not fixed | `notifications_configure` and every other role remain zero-seeded — explicitly declined for this request                                                                           |
| 8   | Live-rendered / verified                   | ✅ Verified live in production directly — `dashboard-api`'s `/health` matched the merge commit, and the user confirmed the migration ran and the grant is working                  |
| 9   | Documentation updated                      | ✅ `docs/implementation/grant-notifications-view-permission.md`                                                                                                                    |
| 10  | Exact branch/commit verified               | Branch `grant-notifications-view-permission`, commit `265873d` (migration renumbered `00115`→`00117` during a merge with `main`) — merged via PR #117, merge commit `2ec8c24`      |

## Forbidden-actions check

- No new backend endpoint, no application/enforcement code change — the migration only inserts one
  additive `role_permissions` row.
- No new npm dependency.
- No broader RBAC change — only `super_admin`'s grants are touched, and only by one row.
- The real production database was never touched by this session — validated against a local
  disposable database only; running the real migration against production remains the user's own
  action, per this project's standing credential-handling discipline.

## Review — summary

See `docs/implementation/grant-notifications-view-permission.md`'s "Review" section for the full
account. **0 findings.**

## Sign-off

**Required second-role human review:** Complete — via the direct "Approve as-is, gate it, and
push the branch" instruction. The findings above served as the review artifact; there were no
open findings of any kind on this branch to accept as tracked debt.

**Gate:** `G4-grant-notifications-view-permission` approved — WebDesk Solution, decision CONFIRM
(clean pass, not an override), approved commit `84831c8` (migration renumbered `00115`→`00117` during a merge with `main`) on branch
`grant-notifications-view-permission`. See `outputs/webdesk-growth-dashboard/project.json`'s
`gates[]` (`current_gate` now `G4-grant-notifications-view-permission`).

**Push/PR/merge:** Pushed to `origin` under the same combined instruction. A real merge conflict
against `main` then surfaced (Help Center's own concurrently-merged backend, PR #118, had
independently claimed migration numbers `00115`/`00116`, colliding with this branch's own
migration) — resolved by merging `origin/main` in, keeping both sides' `CLAUDE.md`/`project.json`
content, and renumbering `00115` → `00117`, fully re-verified against fresh local disposable
databases before pushing again. "Open a PR" was then separately requested and executed
([PR #117](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/117)); all
14 CI checks confirmed green; "Merge PR #117" was then separately requested and executed — merge
commit `2ec8c24dbe5bbd21a2bb4b8c95c5b922c624cfa6`, verified live directly.

**Production migration:** Migration `00117` was then run against the real production database by
the user themselves, same credential-handling discipline as every prior production migration, and
confirmed directly ("Ran the migration, all confirmed working now"). **The `super_admin`
`notifications_view` grant is now genuinely live in production.**
