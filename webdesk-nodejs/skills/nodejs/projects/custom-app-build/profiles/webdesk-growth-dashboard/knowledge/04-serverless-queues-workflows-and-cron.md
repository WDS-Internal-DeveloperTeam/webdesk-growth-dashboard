---
tier: 1
load_when:
  ["webdesk-growth-dashboard", "integration-work", "sync-engine", "backend-active", "observability"]
description: "RESOLVED architecture decision — dashboard-worker is not a permanent process. Vercel Queues/Workflows/Cron Jobs execution model, required job-record properties, locking/idempotency without an in-process lock, and the adapter-interface rule. Supersedes docs/implementation/open-questions.md OQ-02."
---

# 04 — Serverless Queues, Workflows, and Cron

> **This decision is resolved and must not be reopened as an open question.** `docs/implementation/open-questions.md` OQ-02 asked whether `dashboard-worker` is a persistent process or fully serverless. The answer, for this project, is: **fully serverless. There is no permanent Node.js process or container anywhere in the job-execution path.** This file is the operating specification for that decision, not a discussion of alternatives.

---

## The resolved model

- **`dashboard-web` runs on Vercel** as a standard Next.js deployment.
- **`dashboard-api` runs as NestJS through Vercel Functions** — request-scoped, cold-start-aware (`knowledge/03-nestjs-on-vercel.md`).
- **`dashboard-worker` is not a permanent Node.js process or container.** It has no `server.js`, no `app.listen()`, no long-lived event loop waiting on a queue connection. It is a **set of Vercel Function handlers**, each invoked on demand by one of:
  - **Vercel Queues** — asynchronous message delivery. A handler is invoked per message (or per batch, depending on the queue's configuration).
  - **Vercel Workflows** — durable multi-step orchestration. A workflow definition calls out to Function handlers per step, with the platform durably tracking progress across steps (including across cold starts/redeploys).
  - **Vercel Cron Jobs** — scheduled triggers. A Cron Job invokes an HTTP endpoint on a schedule; that endpoint is a thin Function handler that typically enqueues real work onto Vercel Queues/Workflows rather than doing long processing inline (Cron invocations, like all Functions, are time-bounded).
- **Upstash QStash + Vercel Cron Jobs** is the documented fallback for the primary Vercel Queues/Workflows path — see §"Fallback trigger condition" below.
- **PostgreSQL stores permanent job state.** Every job's durable record of record is a Postgres row (`contracts/job-record.schema.json`), not anything held in a process's memory — because there is no persistent process to hold it.
- **Upstash Redis is used for rate limits, locks, short-lived caching, and replay protection** — not as a BullMQ-style persistent worker's job queue backing store (there is no BullMQ `Worker` in this architecture at all).

**No in-process lock may be treated as durable.** Every lock, dedupe check, and idempotency guard is backed by PostgreSQL or Redis, never by an in-memory value in a Function invocation, since no two invocations of the same handler are guaranteed to share memory, and a given invocation's memory is not guaranteed to survive past that invocation.

---

## Why this reading of the base skill's job guidance still applies

The base skill's job-property requirements (`nodejs/knowledge/integration/01-sync-strategies.md`, `02-queues-and-jobs.md`, NODE-101, NODE-102) describe **required behavior**, not a required mechanism. Every one of them is satisfied by this serverless model:

| Base-skill requirement                            | How it's satisfied in this model                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotency (NODE-102) — safe to run twice        | Upsert keyed on a stable natural/external key, enforced by a Postgres unique constraint — unchanged from the base skill's own pattern, just as applicable to a Function-invoked handler as to a BullMQ worker                                                                                                                                       |
| Capped retries + backoff + DLQ (NODE-101)         | Vercel Queues' own retry/DLQ semantics (or Upstash QStash's, on fallback) replace BullMQ's; the _policy_ — capped attempts, exponential backoff, terminal errors routed to a dead-letter path, never unbounded — is configured identically in spirit                                                                                                |
| Overlapping-run prevention                        | A Postgres row with a `locked_until` timestamp (or a Redis lock with a TTL) per job/entity key, checked and set atomically before a handler does real work — see §"Locking without a persistent process" below                                                                                                                                      |
| Timezone-aware scheduling, UTC storage            | Vercel Cron Jobs' schedule expression is set from the Dashboard Settings timezone at configuration time (same rule as the base skill: never the server's local tz); all stored timestamps remain `timestamptz` UTC                                                                                                                                  |
| Watermark advances only after durable persistence | Unchanged — the watermark/progress column on the job record advances only after the corresponding batch is committed, exactly as `integration/01-sync-strategies.md` specifies; a killed invocation simply means the next invocation resumes from the last-committed watermark, same logical behavior as a killed BullMQ worker resuming on restart |

