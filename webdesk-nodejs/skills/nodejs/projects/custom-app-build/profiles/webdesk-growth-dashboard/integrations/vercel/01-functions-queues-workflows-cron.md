---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work", "sync-engine", "backend-active"]
description: "Concrete adapter reference for Vercel Functions deployment of NestJS, and the JobQueueAdapter/WorkflowAdapter implementations against Vercel Queues, Vercel Workflows, and Vercel Cron Jobs, with the Upstash QStash fallback."
---

# Vercel — Functions, Queues, Workflows, Cron

> Concrete adapter reference. The resolved architecture decision, required job-record properties, and locking rules live in `../../knowledge/04-serverless-queues-workflows-and-cron.md` — read that first. This file is the implementation-level detail once that decision is taken as given.

---

## `dashboard-api` on Vercel Functions

- NestJS app wrapped for Vercel's Functions runtime (via the Node.js runtime, not Edge — Nest's DI container and most Node APIs it depends on are not Edge-runtime-compatible; **confirm Edge vs. Node runtime choice explicitly at scaffold**, defaulting to Node runtime unless a specific route has a confirmed Edge-compatible reason).
- Cold-start mitigation per `../../knowledge/03-nestjs-on-vercel.md` — module-level app-instance caching across warm invocations.
- Route handlers map Vercel's Function request/response shape to Nest's expected HTTP adapter interface (via `@nestjs/platform-express` or a serverless-specific Nest adapter — **verify current recommended approach at discovery**, since the Node.js serverless-framework ecosystem around Nest changes).

## `dashboard-worker` as Vercel Function handlers

No `server.js`. Each job type is a Vercel Function handler:

```ts
// apps/dashboard-worker/api/jobs/scan-run.ts (illustrative path — Vercel's file-based
// or explicit function-route convention, confirmed at scaffold)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { jobId, idempotencyKey } = parseAndValidate(req.body); // packages/validation schema
  const lock = await acquireLock(idempotencyKey); // Postgres or Redis, per knowledge/04
  if (!lock.acquired) return res.status(202).json({ skipped: true });
  try {
    await runScanHandler(jobId); // service-layer logic
    res.status(200).json({ status: "completed" });
  } catch (err) {
    await recordFailure(jobId, err); // job-record per contracts/job-record.schema.json
    res.status(err.retryable ? 503 : 200).json({ status: "failed", retryable: err.retryable });
  } finally {
    await releaseLock(lock);
  }
}
```

---

## `JobQueueAdapter` against Vercel Queues

```ts
// packages/integrations/vercel/src/queue-adapter.ts
export class VercelJobQueueAdapter implements JobQueueAdapter {
  async enqueue(jobType: string, payload: unknown, opts: { idempotencyKey: string }) { ... }
  async cancel(jobId: string) { ... }
  async getStatus(jobId: string): Promise<JobStatus> { ... }
}
```

Backed by the Vercel Queues SDK/API — **confirm current SDK surface at discovery**, since this is a newer Vercel product area more likely to change than the long-stable Functions runtime. The adapter is the only place that imports the Vercel Queues SDK directly.

## `WorkflowAdapter` against Vercel Workflows

```ts
export class VercelWorkflowAdapter implements WorkflowAdapter {
  async start(workflowType: string, input: unknown): Promise<{ workflowId: string }> { ... }
  async signal(workflowId: string, signal: unknown) { ... }
  async cancel(workflowId: string) { ... }
}
```

Multi-step, durable processes (e.g., the Case Study/Portfolio migration's staged sequence, or a multi-step WordPress reconciliation) are natural Workflow candidates — each step is a Function invocation, with Vercel Workflows durably tracking which step is next even across a redeploy mid-workflow. **Confirm current Vercel Workflows API surface at discovery.**

## Vercel Cron Jobs

Configuration-based (a `vercel.json`-style cron schedule, or the platform's current mechanism — **confirm at discovery**), each entry invoking a thin Function handler that typically calls `JobQueueAdapter.enqueue()` rather than doing substantial work inline (Cron invocations share Functions' execution-time bounds). Schedule expressions are set from the Dashboard Settings timezone at configuration time (`../../knowledge/04-serverless-queues-workflows-and-cron.md`'s timezone rule) — Vercel Cron's own schedule syntax is UTC-based, so the adapter/configuration layer converts the configured local time to its UTC cron expression, and re-converts when the Settings timezone changes.

---

## Upstash QStash fallback

`packages/integrations/vercel`'s adapters can be backed by either Vercel Queues/Workflows or Upstash QStash + Vercel Cron behind the same `JobQueueAdapter`/`WorkflowAdapter` interface — swapping the backing implementation is a change inside this package, not a rewrite of any caller. QStash's HTTP-callback model (QStash calls a dashboard endpoint on delivery, rather than a pull-based queue) requires its own signature-verification step (QStash signs its callback requests) — apply the same three-control webhook pattern (`nodejs/knowledge/security/04-webhook-security.md`) to QStash callbacks as to any other inbound webhook.

---

## verify-at-discovery checklist

- [ ] Current recommended NestJS-on-Vercel-Functions deployment approach (Node vs. Edge runtime, adapter library).
- [ ] Current Vercel Queues and Vercel Workflows SDK/API surface (newer product area, more likely to change).
- [ ] Vercel Cron Jobs configuration mechanism and schedule-expression timezone handling (UTC-based — confirm).
- [ ] Upstash QStash callback signature-verification mechanism.
- [ ] Vercel Functions' actual request-body size limit (feeds `../../knowledge/08-vercel-blob-and-file-handling.md`'s direct-upload threshold) and execution-time limit (feeds job-handler design — a handler must complete, or checkpoint its progress, within this bound).

See `pointers.md` for documentation anchors.
