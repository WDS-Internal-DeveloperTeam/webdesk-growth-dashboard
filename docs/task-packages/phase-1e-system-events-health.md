# Phase 1E — System Events & Health (task package)

**Authorization:** "Continue to system health next" — the sixth and final architecture slice of
Phase 1E's own authorization brief, following the audit-foundation slice (PR #11, merged), and
the audit-schema-expansion, job-architecture, notification-foundation, retention-architecture,
and operational-contacts slices (all pushed, not merged). Covers brief §24–§25 (system activity
foundation, system-health foundation) plus the relevant portions of §26/§28/§29/§34/§37.

## Branch base

Off `main`, not off any of the other five still-unmerged Phase 1E branches — same independent-
slice reasoning every prior slice this session has used. This is now the **sixth** consecutive
Phase 1E branch to independently claim migration number `00019` — expected, same rebase-on-merge
friction flagged five times already.

## Design decisions

1. **Three tables, matching the brief's own two-part split plus one catalog.** `system_events`
   (§24 — the user-facing activity feed); `system_components` (§25 — a seeded catalog of the 10
   named subsystems); `system_health_checks` (§25 — an append-only history of status
   observations, one row per check). Health status is append-only history, not an upsert-in-place
   "current status" row, for the same reason `job_attempts`/`audit_events` are append-only in this
   codebase: it supports both "what's current" (most recent row) and a real trend/history view
   without extra machinery.

2. **The component _catalog_ is seeded; individual _status readings_ are never seeded.** §25
   names the 10 subsystems explicitly ("Support status concepts for: API, Database, Background
   execution..."), so `system_components` gets the same "already approved, seed it" treatment
   `retention_policies`/`incident_severity_policies` got for their own approved lists. No
   `system_health_checks` row is ever seeded — status is inherently observed, not a decided value,
   and §25's own instruction ("do not show 'Healthy' for an integration that has never been
   tested") means a component with zero recorded checks must resolve to an honest "we don't know,"
   not a fabricated status of any kind.

3. **`getCurrentStatus()` returns a synthetic `"unknown"` when no check has ever been recorded —
   never `"healthy"` by default.** This is the literal mechanical enforcement of §25's own
   instruction. A real check CAN explicitly record `"not_configured"` (e.g. a future WordPress
   probe that runs, finds no credentials, and honestly reports that) — the distinction is:
   `"unknown"` means "no observation exists at all"; `"not_configured"` means "an observation was
   made, and the answer was that nothing is set up."

4. **`system_events` is deliberately NOT the audit trail, and the schema makes the distinction
   visible rather than just documented in prose.** §24: "do not confuse user-facing activity feed
   with immutable audit... an event may generate both... when required." `system_events` has an
   optional `related_audit_event_id` (nullable FK → `audit_events.id`) — set only when a caller
   also separately created a real audit event for the same underlying occurrence. Recording an
   activity event never automatically creates an audit event, and vice versa; a caller that needs
   both makes both calls explicitly. Most activity events (job status changes, notification
   queued, scan completed) are routine, potentially high-volume operational telemetry — the same
   "don't audit routine telemetry" reasoning every prior Phase 1E slice has followed for its own
   automatic state transitions.

5. **One new audit event type**: `system_health_check_recorded` — used only when a _human_
   manually records a health check via the HTTP endpoint (the only path that exists in this
   slice, since no automated probe is built — see §6 below). A future automated probe calling
   `SystemHealthService.recordCheck()` directly (not through the audited HTTP path) would
   reasonably skip the audit event, matching the "audit human decisions, not automatic telemetry"
   pattern.

6. **RBAC uses the exact action names §29 itself gives**: `system_health_view` (from
   `system_health.view`) for read access to health status and the activity feed, and
   `system_settings_configure` (from `system_settings.configure`) for manually recording a check —
   reused as a general "administrative configuration" action rather than inventing a narrower
   `system_health_configure`, since §29 itself groups health-check recording under the broader
   system-settings configuration permission, not a dedicated one. Reuses `system_settings`, the
   module every Phase 1E permission addition has reused. Zero `role_permissions` rows seeded.

## What this slice does NOT include

- No real probes for any of the 10 named subsystems (§25's own instruction: "do not connect all
  systems yet"). `recordCheck()` is a real, tested mechanism; nothing calls it automatically.
- No scheduled/cron-triggered health checking (would need Vercel Cron — separate, later
  authorization, same §33 boundary every prior slice has respected).
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.

## Testing plan

Activity recording and listing, with and without a linked audit event; component catalog seeding
(all 10 present); health-check recording; `getCurrentStatus()` resolving to `"unknown"` for a
component with zero checks, and to the most recent recorded status otherwise (proving ordering,
not just presence); `getAllCurrentStatuses()` covering every seeded component even when some have
no history; RBAC enforcement (zero seeded grants, denied even for `super_admin`).
