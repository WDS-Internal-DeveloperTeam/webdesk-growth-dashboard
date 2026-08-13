# Phase 1E — Operational Contacts (as-built)

**Status:** Describes what is actually built, not an aspirational design — every claim below is
backed by real source files, real migrations, and real-database/e2e tests referenced inline.
Covers brief §17–§18 plus the relevant portions of §26/§28/§29/§34. See
`docs/task-packages/phase-1e-operational-contacts.md` for the design decisions and their
rationale.

## 1. Schema (migrations `00019`–`00021`)

- **`operational_contacts`** (`00019`, no seed data — §17's own instruction) — full §17 field
  list: `contact_user_id` (nullable FK → `users.id`, for a contact who's a real dashboard user) or
  `contact_name`/`contact_email`/`contact_phone` (for an external contact with no `users` row) —
  a real database CHECK constraint (`operational_contacts_identity_required`) requires at least
  one identity path, proven by a dedicated integration test issuing a raw `INSERT` that violates
  it. `area` (STRING, evolvable — §17's own list is "such as", not exhaustive), `role` (real ENUM,
  `primary`/`backup`), `escalation_priority`, `channel_preference`, `severity_applicability`
  (JSONB array of severity keys, `null` = all severities), `working_hours_start`/
  `working_hours_end` (TIME) + `time_zone`, `effective_start_date`/`effective_end_date`,
  `active_status`, `verification_status` (real ENUM, defaults `unverified`).
- **`incident_severity_policies`** (`00020`, seeded by `00021`) — 4 rows, one per §18's approved
  severity: `severity` (real ENUM, unique), `response_target_value`/`response_target_unit`
  (nullable — `critical`/`high`/`medium` have real fixed-duration values; `low`'s approved target,
  "scheduled maintenance," is not a duration, represented via `is_fixed_duration = false` rather
  than a fabricated number), `response_target_description` (always present, human-readable).

## 2. Escalation-chain resolution (§17)

`OperationalContactService.resolveEscalationChain(area, severity, atTime?)` — filters
`findActiveForArea(area)` results to those effective at `atTime` (respecting
`effective_start_date`/`effective_end_date`), applicable to the requested `severity`
(`severity_applicability === null` means all severities), and — when working hours are configured
— within them at `atTime` (converted to the contact's own `time_zone` via
`Intl.DateTimeFormat`). Orders primary contacts before backups, then by ascending
`escalation_priority`. **Note**: the working-hours check has no overnight-wraparound support (a
`22:00`–`06:00` range always evaluates false) — a documented, honest bound for this foundation
slice, not a silent gap.

This resolves *who* to contact from stored configuration only — it sends nothing and tracks no
incident, staying inside §17's "configurable contact model" scope without crossing into §18's
excluded "full incident-management system."

## 3. Response-target evaluation (§18)

`IncidentSeverityService.evaluateResponseTarget(severity, incidentOpenedAt, now?)` requires the
caller to supply real timestamps — nothing here reads from an incident-tracking system, because
none exists yet. For `minutes`/`hours` targets, compares elapsed milliseconds against a computed
threshold. For the `business_days` target (`medium`), counts actual weekdays between the two
timestamps rather than treating "1 business day" as a fixed 24-hour window — a real, bounded
implementation (`businessDaysBetween()`), not a hand-wave, though it doesn't account for holidays.
For `low`, returns `applicable: false` — §18's own instruction ("do not claim an SLA is
automatically met merely because a target is stored") is honored by refusing to evaluate a target
that was never approved as a duration in the first place, not by silently treating it as always
met.

## 4. Audit integration

Two new event types: `operational_contact_created`, `operational_contact_updated` — the latter
also covers deactivation (a status change routed through the same `update()` method, not a
separate action). Both are genuinely human-initiated and actor-attributable, recorded via the
shared `AuditService`.

## 5. RBAC integration (§29)

Reuses `system_settings` (every Phase 1E permission addition has reused it) with three new
actions: `contacts_view`, `contacts_configure` (matching the `notifications_view`/
`notifications_configure` naming precedent), `incident_severity_view` (read-only, matching
`retention_view`'s role for `retention_policies`). **Zero `role_permissions` rows seeded.**
Confirmed by `test/operational-contacts.e2e-spec.ts`: a real `super_admin` session is denied 403
on list/create/escalation-chain/severity-policies.

## 6. HTTP surface (§28)

`OperationalContactsController` — `GET /operational-contacts`,
`GET /operational-contacts/escalation-chain` (declared *before* `:id` — NestJS matches routes in
declaration order, so `:id` would otherwise swallow it), `GET /operational-contacts/:id`,
`POST /operational-contacts`, `POST /operational-contacts/:id/update`,
`POST /operational-contacts/:id/deactivate`. `IncidentSeverityController` —
`GET /incident-severity/policies`, `POST /incident-severity/evaluate` (read-only — evaluates
against caller-supplied timestamps, never touches real data).

## 7. Verification status — schema-ready, not wired

`verification_status` defaults to `unverified`. `markVerified()`/`markVerificationFailed()` exist
for a future real verification mechanism (e.g. a test notification via the notification-
foundation slice's delivery adapter) to call — none is built here, matching the same
schema/service-ready-but-unexercised pattern the notification-foundation slice's
`confirmAccepted`/`confirmRejected` already established.

## 8. What this slice does NOT include

- No real contact seed data (§17's own instruction).
- No real verification-send mechanism.
- No incident-tracking/incident-management system (§18's own exclusion).
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.

## 9. Test coverage

`packages/database/test/phase1e-operational-contacts.integration.test.ts` (real disposable
database, 8 tests): user-backed and raw-detail contact creation; the identity-required CHECK
constraint rejected at the database layer; update; `findActiveForArea` excluding inactive
contacts; all 4 seeded severities present, including the real `critical` (15 minutes) and `low`
(non-fixed-duration) values.

`apps/dashboard-api/src/operational-contacts/*.spec.ts` (17 unit tests):
`OperationalContactService` (creation validation, audit attribution, escalation-chain ordering,
effective-date filtering, severity-applicability filtering, working-hours filtering);
`IncidentSeverityService` (policy-not-found, met/missed minutes and hours targets, business-days
counting, the non-applicable `low` case).

`apps/dashboard-api/test/operational-contacts.e2e-spec.ts` (5 tests, real disposable database):
401/403 deny-by-default proof across contacts and incident-severity endpoints.

Full validation run (this slice): typecheck/lint clean across all 9 workspace packages, 19/19 +
56/56 `packages/database` tests (unit + integration, including a full migration `00001`→`00021`
up/down round-trip), 166/166 + 44/44 `dashboard-api` tests (unit + e2e), `pnpm audit` 0
vulnerabilities, prettier clean.
