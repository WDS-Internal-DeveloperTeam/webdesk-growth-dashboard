# ADR-0004 — Dashboard Worker Decomposition into Serverless Handlers

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard needs background job processing (scan runs, scheduled scans, notification dispatch, import/export processing, retention jobs). A conventional Node.js background-worker pattern (a single long-running process consuming from a queue, e.g., BullMQ's `Worker`) is the base skill's documented default — and is explicitly incompatible with Vercel's execution model, which has no persistent process. This is the single most consequential architecture decision in the whole project: getting it wrong means every job-handling module built afterward is built on the wrong foundation.

## Decision

`dashboard-worker` is not a process — it is a collection of stateless Vercel Function handlers, each triggered by one of: a Vercel Queue message, a Vercel Workflow step, or a Vercel Cron invocation. Every "job type" (scan run, notification dispatch, retention sweep, etc.) is a separate handler function, not a case branch inside a single generic worker loop. This is restated as an absolute forbidden-action rule (WDS-005: never design or scaffold `dashboard-worker` as a permanent process) precisely because it is the decision most likely to be violated by default framework instincts (e.g., a developer reaching for `new Worker(...)` from BullMQ out of habit).

## Alternatives considered

- **BullMQ `Worker` on a small persistent VM alongside Vercel-hosted `dashboard-web`/`dashboard-api`** — rejected: reintroduces a persistent process to operate/scale/patch, contradicting the Vercel-only hosting requirement, and splits the deployment story across two hosting models for no clear benefit.
- **A single generic "run any job type" Vercel Function with an internal switch statement** — rejected: loses per-job-type observability (all job types would share one function's logs/metrics/scaling behavior) and makes per-job-type timeout/memory tuning impossible.

## Consequences

Every new job type requires its own handler function and its own entry in the queue/workflow/cron adapter configuration (ADR-0005) — more initial setup per job type than a generic worker loop, in exchange for per-job-type scaling, observability, and failure isolation (one job type's failures don't affect another's).

## Security considerations

Each handler validates its own trigger payload independently (no shared, implicitly-trusted "the worker validated this already" assumption that a monolithic worker loop might create).

## Operational considerations

Job-type-specific Vercel Function configuration (memory, timeout) becomes possible and is expected — a scan-run handler and a notification-dispatch handler have different resource needs and should not share one configuration by default.

## Validation method

Reviewed against profile `knowledge/04-serverless-queues-workflows-and-cron.md` and WDS-005.

## Approval gate

G1 (architecture approval) — this ADR specifically should not be treated as routine; it is the project's highest-risk-if-wrong decision and deserves explicit reviewer attention.

## Related dashboard requirements

`01_Dashboard_Master_Specification.md`, `03_Detailed_Module_Specifications.md` (Scan Center, Notification Center, Import/Export modules all depend on this).

## Related skill rules

Profile `knowledge/04-serverless-queues-workflows-and-cron.md`; WDS-005 (absolute rule).

## Open setup values

None — the decision itself doesn't depend on unconfirmed setup values, though the Vercel Queues/Workflows provider configuration (ADR-0005) does.