What does **not** carry over, because there is no persistent process for it to apply to: the graceful-shutdown-drains-in-flight-work sequence (`backend/01-runtime-and-frameworks.md`). See `knowledge/03-nestjs-on-vercel.md` §"What does not carry over."

---

## Locking without a persistent process

An in-process advisory lock (the kind a long-lived BullMQ `Worker` could hold in memory) has no equivalent here — there is no process to hold it. Use one of:

1. **Postgres row lock** — a `locked_until` column on the job/entity's state row (mirrors `sync_states.locked_until` from the base skill's own `integration/02-queues-and-jobs.md`), set via an atomic `UPDATE ... WHERE locked_until < now() OR locked_until IS NULL` — the handler proceeds only if the update affected a row; otherwise it exits immediately (another invocation already holds the lock).
2. **Redis lock with a TTL** (Upstash Redis) — `SET key value NX PX <ttl>` for a short-lived, high-frequency lock (e.g., preventing two near-simultaneous Cron-triggered invocations of the same job from both proceeding), with the TTL long enough to outlive the expected handler duration but short enough that a crashed invocation's lock releases promptly and the next scheduled trigger can recover.

Both approaches are **fail-closed**: if the lock can't be acquired, the invocation does not proceed with the protected work — it exits cleanly (optionally recording a "skipped, another run in progress" event for observability), never silently races.

---

## Required job-record properties (every background job, no exceptions)

Every background job — whether triggered by Vercel Queues, Vercel Workflows, or Vercel Cron Jobs — is represented by a durable Postgres record conforming to `contracts/job-record.schema.json` and must support:

