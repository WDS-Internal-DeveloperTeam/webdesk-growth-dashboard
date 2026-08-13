# Phase 1E — Operational Contacts (task package)

**Authorization:** "Continue to operational contacts next" — the fifth slice of Phase 1E's own
authorization brief, following the audit-foundation slice (PR #11, merged), and the audit-schema-
expansion, job-architecture, notification-foundation, and retention-architecture slices (all
pushed, not merged). Covers brief §17–§18 (operational contact model, incident-severity
foundation) plus the relevant portions of §26/§28/§29/§34/§37.

## Branch base

Off `main`, not off any of the other four still-unmerged Phase 1E branches — same independent-
slice reasoning every prior slice this session has used. This is now the **fifth** consecutive
Phase 1E branch to independently claim migration number `00019` — expected, same rebase-on-merge
friction flagged four times already.

## Design decisions

1. **A contact is either a real system user or a raw name/email/phone — not forced into one
   shape.** §17's field list says "User/contact ID" (singular concept), but real operational
   contacts are frequently external (a hosting provider's support line, a domain registrar) and
   have no `users` row. `operational_contacts.contact_user_id` (nullable FK → `users.id`) covers
   the first case; `contact_name`/`contact_email`/`contact_phone` (all nullable) cover the second.
   A database CHECK constraint requires at least one of `contact_user_id` or `contact_name` to be
   present — same "structural, not just application-level" enforcement pattern
   `retention_holds`'s scope-shape constraint set. Per §17's own instruction ("do not hardcode
   personal contact details... no real operational emails required in fixtures"), no seed data is
   inserted into this table — unlike `retention_policies`, there is no already-approved contact
   _list_ to seed, only an already-approved contact _model_.

2. **`severity_applicability` is a JSONB array of the same four severity values
   `incident_severity_policies` defines** (`critical`/`high`/`medium`/`low`), not a separate join
   table — a contact typically applies to a small, fixed set of severities, and a full
   many-to-many table would be schema weight this foundation slice doesn't need yet.

3. **Escalation-chain resolution is a real, tested capability — not a business-module feature.**
   `OperationalContactService.resolveEscalationChain(area, severity, atTime?)` filters to
   active, effective-dated, severity-applicable contacts for an area and orders them
   primary-before-backup, then by `escalation_priority`, optionally further filtering by working
   hours if `atTime` is supplied. This is squarely inside §17's own "configurable contact model"
   scope — it resolves _who_ to contact from stored configuration, it does not send anything or
   track an incident, so it doesn't cross into "full incident-management system" territory (§18's
   own exclusion).

4. **`incident_severity_policies` is seeded with real, already-approved values**, same "these
   numbers are already decided" reasoning `retention_policies` used for §20's matrix. Three of the
   four severities (`critical`/`high`/`medium`) have a real fixed-duration target
   (`response_target_value`/`response_target_unit`); `low`'s approved target is "scheduled
   maintenance" — not a duration at all — represented honestly via `is_fixed_duration = false`
   rather than forcing a fabricated number into the schema.

5. **`IncidentSeverityService.evaluateResponseTarget()` never fabricates SLA compliance** (§18:
   "do not claim an SLA is automatically met merely because a target is stored"). It requires the
   caller to supply real `incidentOpenedAt`/`now` timestamps — nothing here reads or infers them
   from a real incident-tracking system, because none exists yet (§18's own exclusion: "do not
   build a full incident-management system"). For `low`, the function returns
   `applicable: false` rather than computing a fake `met` value against a duration that was never
   approved.

6. **Verification status is schema-ready, not actively wired.** `verification_status` defaults to
   `unverified`; `markVerified()`/`markVerificationFailed()` exist for a future real verification
   mechanism (e.g. a test notification via the Phase 1E notification-foundation slice's delivery
   adapter) to call. No such mechanism is built here — same "schema/service-ready but unexercised
   outside tests" pattern the notification-foundation slice's `confirmAccepted`/`confirmRejected`
   already established.

7. **RBAC reuses `system_settings`** with three new actions: `contacts_view`, `contacts_configure`
   (matching the `notifications_view`/`notifications_configure` naming precedent),
   `incident_severity_view` (read-only exposure of the seeded policy, same pattern
   `retention_view` used for `retention_policies`). Zero `role_permissions` rows seeded — the same
   "real, checked, zero seeded" precedent every other Phase 1E permission addition has followed.

8. **Two new audit event types**: `operational_contact_created`, `operational_contact_updated`
   (the latter also covers deactivation — a status change is just another update, not a
   conceptually distinct action). Contact management is genuinely human-initiated and
   actor-attributable, same reasoning that justified the audit events added by every prior Phase
   1E slice.

## What this slice does NOT include

- No real contact seed data (§17's own instruction).
- No real verification-send mechanism (would need the notification-foundation slice's delivery
  adapter wired for real, itself gated on real SMTP — out of scope, same as that slice).
- No incident-tracking/incident-management system (§18's own exclusion).
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.

## Testing plan

Contact creation (both a real-user contact and a raw-contact-details contact); the
at-least-one-of-user-or-name CHECK constraint rejected at the database layer; update (role,
priority, severities, active status); escalation-chain resolution ordering (primary before
backup, then priority), filtering (inactive contacts excluded, effective-date window respected,
severity-applicability respected, working-hours filtering when `atTime` is supplied); the four
seeded severity policies' real approved values; `evaluateResponseTarget()` for a met target, a
missed target, and the non-applicable `low` case; RBAC enforcement (zero seeded grants, denied
even for `super_admin`).
