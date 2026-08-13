# Phase 1E — Job Architecture (task package)

**Authorization:** "Continue with job architecture" — the second slice of Phase 1E's own
authorization brief (recorded in CLAUDE.md's 2026-08-12 "Recent decisions"), following the
audit-foundation slice (PR #11, merged) and the audit-schema-expansion slice
(`phase-1e-audit-schema-expansion`, pushed, not yet merged). Covers brief §9–§14 (operational job
model, job attempts, idempotency, retry foundation, manual retry, cancellation) plus the
job-specific portions of §26 (database scope), §28 (API foundation), §29 (permission integration),
§34 (testing), and §37 (documentation). Explicitly excludes §33's actual queue/worker integration
(Vercel Queues/Workflows/Cron) — this builds the domain model and an adapter-shaped seam for a
later, separately-authorized integration, per the brief's own instruction.

## Branch base

Off `main` (commit at branch time — see git log), **not** off the still-unmerged
`phase-1e-audit-schema-expansion` branch. Each Phase 1E slice is independently reviewable and
mergeable, same pattern as Phase 1D-expanded building on top of PR #8's already-merged
`AuthzModule` rather than an unmerged sibling branch. Consequence: `AuditService` calls in this
slice use the shape currently on `main` (pre-`00019`) — no `eventCategory`/`sourceApplication`
fields yet. Whichever of the two open Phase 1E branches merges second will need an ordinary rebase,
same as PR #9 rebasing onto post-PR-#10 `main`.

## Design decisions

1. **Three tables, not one.** `jobs` (the record itself), `job_attempts` (history — §10 explicitly
   says "do not store only the latest attempt"), `idempotency_keys` (a genuinely reusable,
   DB-backed primitive per §11 — not folded into `jobs` itself, since §11 frames idempotency as a
   service-wide concern, not job-specific, even though jobs are its first real consumer).

2. **Status is a real Postgres ENUM**, unlike `event_type`/`action` elsewhere in this codebase.
   §9 gives an exact, small, "use exact names" lifecycle (`pending`/`queued`/`running`/`retrying`/
   `succeeded`/`failed`/`cancelled`/`expired`) — the same "small, structurally stable set"
   reasoning that made `actor_type` an ENUM on `audit_events` while `event_type` stayed a STRING.

3. **RBAC reuses the existing `system_settings` module**, not a new "jobs" module. The approved
   43-module registry (migration `00015`) already maps `audit_logs_and_system_health` to
   `system_settings` — there is no dedicated "jobs" entry in the approved registry, and inventing
   one would mean grants that were never part of the approved 458-grant matrix. New action strings
   (`jobs_view`/`jobs_retry`/`jobs_cancel`) are added and genuinely checked via
   `AuthorizationService.evaluate()`, with **zero `role_permissions` rows seeded for them** — the
   same "real, checked, zero seeded" precedent Phase 1D-expanded set for
   `view_confidential`/`edit_confidential`. Deny-by-default means nobody can use these endpoints
   until a future, separately-authorized decision seeds real grants.

4. **`audit_events` gets two new event types, not routine job telemetry.** The pre-existing
   `job_completed`/`job_failed` values in `AuditEventType` (present since the original audit-slice
   contract) are deliberately left **unused** by this slice: a job silently completing or failing
   is routine operational telemetry, not an actor-attributable compliance action — writing one
   audit row per job completion would flood a table designed for "who did what" with high-volume
   noise, contradicting §32's own logging-boundary principle. Instead, two new types are added —
   `job_retry_requested` and `job_cancellation_requested` — emitted only for the two genuinely
   human-initiated, actor-attributable actions this slice has (manual retry, cancellation
   request). Automatic state transitions (create/start/heartbeat/complete/fail) stay entirely
   within `jobs`/`job_attempts` — the "system activity" tier §24 itself distinguishes from
   immutable audit.

5. **Manual retry moves a job to `queued`, not `running`.** No real worker/queue exists yet (§33)
   to actually execute anything — retrying means "make this eligible to run again," which a future
   queue consumer will pick up via `startAttempt()`.

6. **Cancellation is immediate-and-safe for `pending`/`queued` jobs, request-only for
   `running`/`retrying`.** A job that hasn't started yet can be cancelled outright (nothing to
   interrupt). A running job can only be asked — cancellation acknowledgement is a future
   job-type-specific handler's job, matching §14's "each future job type must explicitly declare
   cancellation capability." A small in-code `CANCELLABLE_JOB_TYPES` registry starts empty (no
   real job producer exists yet); a job type not in it gets `cancellation_state = "failed"`
   immediately.

7. **Idempotency scoping.** `idempotency_keys` is keyed on `(scope, idempotency_key)`, not the key
   alone — `scope` namespaces the key so two unrelated operations can safely reuse the same literal
   value. `JobService.create()` uses `scope = "job:" + jobType`.

## What this slice does NOT include

- No actual Vercel Queues/Workflows/Cron integration (§33 — separate, later authorization).
- No real job producers (no business module creates jobs yet) — this proves the framework the same
  way Phase 1D's "Users/roles" surface proved `PermissionGuard` before 20 other modules existed.
- No manual-retry/cancel UI (§13/§14 — later module).
- No independent code review or dedicated security review of this slice (same open item as the
  audit slices).
- No traceability-matrix/HANDOFF/phase-plan update (tracked as still-open, same as the audit
  slices).

## Testing plan (§34's Jobs checklist)

Create job; idempotent duplicate request (same scope+key returns the existing job, doesn't create
a second row); status transitions (including invalid-transition rejection — e.g. `complete()` on a
non-`running` job throws); attempt history (multiple `job_attempts` rows, not overwritten);
retryable failure (transient category + attempts remaining → `retrying` with a computed
`next_retry_at`); permanent failure (non-retryable category, or attempts exhausted → terminal
`failed`); manual retry (eligibility check, RBAC enforcement, audit event); cancellation
eligibility (pending/queued → immediate; running/retrying → requested-only; unregistered job type →
failed); authorization enforcement (all three new endpoints correctly deny with zero seeded
grants).
