# Integration Contract — Vercel Background Jobs (Queues / Workflows / Cron)

**Status:** Draft. No adapter code exists yet; Vercel Queues/Workflows availability at implementation time is unconfirmed. This contract defines the intended shape so implementation can proceed against an agreed interface, not so integration can begin.

## Purpose

Trigger `dashboard-worker`'s stateless serverless handlers (ADR-0004) via message queue, multi-step workflow, or scheduled cron, per ADR-0005.

## Trust boundary

Each `dashboard-worker` handler validates its own trigger payload independently; no handler implicitly trusts that "the queue already validated this."

## Authentication

Trigger authenticity is verified per provider mechanism: Vercel Queues/Workflows triggers are verified via Vercel's own invocation authentication; the Upstash QStash fallback path verifies QStash's signing signature. A handler never processes a trigger payload whose authenticity it cannot verify.

## Authorization

Not applicable in the traditional user-authorization sense — the "authorization" question here is "was this handler legitimately triggered by the job system," covered under Authentication above.

## Inputs and outputs

- **Inbound:** job trigger payloads (queue message body, workflow step input, or cron invocation with no payload).
- **Outbound:** job results are written to the database (per ADR-0016, operational data is database-owned, not returned via the trigger mechanism itself).

## Validation

Every handler validates its trigger payload's shape and content before acting on it — an untrusted or malformed payload is rejected and logged, not processed with default/guessed values.

## Error handling

Handler failures are surfaced through the job system's own failure/retry visibility (Vercel Queues/Workflows dashboard or QStash's equivalent) and mirrored into the dashboard's own operational visibility — a silently-failing background job is treated as a defect to fix, not an acceptable steady state.

## Retry and idempotency

Every handler is designed to be safely re-invoked with the same trigger payload (at-least-once delivery is assumed, not exactly-once) — this is a hard per-handler requirement, not optional.

## Rate limits

Provider-specific (Vercel Queues/Workflows or Upstash QStash) — exact limits confirmed at Phase 1 implementation, not assumed unlimited.

## Audit events

Job execution start/success/failure is recorded as an audit event per ADR-0017 where the job represents a user-visible or security-relevant action (e.g., a scan run); purely internal housekeeping jobs may use a lighter-weight operational log instead — the line is drawn per job type at implementation time.

## Secret handling

Provider credentials (Vercel's own, or Upstash QStash's signing key for the fallback) managed per `docs/security/secrets-management-plan.md`.

## Environment separation

Separate queue/workflow/cron configurations per environment — a development-environment cron job must never trigger a production-environment handler.

## Failure recovery

The queue-recovery runbook (`project.json.runbooks_status.queue_recovery`, currently "missing") is a Phase 1 operational deliverable, informed by whichever provider (primary or fallback) is actually in use.

## Test requirements

Each handler is unit-testable with a synthetic trigger payload, independent of the actual queue/workflow/cron infrastructure — the adapter interface (ADR-0005) exists precisely to make this possible.

## Production approval requirements

New job types or changes to existing job-trigger schedules (cron timing) follow standard module-level review; no separate approval process beyond that.

## Open items

Whether Vercel Queues/Workflows are actually available and sufficient at Phase 1 implementation time is unconfirmed (ADR-0005) — see `docs/project-state/setup-input-register.md`.
