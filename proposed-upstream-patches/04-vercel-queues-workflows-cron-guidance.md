# Proposed Patch 04 — Generic Vercel Queues/Workflows/Cron Guidance

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

`nodejs/knowledge/integration/02-queues-and-jobs.md` presents exactly two options (node-cron, BullMQ+Redis), both assuming a persistent worker process. This project needed a third row — serverless queue/workflow providers (Vercel Queues/Workflows/Cron, but the pattern generalizes to AWS SQS+Step Functions+EventBridge, Cloudflare Queues, or any comparable managed serverless job platform) — worked out independently in `profiles/webdesk-growth-dashboard/knowledge/04-serverless-queues-workflows-and-cron.md`.

## Current gap

No serverless-queue row in `integration/02-queues-and-jobs.md`'s comparison table. No guidance anywhere on locking/overlapping-run-prevention **without** an in-process advisory lock (the base skill's overlapping-run guidance assumes a process that can hold a lock in memory or via a persistent connection) — this project's "Locking without a persistent process" section (Postgres row lock or Redis-TTL lock, both fail-closed) is new material with no prior base-skill analog.

## Proposed files changed

- **Edit:** `nodejs/knowledge/integration/02-queues-and-jobs.md` — add a third comparison-table row ("Serverless queue/workflow platform") alongside node-cron/BullMQ, and a new "Locking without a persistent process" subsection generalizing this project's Postgres-row-lock / Redis-TTL-lock pattern.
- **Edit:** `nodejs/knowledge/intelligence/integration-intelligence.md` — add a decision-support note: "when the deploy target has no persistent-process option, the queue/runtime decision is between managed serverless queue platforms, not node-cron vs. BullMQ."
- **New:** `nodejs/knowledge/integration/05-serverless-job-execution.md` (optional, if the addition to `02-queues-and-jobs.md` alone would push that file past its tier-2 size cap) — the required job-record properties list (stable ID, idempotency key, retries, timeout, attempt history, progress, failure classification, audit history, safe/manual retry, cancellation), generalized from this project's `contracts/job-record.schema.json` narrative.

## Compatibility impact

Additive throughout. The existing node-cron/BullMQ guidance and NODE-101/NODE-102 remain unchanged — this patch adds a third path satisfying the same non-negotiable properties, it does not relax them.

## Regression risk

Low-medium. `integration/02-queues-and-jobs.md` is a tier-2 file with an existing size — confirm the addition doesn't exceed its cap (per `tools/scripts/validate-frontmatter.py`); split into the optional new file above if needed.

## Reusability scope

**Generally reusable** — serverless job execution is not a Vercel-specific or WebDesk-specific pattern; the required-properties list and locking guidance apply to any serverless queue provider.
