---
tier: 2
load_when: ["g5", "code-production", "scaffold", "qa-active", "pt-integration-middleware"]
description: "Architecture fitness tests — dependency-cruiser rules enforcing the layering and integration boundaries. Gated at G5."
---

# Architecture fitness tests

> These are _fitness functions_: automated checks that the codebase still obeys
> the architectural boundaries it was designed around, run in CI and **gated at
> G5** (Milestone regression + fitness + load/chaos). They turn the layering and
> integration rules from `knowledge/09-forbidden.md` into mechanical, unbypassable
> checks. A boundary violation fails the build — it is not a style nit.

## Boundaries enforced

1. **No DB access outside repositories (NODE-003).** Only files under
   `src/repositories/` (and `src/db/`) may import `sequelize` or the db module.
   A controller/service/job touching the DB directly bypasses tenant-scoping
   (NODE-104) and the transaction choke point — rejected.

2. **Controllers must not import repositories directly.** Controllers are
   HTTP-only. They go `controller → service → repository`. A controller importing
   a repository skips the business-logic layer — rejected.

3. **Services must not import controllers.** Dependencies point inward
   (controller → service → repository), never back out. A service importing a
   controller is a cycle and a layering inversion — rejected.

4. **No ERP SDK in the sync engine.** The sync engine (`src/integrations/engine/`)
   must never import an ERP SDK (`src/integrations/erp/*/sdk`). The whole point of
   the ERP adapter pattern is that ERP-specific transport stays inside the
   adapter; the engine talks only to the common interface. An engine import of an
   ERP SDK re-couples them — rejected.

5. **Queue retry caps.** Retries must be bounded with a DLQ (NODE-101). The cap
   itself comes from the integration contract's `retry_policy` and is asserted by
   a runtime/unit test (dependency-cruiser checks the structural boundary; a
   companion node:test asserts the configured cap is finite and a DLQ handler is
   wired). Unbounded retry config fails the suite.

6. **API-version pin enforcement.** Each integration pins its `api_version` from
   the contract (e.g. BigCommerce `v3`). A companion test asserts no adapter
   issues a request without the pinned version segment, so a silent upstream
   version bump can't slip through.

7. **No orphans (warn).** Modules imported by nothing are flagged (warn, not
   error) so dead code is surfaced for review.

Boundaries 1–4 and 7 are expressed as **dependency-cruiser** rules in
`dependency-cruiser.config.cjs`. Boundaries 5–6 are structural intentions that
dependency-cruiser can't see at runtime, so they're paired with node:test
assertions in `tests/architecture/` (write these alongside the cruiser config at
scaffold).

## Tooling

We use [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser)
because it validates the _import graph_ statically — fast, no app boot required,
and the rules read like the boundaries above.

## How to run

```bash
# one-off (devDependency; pin at scaffold)
npx depcruise src --config templates/architecture-tests/dependency-cruiser.config.cjs

# add to package.json scripts:
#   "arch:test": "depcruise src --config architecture-tests/dependency-cruiser.config.cjs"
npm run arch:test

# companion runtime assertions (retry caps, api-version pin):
node --test tests/architecture/
```

Wire `npm run arch:test` (plus the companion node:test run) into CI. The job must
be **required to pass before G5** — a red fitness test blocks the milestone, the
same way a failing regression suite does.

Last reviewed: 2026-06-30 by Claude (initial build)
