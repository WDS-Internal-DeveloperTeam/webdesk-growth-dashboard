# `dashboard-web` Notification Center UI

## Scope

Built directly on the explicit "start notification center" instruction. Investigation first
(module registry, migrations, existing NestJS module) found the backend record-keeping foundation
for this module already exists — built during Phase 1E
(`docs/task-packages/phase-1e-notification-foundation.md`,
`docs/implementation/phase-1e-notification-foundation.md`): the `notifications` table
(migration `00026`), a full `NotificationService`/`NotificationsController` with list/get-by-id/
create/attempt-delivery routes, and a real delivery-state machine. What was missing: any
`dashboard-web` UI, and the module registry still marks `implementation_status: "not_started"`.

Two scope questions were put to the user directly (`AskUserQuestion`) before building:

1. **What to build** — the user chose **`dashboard-web` UI only**, reusing the existing backend
   as-is. (The alternative offered — also adding a dedicated `notification_center` RBAC
   permission group and a mark-in-development migration — was declined; both remain out of scope
   for this branch.)
2. **UI mutation scope** — the user chose **view-only list/detail**, with the existing
   `POST /notifications/:id/attempt-delivery` retry action exposed on the detail page. No create
   form. Real SMTP delivery is explicitly out of scope for this phase
   (`UnconfiguredNotificationDeliveryAdapter` always returns `rejected_retryable`), so a retry
   today always settles back into `retrying`/`permanently_failed` — the UI shows this honestly
   rather than implying a real send.

## As-built

Two routes under `app/(shell)/notification-center/`: a list page (filters: delivery state,
notification type, project id; offset pagination, mirroring
`app/(shell)/decision-and-activity-log/page.tsx`'s structure — the closest sibling, organization-
wide and filter-heavy) and a `[notificationId]` detail page (sections: Identity, Recipient,
Delivery, Related record, Status — the smallest honest reading of the backend's own field
grouping, no approved wireframe exists for this module). New `packages/shared-types`
`Notification`/`NotificationSeverity`/`NotificationDeliveryState`, mirroring
`packages/database/src/notifications/entities.ts`'s `NotificationEntity` exactly (not previously
exported from shared-types — the controller imports the DB-package type directly, but
`dashboard-web` can't). `lib/notification-center-query.ts`/`lib/notification-center.ts` mirror the
established zero-non-type-import-file split. `NotificationRetryAction` (client component,
`components/notification-retry-action.tsx`) is the one mutation this UI allows — renders nothing
once `deliveryState` is outside `queued`/`retrying` or `retryEligible` is `false`, matching every
sibling status-actions component's self-hiding convention; submits via `postMutation()`
(`credentials: "include"`, no body) to `POST /notifications/:id/attempt-delivery`.

**Known, pre-existing gap flagged, not fixed (out of scope per the confirmed scope decision):**
`notifications_view`/`notifications_configure` are, per the notifications controller's own doc
comment, "zero-seeded actions" on the `system_settings` RBAC group — no role currently holds
either grant. Concretely, this means every route this new UI calls (list, detail, retry) will
return a clean `403` for every real user today, including Super Admin, until a role is granted
`system_settings:notifications_view`/`notifications_configure` via the existing role-assignment
UI, or a dedicated `notification_center` permission group is seeded (the declined "UI + backend
polish" option above). This is not a defect this branch introduces — it is Phase 1E's own original
design, the same "deliberately zero-seeded, not a bug" shape this project has already accepted for
`view_confidential`/`edit_confidential` and other governance-sensitive actions.

## Validation

- `pnpm --filter @webdesk/shared-types build` — clean.
- `pnpm --filter dashboard-web typecheck` / `pnpm --filter dashboard-api typecheck` /
  `pnpm --filter dashboard-worker typecheck` — all clean (the additive shared-types change is a
  no-op for the two backend apps).
- `pnpm --filter dashboard-web lint` (`eslint --max-warnings=0` + CSS-token check, 99 files) —
  clean.
- `pnpm --filter dashboard-web build` — clean; both new routes present in the route manifest.
- `pnpm --filter dashboard-web test` — 1873/1873 unit tests passing (32 new: 22 in
  `notification-center.test.tsx` covering query parsing/href-building/badge mapping and the two
  server fetch functions' request-shaping/degrade behavior, 10 in
  `notification-retry-action.test.tsx` covering the component's self-hiding states, the mutation
  call shape, and error/refresh handling).
- `pnpm exec prettier --check` on every new/changed file — clean.

## Review

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule — a
small, frontend-only UI slice consuming an already-reviewed, already-gated backend with no new
endpoint, no new RBAC action, and no new sink. A direct read-through pass verified: the retry
button's `RETRYABLE_STATES` set matches `NotificationService.attemptDelivery()`'s own guard
exactly (`queued`/`retrying`); `getNotification()`'s malformed-id/404 degrade-to-`null` contract
matches every sibling `getX(id)` function, turned into `notFound()` by the detail page; the list
fetch never silently swallows a failure (propagates to the nearest `error.tsx`, matching
`getDecisionAndActivityLogEvents()`'s own precedent); `projectId` is UUID-shape-checked before
being forwarded to the backend, degrading to "no filter" on a garbled value rather than blanking
the whole page with a 400; and the retry mutation correctly sends no body, matching the
`POST /notifications/:id/attempt-delivery` route's own contract (no request DTO). No findings.

No separate security-review skill run, per the same standing rule — no new endpoint, no new
sink, and the one plain-text field rendered from user-facing content (`subject`,
`bodyReference`, `failureSummary`) is all backend-sourced, already-authenticated data rendered via
plain JSX text, never `dangerouslySetInnerHTML`.
