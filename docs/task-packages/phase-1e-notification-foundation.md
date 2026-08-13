# Phase 1E — Notification Foundation (task package)

**Authorization:** "Continue to notifications next" — the third slice of Phase 1E's own
authorization brief, following the audit-foundation slice (PR #11, merged), the audit-schema-
expansion slice (`phase-1e-audit-schema-expansion`, pushed, not merged), and the job-architecture
slice (`phase-1e-job-architecture`, pushed, not merged). Covers brief §15–§16 (notification
records, the creation/delivery boundary) plus the notification-specific portions of §26/§28/§29/
§34/§37. Explicitly excludes real SMTP delivery — the brief's own instruction: "Do not connect
SMTP yet unless expressly authorized by a higher-precedence phase plan."

## Branch base

Off `main`, **not** off either of the other two still-unmerged Phase 1E branches — same reasoning
as the job-architecture task package: each slice is independently reviewable/mergeable, and
whichever merges later takes the ordinary rebase hit. Consequence: this slice cannot assume the
`jobs`/`job_attempts` tables or the audit-schema-expansion columns exist — `related_entity_type`/
`related_entity_id` (§4 below) is deliberately unconstrained so it doesn't depend on any of them
being merged first.

## Design decisions

1. **`delivery_state` is a real Postgres ENUM** — §15 gives an exact, small, six-value approved
   list (`queued`/`sent_to_smtp`/`accepted`/`failed`/`retrying`/`permanently_failed`), the same
   "small, structurally stable set" reasoning that made `jobs.status` and `audit_events.actor_type`
   ENUMs while `event_type`/`job_type` stayed evolvable STRINGs. `severity` is also an ENUM
   (`critical`/`high`/`medium`/`low`) — the same four-value set §18's incident-severity model
   uses, reused here rather than inventing a second vocabulary.

2. **Recipient reference is two columns, not one.** `recipient_user_id` (nullable FK → `users.id`)
   is a genuinely real, exercisable reference — real system users already exist. Operational
   contacts (§17) don't exist yet as their own table, so `recipient_contact_id` is a second,
   nullable, unconstrained UUID column — schema-ready only, same "not FK-constrained, no business
   entity backing it yet" precedent `user_roles.project_id` set in migration `00016`. A
   notification can reference either, both, or neither (e.g. a system-wide alert with no single
   recipient).

3. **`related_entity_type`/`related_entity_id` is polymorphic and unconstrained**, not three
   separate nullable FK columns for "audit/job/security" — mirrors `audit_events.entity_id`'s own
   "not FK-constrained — spans many tables, some of which don't exist as code yet" reasoning.
   Works regardless of which other Phase 1E branch (or none) has merged first.

4. **The delivery-adapter boundary is real, and its only production implementation is honest
   about doing nothing.** `NotificationDeliveryAdapter` is a real interface
   (`apps/dashboard-api/src/notifications/delivery-adapter.ts`) with a single production
   implementation, `UnconfiguredNotificationDeliveryAdapter`, which always returns
   `rejected_retryable` with a clear `failureSummary` — it never claims `sent_to_smtp` or
   `accepted`, because nothing is actually configured. This is the literal, mechanical
   implementation of §15's "do not falsely mark a notification as delivered": the only way this
   slice avoids that failure mode is by having its one real adapter refuse to lie. A second,
   test-only fake adapter (used only in specs) proves the state machine handles a real success/
   failure/permanent-rejection outcome correctly — production wiring never uses it.

5. **State machine matches §15's exact states**, including the `sent_to_smtp` → (later)
   `accepted`/`failed` two-phase shape a future real SMTP integration would need:
   `NotificationService.attemptDelivery()` handles the first call; `confirmAccepted()`/
   `confirmRejected()` exist for a future adapter that hands off to SMTP now and learns the
   final outcome later (bounce, delayed rejection). `UnconfiguredNotificationDeliveryAdapter`
   never produces a `sent_to_smtp` outcome — those two confirmation methods are schema/service-
   ready but unexercised by anything in this slice, honestly reflecting that no real two-phase
   adapter exists yet.

6. **RBAC reuses `system_settings`**, matching the approved 43-module registry's own mapping —
   `notification_center` → `system_settings` (migration `00015`), the same module
   `audit_logs_and_system_health` and (this session's) job architecture both reuse. Two new
   actions, `notifications_view`/`notifications_configure` — the exact pair §29's own example
   list names — with **zero `role_permissions` rows seeded**, the same "real, checked, zero
   seeded" precedent as every other Phase 1E permission addition so far.

## What this slice does NOT include

- No real SMTP integration (explicitly deferred by the brief itself).
- No operational-contacts table (§17–18 — separate, later slice); `recipient_contact_id` is
  schema-ready only.
- No real notification producer — no business service creates a notification yet. Same
  "framework before business modules" pattern every other Phase 1E slice has used.
- No notification-preferences/configuration model beyond the bare fields §15 lists.
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.

## Testing plan (§34's Notifications checklist)

Notification creation; state transitions through all six approved states (queued → sent_to_smtp →
accepted, and queued → retrying → permanently_failed); retry state (retryable rejection with
attempts remaining); permanent failure state (permanent rejection, or retryable rejection with
attempts exhausted); recipient/contact relationship (real `recipient_user_id` FK); no false
delivery success (the production adapter never returns `accepted`/`sent_to_smtp`, proven by a
dedicated test asserting this); RBAC enforcement (zero seeded grants, denied even for
`super_admin`, same proof pattern as the jobs e2e suite).
