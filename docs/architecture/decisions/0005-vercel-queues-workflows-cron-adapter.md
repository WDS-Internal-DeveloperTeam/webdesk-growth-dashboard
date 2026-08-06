# ADR-0005 — Vercel Queues, Workflows, and Cron Adapter Architecture

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

Given ADR-0004's decision that `dashboard-worker` is a set of stateless handlers, something must trigger those handlers: message-queue delivery, multi-step workflow orchestration, and time-based scheduling. Vercel offers native primitives for all three, but their availability/maturity should not be treated as unconditionally guaranteed for the life of the project, so a fallback path is part of this decision, not an afterthought.

## Decision

- **Primary job provider:** Vercel Queues (message-triggered handlers) and Vercel Workflows (multi-step orchestration, e.g., a scan run's fetch → analyze → report sequence) for job types that need them, plus Vercel Cron for scheduled triggers (scheduled scans, retention sweeps).
- **Fallback job provider:** Upstash QStash (message delivery) + Vercel Cron, used if Vercel's native Queues/Workflows offering is unavailable or insufficient at implementation time. This fallback is recorded in `project.json.vercel_execution.fallback_job_provider` so the decision is visible in project state, not just in this document.
- Every handler (ADR-0004) is written against a thin internal adapter interface, not directly against the Vercel Queues/Workflows SDK — so switching from primary to fallback provider (if ever needed) means changing the adapter implementation, not every handler.

## Alternatives considered

- **Self-hosted Redis + BullMQ** — rejected: requires a persistent Redis instance and (per ADR-0004) a persistent worker process to consume it, both outside this project's Vercel-only hosting model.
- **AWS SQS/Step Functions** — rejected: introduces a second cloud provider and its own IAM/networking surface for no capability Vercel's own offering (or the Upstash fallback) doesn't already provide for this project's scale.

## Consequences

The adapter-interface layer (not calling the Vercel SDK directly from every handler) is extra structure up front, in exchange for not having to rewrite every handler if the fallback provider is ever needed.

## Security considerations

Queue/workflow trigger payloads are treated as untrusted input by each handler (per ADR-0004) — a compromised or malformed message must not be able to trigger unintended side effects merely by reaching the handler.

## Operational considerations

Retry behavior, dead-letter handling, and idempotency requirements differ between Vercel Queues/Workflows and the Upstash fallback — the adapter interface must normalize these differences so handler code doesn't need provider-specific retry logic. Exact retry/backoff configuration is a Phase 1 implementation detail, not decided here.

## Validation method

Reviewed against profile `knowledge/04-serverless-queues-workflows-and-cron.md` and `project.json.vercel_execution`.

## Approval gate

G1 (architecture approval).

## Related dashboard requirements

`01_Dashboard_Master_Specification.md`, `03_Detailed_Module_Specifications.md` (every module with a background-job component).

## Related skill rules

Profile `knowledge/04-serverless-queues-workflows-and-cron.md`; WDS-005.

## Open setup values

Whether Vercel Queues/Workflows are actually available and sufficient at Phase 1 implementation time is unconfirmed — tracked in `docs/project-state/setup-input-register.md`. If not sufficient, the Upstash QStash fallback is used instead, per this ADR — no further architecture decision needed if that happens, since the adapter interface already accounts for it.
