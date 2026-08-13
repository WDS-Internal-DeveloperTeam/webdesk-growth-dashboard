# Phase 1E — Job Architecture (as-built)

**Status:** Describes what is actually built, not an aspirational design — every claim below is
backed by real source files, real migrations, and real-database/e2e tests referenced inline.
Covers brief §9–§14 plus the job-specific portions of §26/§28/§29/§34. See
`docs/task-packages/phase-1e-job-architecture.md` for the design decisions and their rationale.

## 1. Schema (migrations `00019`–`00021`)

Three tables, following §4's "reuse, don't invent per-module" rule:

- **`jobs`** (`00019`) — the job record itself. `status` is a real Postgres ENUM (the 8-value
  lifecycle §9 specifies exactly); `job_type`, `cancellation_state`, `failure_category` stay
  STRING (evolvable vocabularies, same reasoning as `audit_events.event_type`). Full field list
  matches §9: id, job_type, project_id (nullable, unconstrained — no `projects` table, same
  precedent as `user_roles.project_id`), resource_type/resource_id, requested_by_user_id, status,
  progress (CHECK 0–100), current_step, idempotency_key, retry_policy (JSONB), attempt_count,
  max_attempts, timeout_seconds, scheduled_at/started_at/finished_at/heartbeat_at,
  cancellation_state, failure_code/failure_category/failure_summary, next_retry_at,
  worker_identity, correlation_id, retention_category.
- **`job_attempts`** (`00020`) — full attempt history, not just the latest (§10). One row per
  execution attempt: attempt_number, started_at/finished_at, handler, result, failure_category,
  failure_summary, retry_decision, correlation_id, evidence_reference (a reference, e.g. a Sentry
  ID — never full logs duplicated into Postgres). `UNIQUE(job_id, attempt_number)`.
- **`idempotency_keys`** (`00021`) — the reusable, DB-backed idempotency primitive (§11), not
  job-specific despite jobs being its first consumer. `UNIQUE(scope, idempotency_key)` — `scope`
  namespaces the key so two unrelated operations can reuse the same literal value safely.
  `processing_state` is a real ENUM (`pending`/`completed`/`failed`).

Indexes: `jobs` on status, `(project_id, created_at)`, job_type, correlation_id, next_retry_at;
`job_attempts` on job_id; `idempotency_keys` on expires_at — covering §36's named query patterns.

## 2. Failure classification and retry (§12)

`AUTO_RETRYABLE_CATEGORIES` in `job.service.ts` — `retryable_transient`, `dependency_unavailable`,
`rate_limited`, `timeout` — are the only categories that trigger an automatic retry, and only while
`attempt_count < max_attempts`. `permanent`, `validation`, `authorization`, `cancelled`, and
`unknown` all go straight to terminal `failed` (§12: "do not retry every error blindly" —
`unknown` is deliberately NOT auto-retried, since retrying an unclassified failure blindly is
exactly what that line prohibits). Backoff is exponential and capped: `30s × 2^(attempt-1)`,
capped at `3600s`, computed in `computeNextRetryAt()`.

`retry_decision` on the closed attempt records exactly which of the four outcomes applied
(`will_retry`, `no_retry_permanent`, `no_retry_max_attempts`, `no_retry_cancelled`) — proven by
`job.service.spec.ts`'s "terminally fails once max attempts are exhausted, even for a retryable
category" and "terminally fails immediately on a permanent category" tests.

## 3. Manual retry (§13)

`JobRetryService.checkEligibility()` — eligible only when `status === "failed"`.
`manualRetry()` resets the job to `queued` (not `running` — no real worker/queue exists yet to
execute anything; §33), clears failure fields, and records a `job_retry_requested` audit event
attributing the requester. RBAC-gated at the controller (`jobs_retry` on `system_settings`, zero
seeded grants — see §5 below).

## 4. Cancellation (§14)

`JobCancellationService.requestCancellation()`:

- Terminal job (`succeeded`/`failed`/`cancelled`/`expired`) → rejected, nothing to cancel.
- Job type not in `CANCELLABLE_JOB_TYPES` → `cancellation_state = "failed"` immediately. The set
  currently holds one test-shaped entry, `"framework_probe"` — the same "prove the mechanism, not
  a business module" pattern `packages/database`'s `_framework_probe` table set in Phase 1B. No
  real job producer has declared cancellation capability yet.