- **Stable job ID** — a UUID assigned at creation, independent of any queue-provider-internal message ID.
- **Idempotency key** — the natural key the handler upserts on (external ID for sync-adjacent work; a dashboard-internal action+actor+target key for UI-triggered actions — see `docs/implementation/gap-analysis.md` item 5's internal-action idempotency note).
- **Retries** — attempt count and the configured cap.
- **Timeout** — the maximum duration a single attempt is allowed, consistent with the invoking Function's own platform timeout.
- **Attempt history** — one row per attempt (or an append-only JSON array on the job record, schema's choice) with start time, end time, outcome.
- **Progress tracking** — a watermark/cursor/step-index column, advanced only after durable persistence of the corresponding work.
- **Heartbeat or step status where applicable** — for Vercel Workflows-orchestrated multi-step jobs, the current step name/index; for long Queue-driven batch jobs, a periodic progress update so a stalled job is distinguishable from a legitimately slow one.
- **Failure classification** — retryable vs. terminal (mirrors the base skill's `isRetryable` distinction in `nodejs/knowledge/integration/03-rate-limits-and-backoff.md`: a 429/503/timeout is retryable, a 400/validation error is terminal and should not burn retry attempts).
- **Failure logging** — structured (Pino), correlated by job ID, never swallowed (NODE-006).
- **Audit history** — job creation, each attempt, and the terminal outcome all produce audit events per `knowledge/10-data-ownership-and-audit.md`.
- **Safe retry** — a manually or automatically retried job re-runs the same idempotent handler against the same idempotency key; retrying never duplicates already-committed work.
- **Manual retry controls** — an operator can trigger a retry from the dashboard (Scan Center, Import/Export Center, Notification Center, Ready for Claude Queue's own retry affordance) without bypassing the idempotency guarantee.
- **Cancellation where technically safe** — a job that has not yet started irreversible external side effects can be marked cancelled; a job already mid-way through a non-cancellable external call completes and is not force-killed mid-write (killing mid-write is exactly the "watermark advanced before commit" failure mode the base skill's `security-baseline`/QA bug-severity guidance treats as P1-class data corruption).

`contracts/job-record.schema.json` formalizes this shape; `apps/dashboard-worker` handlers are built against it, not against an ad hoc per-job-type record structure.

---

## The adapter-interface rule

Vercel Queues and Vercel Workflows are accessed **only** through project-owned adapter interfaces in `packages/integrations/vercel/` — never called directly from business-logic code scattered across handlers. This mirrors the base skill's own ERP-adapter pattern (`nodejs/integrations/erp/_erp-adapter-pattern.md`) applied one layer down, to the job-execution provider itself, and is exactly the shape the dashboard's own `08_API_and_Integration_Contracts.md §8` already specifies:

```text
JobQueueAdapter.enqueue(jobType, payload, { idempotencyKey, ... })
JobQueueAdapter.cancel(jobId)
JobQueueAdapter.getStatus(jobId)
WorkflowAdapter.start(workflowType, input)
WorkflowAdapter.signal(workflowId, signal)
WorkflowAdapter.cancel(workflowId)
```

Business-logic code (in `dashboard-api` services or `dashboard-worker` handlers) calls these adapter methods, never the Vercel Queues/Workflows SDK directly. This means: (a) the fallback to Upstash QStash + Vercel Cron (below) is a change inside the adapter implementation only, not a rewrite of every caller; (b) tests can mock the adapter interface without standing up real Vercel infrastructure, consistent with the base skill's `testing/01-api-and-integration-tests.md` "mocks behind the adapter interface" pattern.

---

## Fallback trigger condition

Upstash QStash + Vercel Cron Jobs is the documented fallback for Vercel Queues/Workflows. The trigger condition for actually switching a given job type to the fallback path (rather than this being a permanent dual-implementation) is an **operational decision recorded at G5.5** (observability approval — the same gate that already requires runbooks to exist), not a per-job-type architectural choice made now: use the fallback when Vercel Queues/Workflows experiences a sustained outage or when a specific job's requirements (e.g., cross-region delivery guarantees, a specific retry semantic Vercel Queues doesn't offer) are better met by QStash. Record the actual trigger condition and the operational runbook for switching in the incident/queue-recovery runbook produced under `knowledge/11-retention-backup-and-operations.md`, once that operational detail is known — this file states that a fallback exists and is adapter-reachable; it does not pre-decide when to use it.

---

## Load testing under this model

`nodejs/knowledge/testing/02-load-and-chaos.md`'s k6/Artillery guidance assumed a persistent process under test. Under this model, load testing exercises: (a) `dashboard-api`'s Function endpoints directly (concurrency, cold-start latency under load, same k6/Artillery tooling, different target — a Functions endpoint instead of a long-lived Express/Nest server); (b) the queue/workflow throughput indirectly, by enqueuing at volume and measuring end-to-end job completion latency and watermark lag, since there's no worker process to attach a load-generator to directly. Chaos testing's fault-injection matrix (`testing/02`'s table — upstream 429/503, duplicate delivery, kill mid-run, DB connection drop) still applies; "kill the sync mid-run" becomes "a Function invocation times out or is recycled mid-handler," which the required job-record properties above (watermark advances only after persistence) already handle identically to a killed persistent-worker process.

---

## What this file does not cover

- NestJS-specific Vercel Functions cold-start mitigation for the request-serving API → `knowledge/03-nestjs-on-vercel.md`.
- GitHub/WordPress webhook-specific idempotency and dedupe (which reuses this file's job-record properties, applied to inbound webhook events specifically) → `integrations/github/`, `integrations/wordpress/`.
- Retention/backup for job records themselves once they age out → `knowledge/11-retention-backup-and-operations.md`.
