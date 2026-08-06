# Proposed Patch 03 — Generic Vercel Functions Deployment Guidance

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

The base skill's health-endpoint and graceful-shutdown guidance (`nodejs/knowledge/backend/01-runtime-and-frameworks.md`) assumes a persistent process. Vercel Functions is an increasingly common deploy target the base skill has no answer for at all — not host-specific config, but a structurally different execution model (cold starts, no long-lived process to signal, serverless-aware DB connection pooling).

## Current gap

`_contracts/project-json.schema.json`'s `host_target` enum (`local|aws|gcp|cloudflare|heroku|vps`) has no serverless-Functions-style option at all (see Patch 09 for the schema addition specifically). No knowledge file addresses cold-start mitigation, serverless connection pooling, or the "no shutdown sequence to port" distinction this project's `knowledge/03-nestjs-on-vercel.md` had to work out from scratch.

## Proposed files changed

- **New:** `nodejs/knowledge/backend/05-serverless-functions.md` — cold-start mitigation patterns (warm-instance caching), serverless-aware DB pooling guidance (generic — "match your database provider's serverless pooling recommendation," not Vercel-Postgres-provider-specific), and an explicit statement that `backend/01`'s graceful-shutdown sequence does not apply to a Functions deployment target.
- **Edit:** `nodejs/knowledge/backend/01-runtime-and-frameworks.md` — add a short "Note: this section assumes a persistent process. For serverless/Functions deployment targets, see `05-serverless-functions.md`" callout at the top of the graceful-shutdown section, so a reader hits the fork explicitly rather than silently porting inapplicable guidance (the exact failure mode this project's Scenario Test B in `tests/scenario-tests.md` was written to catch).

## Compatibility impact

Additive to `backend/01` (a callout, not a rewrite); the persistent-process guidance remains unchanged and fully valid for that deployment target.

## Regression risk

Low. The edit to `backend/01` is a single added paragraph; no existing content is removed or altered.

## Reusability scope

**Generally reusable** — Vercel Functions (and serverless deployment generally) is a mainstream Node.js deployment target well beyond this one project.
