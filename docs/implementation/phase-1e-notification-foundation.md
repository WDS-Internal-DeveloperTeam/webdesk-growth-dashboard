# Phase 1E — Notification Foundation (as-built)

**Status:** Describes what is actually built, not an aspirational design — every claim below is
backed by real source files, real migrations, and real-database/e2e tests referenced inline.
Covers brief §15–§16 plus the notification-specific portions of §26/§28/§29/§34. See
`docs/task-packages/phase-1e-notification-foundation.md` for the design decisions and their
rationale.

## 1. Schema (migration `00019-create-notifications`)

One table, `notifications`, matching §15's field list: id, notification_type (STRING, evolvable),
severity (ENUM — `critical`/`high`/`medium`/`low`, the same four-value set §18's incident-severity
model uses), operational_area, project_id (nullable, unconstrained — same `user_roles.project_id`
precedent), recipient_user_id (real FK → `users.id` — recipients already exist as real system
users), recipient_contact_id (nullable, unconstrained — no `operational_contacts` table exists
yet, §17–18), subject, body_reference (a safe short message or a reference to where the full
content lives — never raw HTML/PII beyond what's already safe to log), delivery_state (ENUM, the
exact six approved values), attempt_count, last_attempt_at, failure_summary, retry_eligible,
correlation_id, related_entity_type/related_entity_id (polymorphic, unconstrained — same
`audit_events.entity_id` "spans many tables, some don't exist as code yet" reasoning),
retention_category, created_at/updated_at.

Indexes: delivery_state, `(project_id, created_at)`, recipient_user_id,
`(related_entity_type, related_entity_id)`, correlation_id.

## 2. Delivery boundary (§16)

`NotificationDeliveryAdapter` (`apps/dashboard-api/src/notifications/delivery-adapter.ts`) is the
real seam between notification creation and delivery: `NotificationService` never talks to SMTP
directly, only ever calling `adapter.deliver(notification)`. Its return type,
`NotificationDeliveryOutcome`, has four variants: `sent_to_smtp`, `accepted`,
`rejected_retryable`, `rejected_permanent`.

**The only production-wired adapter, `UnconfiguredNotificationDeliveryAdapter`, always returns
`rejected_retryable`** with a clear failure summary explaining SMTP isn't authorized for this
phase. It never returns `sent_to_smtp` or `accepted` — this is the literal mechanism behind §15's
"do not falsely mark a notification as delivered": the one real adapter in the system is
structurally incapable of claiming delivery it never attempted. Proven by a dedicated unit test
(`notification.service.spec.ts`'s "never falsely marks a notification as delivered").

A second, test-only `FakeDeliveryAdapter` (used only inside `notification.service.spec.ts`, never
DI-wired into any module) proves the service's state-machine logic correctly handles all four real
outcomes — production code never uses it.

## 3. State machine

`NotificationService` covers all six approved `delivery_state` values:

- `create()` → `queued`.
- `attemptDelivery()` — only from `queued`/`retrying`. Maps the adapter's outcome:
  `sent_to_smtp` → stays at `sent_to_smtp` (awaiting a future confirmation call);
  `accepted` → terminal `accepted`; `rejected_retryable` → `retrying` if
  `attempt_count < MAX_DELIVERY_ATTEMPTS` (5), else terminal `permanently_failed`;
  `rejected_permanent` → terminal `permanently_failed` immediately, regardless of attempts
  remaining.
- `confirmAccepted()`/`confirmRejected()` — only from `sent_to_smtp`, for a future two-phase SMTP
  adapter that hands off now and learns the final outcome later (bounce, delayed acceptance). No
  production adapter in this slice ever produces `sent_to_smtp`, so these are schema/service-ready
  but exercised only by tests.
- `markFailed()` — a manual, administrative "give up," distinct from the automatic
  retryable/permanent classification `attemptDelivery` produces. This is what actually exercises
  the plain `"failed"` state (as opposed to `"permanently_failed"`) — an operator or future
  business rule deciding to stop before the automatic logic ever ran.

Every transition is guarded: calling any of these from the wrong state throws
`BadRequestException`, proven by dedicated tests for each method.

## 4. RBAC integration (§29)

The approved 43-module registry already maps `notification_center` → `system_settings`
(migration `00015`) — the same module `audit_logs_and_system_health` and job architecture both
reuse. Two new actions, `notifications_view`/`notifications_configure` — the exact pair §29's own
example list names — with **zero `role_permissions` rows seeded**. Confirmed by
`test/notifications.e2e-spec.ts`: a real `super_admin` session is denied 403 on all three
authenticated endpoints.

## 5. HTTP surface (§28)

`NotificationsController` — `GET /notifications`, `GET /notifications/:id`,
`POST /notifications`, `POST /notifications/:id/attempt-delivery`. Same "prove the framework"
role every other Phase 1E controller has played; no real notification producer exists yet.
Bounded pagination (limit capped at 200, default 50), same as jobs' list endpoint.

## 6. Why no audit-event integration

Unlike manual job retry/cancellation (which record `job_retry_requested`/
`job_cancellation_requested`), notification creation and delivery attempts do **not** emit
`audit_events` rows in this slice. Notification lifecycle events are routine, potentially
high-volume, system-driven telemetry, not actor-attributable compliance actions — the same
reasoning `docs/task-packages/phase-1e-job-architecture.md §4` already established for routine
job state transitions. If a future slice adds an operator-triggered notification action (e.g.
manually cancelling a queued notification), that would be the point to add an audit event for it,
matching the existing "audit human decisions, not automatic telemetry" pattern.

## 7. What this slice does NOT include

- No real SMTP integration (explicitly deferred by the brief itself).
- No operational-contacts table — `recipient_contact_id` is schema-ready only.
- No real notification producer.
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.

## 8. Test coverage

`packages/database/test/phase1e-notifications.integration.test.ts` (real disposable database, 6
tests): creation defaults, real `recipient_user_id` FK round-trip, polymorphic
`related_entity_type`/`related_entity_id` round-trip, the `severity` ENUM rejecting an invalid
value at the database layer, partial updates, state-filtered listing.

`apps/dashboard-api/src/notifications/notification.service.spec.ts` (13 unit tests): creation; the
production adapter's honesty guarantee; invalid-state rejection; all four adapter outcomes via the
fake adapter (accepted, sent_to_smtp, retryable-with-attempts-remaining,
permanent-immediate-failure, retryable-exhausted); `confirmAccepted`/`confirmRejected` state
guards; `markFailed`.

`apps/dashboard-api/test/notifications.e2e-spec.ts` (4 tests, real disposable database): 401 with
no session, and real 403s proving zero-seeded deny-by-default across list/create/attempt-delivery
for a genuine `super_admin` session.

Full validation run (this slice): typecheck/lint clean across all 9 workspace packages, 19/19 +
54/54 `packages/database` tests (unit + integration, including a full migration `00001`→`00019`
up/down round-trip), 162/162 + 43/43 `dashboard-api` tests (unit + e2e), `pnpm audit` 0
vulnerabilities, prettier clean.
