# `dashboard-web` Notification Center UI — Approval Checklist

**Status:** Built, fully validated. Reviewed at light tier (0 findings) per this project's
2026-08-27 "right-size the review pipeline" standing rule. Not yet gated, pushed, opened as a PR,
or merged.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start notification center" instruction                                                                                                                                                                                                                                                                                       |
| 2   | Genuine scoping confirmed                  | ✅ Two `AskUserQuestion` decisions: dashboard-web UI only (reuse the existing Phase 1E backend as-is), view-only list/detail with the existing retry action exposed                                                                                                                                                                       |
| 3   | Required tests pass                        | ✅ 1873/1873 `dashboard-web` unit tests (32 new: 22 lib/query, 10 component)                                                                                                                                                                                                                                                              |
| 4   | Full validation clean                      | ✅ `@webdesk/shared-types` build clean; typecheck clean across `dashboard-web`/`dashboard-api`/`dashboard-worker`; `eslint --max-warnings=0` + CSS-token check (99 files) clean; `next build` clean, both new routes present; `prettier --check` clean                                                                                    |
| 5   | Independent review complete (light tier)   | ✅ A direct read-through pass (not the 8-angle fan-out, per the standing rule for a small frontend-only slice) — 0 findings                                                                                                                                                                                                               |
| 6   | Security review                            | Skipped per the same standing rule — no new endpoint, no new sink; the one client mutation is a no-body POST to an already-reviewed backend route                                                                                                                                                                                         |
| 7   | Known out-of-scope gaps flagged, not fixed | `notifications_view`/`notifications_configure` are zero-seeded on every role today (pre-existing Phase 1E design, not introduced by this branch) — every route this UI calls will 403 for every current user until a role is granted the permission or a dedicated RBAC group is seeded, both explicitly declined for this branch's scope |
| 8   | Live-rendered / verified                   | Not live-rendered against a running backend in this environment (no local `dashboard-api` available) — `next build` confirms both new routes compile and are present in the route table, matching the noted limitation on several prior slices                                                                                            |
| 9   | Documentation updated                      | ✅ `docs/implementation/dashboard-web-notification-center.md`                                                                                                                                                                                                                                                                             |
| 10  | Exact branch/commit verified               | Not yet on a dedicated branch or pushed to `origin`                                                                                                                                                                                                                                                                                       |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live
  `apps/dashboard-api/src/notifications/*` surface as-is, per the confirmed scope decision.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — `NotificationEntity` has no such field.

## Light-tier review — summary

A single direct read-through pass verified: `NotificationRetryAction`'s `RETRYABLE_STATES` set
(`queued`/`retrying`) matches `NotificationService.attemptDelivery()`'s own guard exactly;
`getNotification()`'s malformed-id/404-degrades-to-`null` contract matches every sibling `getX(id)`
function, turned into `notFound()` by the detail page; the list fetch never silently swallows a
failure (propagates to the nearest `error.tsx`, matching `getDecisionAndActivityLogEvents()`'s own
precedent); `projectId` is UUID-shape-checked before being forwarded to the backend, degrading to
"no filter" on a garbled value; and the retry mutation sends no body, matching
`POST /notifications/:id/attempt-delivery`'s own contract (no request DTO exists for it). **0
findings.**

A separate `security-review` pass was skipped per the standing rule — no new endpoint, no new
input reaching a dangerous render path; every rendered field (`subject`, `bodyReference`,
`failureSummary`) is already-authenticated backend data rendered as plain JSX text, never
`dangerouslySetInnerHTML`.

## Sign-off

**Required second-role human review:** Not yet requested.

**Gate:** Not yet requested.

**Push/PR/merge:** Not yet requested — each remains its own separate, not-yet-requested
authorization, per this project's standing "no auto-merge" rule.