- Cancellable + not yet started (`pending`/`queued`) → cancelled immediately and safely
  (`status = "cancelled"`, `cancellation_state = "cancelled_safely"`) — nothing was running to
  interrupt.
- Cancellable + already running (`running`/`retrying`) → `cancellation_state = "requested"` only;
  `status` is untouched. A future job-type-specific handler is responsible for acknowledging it.
  `JobService.complete()` marks a still-`"requested"` cancellation as `"too_late"` if the job
  finishes before anyone acts on the request — proven by `job.service.spec.ts`'s dedicated test.

Every cancellation request — regardless of outcome — records a `job_cancellation_requested` audit
event attributing the requester.

## 5. RBAC integration (§29)

No dedicated "jobs" module exists in the approved 43-module registry (migration `00015`) — the
closest existing entry, `audit_logs_and_system_health`, maps to the `system_settings` permission
group (migration `00013`'s 21-module/458-grant matrix). Every job route reuses `system_settings`
with four new action strings: `jobs_view`, `jobs_create`, `jobs_retry`, `jobs_cancel`. **Zero
`role_permissions` rows are seeded for any of them** — genuinely checked via
`AuthorizationService.evaluate()`, same "real, checked, zero seeded" precedent Phase 1D-expanded
set for `view_confidential`/`edit_confidential`. Confirmed by `test/jobs.e2e-spec.ts`: a real
`super_admin` session — which holds every other seeded grant in the matrix — is still denied 403
on all four endpoints, because deny-by-default has no grant row to find.

## 6. HTTP surface (§28)

`JobsController` (`/jobs`, `/jobs/:id`, `POST /jobs`, `POST /jobs/:id/retry`,
`POST /jobs/:id/cancel`) — the same "prove the framework" role Phase 1D's "Users/roles" controller
played before any of the 20 other business modules existed as code. `GET /jobs` supports
status/project/type filtering with bounded pagination (limit capped at 200, default 50 — §36's
"avoid unbounded list endpoints").

## 7. What this slice does NOT include

- No actual Vercel Queues/Workflows/Cron integration (§33) — a future queue consumer calls
  `JobService.startAttempt()`/`complete()`/`fail()` the same way this slice's tests do; nothing
  here assumes a specific execution substrate.
- No real job producers — no business module creates a job yet.
- No manual-retry/cancel UI (§13/§14 — later module).
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.
- `job_completed`/`job_failed` audit event types (pre-existing since the original audit contract)
  remain unused by design — routine automatic job telemetry stays in `jobs`/`job_attempts`, not
  `audit_events`; see the task package §4 for the full reasoning.

## 8. Test coverage

`packages/database/test/phase1e-jobs.integration.test.ts` (real disposable database, 13 tests):
job creation defaults, project_id/correlation_id round-trip, partial updates, the `progress` CHECK
constraint, status-filtered listing, multi-attempt history, attempt closing, the
`(job_id, attempt_number)` unique constraint, and all five idempotency-key behaviors (fresh
reservation, in-progress conflict, completed duplicate, reissue-after-failure, and
scope-isolation). Full migration `00001`→`00021` up/down round-trip verified via the suite's own
`beforeAll`/`afterAll`.

`apps/dashboard-api/src/jobs/*.spec.ts` (30 unit tests): `JobService` (idempotent create,
duplicate/conflict handling, every status transition including invalid-transition rejection,
retryable vs. permanent vs. exhausted-attempts failure classification, the cancellation-then-completes
`too_late` race), `JobRetryService` (eligibility, manual retry, audit attribution),
`JobCancellationService` (immediate-safe vs. request-only vs. unregistered-type, audit
attribution), `IdempotencyService` (outcome mapping).

`apps/dashboard-api/test/jobs.e2e-spec.ts` (5 tests, real disposable database): 401 with no
session, and real 403s proving zero-seeded deny-by-default for a genuine `super_admin` session
across list/create/retry/cancel.

Full validation run (this slice): typecheck/lint clean across all 9 workspace packages, 19/19 +
61/61 `packages/database` tests (unit + integration), 179/179 + 44/44 `dashboard-api` tests (unit
+ e2e), `pnpm audit` 0 vulnerabilities, prettier clean.
