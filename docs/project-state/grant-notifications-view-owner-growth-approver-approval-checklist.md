# Grant `notifications_view` to `owner_growth_approver` — Approval Checklist

**Status:** Built, fully validated. Reviewed (security-focused, RBAC change) — 0 findings. Not
yet second-role human reviewed, gated, pushed, or merged.

## Completion condition

| #   | Item                                       | Status                                                                                                                                                                      |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start whatever missing in the notification center" → `AskUserQuestion`: "Widen notifications_view RBAC grant"                                                  |
| 2   | Genuine scoping confirmed                  | ✅ `AskUserQuestion`: `owner_growth_approver` (already holds nearly every other `system_settings` action); `notifications_configure` and every other role stay zero-seeded  |
| 3   | Required tests pass                        | ✅ A real migration up → down → up round-trip against a fresh local disposable PostgreSQL 17 database (`webdesk_notif_test`), confirming exactly two roles hold the grant   |
| 4   | Full validation clean                      | ✅ typecheck clean; `prettier --check` clean                                                                                                                                |
| 5   | Independent review complete                | ✅ Direct security-focused read-through (RBAC change — this project's standing rule reserves the full tier for these by default) — 0 findings                               |
| 6   | Security review                            | ✅ Folded into item 5 above — no application/enforcement code changed, purely additive seed data through the existing, unmodified `PermissionGuard`/`@RequirePermission`    |
| 7   | Known out-of-scope gaps flagged, not fixed | `notifications_configure` and every other role remain zero-seeded — explicitly declined for this request; a dedicated RBAC group and real SMTP delivery both remain unbuilt |
| 8   | Live-rendered / verified                   | N/A — a pure database-seed change, not a UI/route change; verified only against a local disposable database, per item 3                                                     |
| 9   | Documentation updated                      | ✅ `docs/implementation/grant-notifications-view-permission.md` (Slice 2)                                                                                                   |
| 10  | Exact branch/commit verified               | Branch `grant-notifications-view-owner-growth-approver`, off `origin/main` at `35e612e` — not yet committed/pushed                                                          |

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

**Required second-role human review:** Not yet requested.

**Gate:** Not yet requested.

**Push/PR/merge:** Not yet requested.

**Production migration:** Not yet requested — remains the user's own action, per this project's
standing credential-handling discipline for production migrations.
