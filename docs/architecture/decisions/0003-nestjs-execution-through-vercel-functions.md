# ADR-0003 — NestJS Execution Through Vercel Functions

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

NestJS is conventionally deployed as a long-running server process (`nest start`). Vercel's execution model has no persistent worker process — every request is served by a stateless serverless Function with a bounded execution time. These two models must be reconciled before any NestJS code is written, since the reconciliation approach affects how every module is structured (no in-memory state that must survive across requests, no background timers inside the API process, etc.).

## Decision

Run `dashboard-api` as a NestJS application bootstrapped inside a Vercel Function handler (using a Vercel-compatible Nest adapter that wraps the Nest HTTP adapter in a serverless-compatible request handler), not as a long-running `nest start` process. Every NestJS module must be written assuming:

- No in-memory state survives between invocations (no in-process caches relied on for correctness — use the database or an external cache if state must persist).
- No `setInterval`/`setTimeout`-based background work inside `dashboard-api` — recurring work is Vercel Cron + `dashboard-worker` (see ADR-0004/0005), never a timer living inside the API process.
- Cold-start latency is a real, measurable cost or a warm-lambda/edge strategy must be evaluated at Phase 1 — not solved by this ADR, but the constraint is recorded so Phase 1 doesn't discover it late.

## Alternatives considered

- **A traditional long-running NestJS server on a non-Vercel host (e.g., a small VM)** — rejected: contradicts the Master Specification's Vercel hosting requirement and reintroduces the operational burden (patching, scaling, uptime) Vercel is meant to remove.
- **Rewriting the API in a framework designed natively for serverless (e.g., raw Vercel Functions with no framework)** — rejected: loses NestJS's module/DI structure, which is valuable for a codebase of this module count, for a marginal cold-start improvement that hasn't been shown to matter yet.

## Consequences

Every module author must internalize "no persistent in-memory state" as a hard constraint from day one of Phase 1 — this is the single most consequential constraint from the serverless execution model and the one most likely to be silently violated by a developer used to traditional NestJS deployment.

## Security considerations

No change to NestJS's own request-level security model (guards, interceptors); the main new consideration is ensuring secrets are loaded per-invocation from environment variables (Vercel's own secret injection), not from a long-lived in-process cache that could go stale after a secret rotation.

## Operational considerations

Function cold starts, execution time limits, and concurrent-invocation scaling are all Vercel-managed — no capacity planning needed the way a traditional server would require, but execution-time-limit-aware design (no long-running synchronous work inside a single request handler) is required.

## Validation method

Reviewed against profile `knowledge/03-nestjs-on-vercel.md` and `knowledge/04-serverless-queues-workflows-and-cron.md`.

## Approval gate

G1 (architecture approval).

## Related dashboard requirements

`01_Dashboard_Master_Specification.md` (Vercel hosting requirement).

## Related skill rules

Profile `knowledge/03-nestjs-on-vercel.md`; WDS-005 (no permanent worker process).

## Open setup values

The exact Vercel Function memory/duration configuration for `dashboard-api` is a Phase 1 setup value, not yet chosen.
