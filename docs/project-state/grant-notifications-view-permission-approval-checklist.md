# Grant `notifications_view` to `super_admin` — Approval Checklist

**Status:** Built, fully validated. Reviewed (security-focused, RBAC change) — 0 findings. Not
yet gated, pushed, opened as a PR, or merged.

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
| 8   | Live-rendered / verified                   | Verified directly against a real local database (not production) — see the implementation doc's "Validation" section                                                               |
| 9   | Documentation updated                      | ✅ `docs/implementation/grant-notifications-view-permission.md`                                                                                                                    |
| 10  | Exact branch/commit verified               | Not yet on a pushed branch                                                                                                                                                         |

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

**Required second-role human review:** Not yet requested.

**Gate:** Not yet requested.

**Push/PR/merge:** Not yet requested — each remains its own separate, not-yet-requested
authorization, per this project's standing "no auto-merge" rule.
