---
tier: 2
load_when: ["code-review-active", "code-review", "g5"]
description: The architecture fitness tests Code Review enforces at PRs and that gate at G5 — controller/service/repository boundaries, no DB access outside repositories, API-version enforcement, queue retry caps. How each is written and what a violation looks like.
---

# Architecture Fitness Enforcement

> Fitness tests are executable assertions about the architecture's shape — they fail the build when a boundary is crossed. They live in `architecture-tests/` and run in CI. Code Review enforces them at the **PR** level (catch it early); they **gate at G5** (the milestone can't pass with a fitness regression). The four required fitness tests are: boundaries, no-DB-outside-repos, API-version enforcement, and queue retry caps. A PR that introduces a violation is at least P2; a PR that _deletes or weakens_ a fitness test is P1 (you don't get to turn off the smoke detector).

---

## Why fitness tests (not just code review)

Code review is human/AI judgment and drifts; a fitness test is deterministic and permanent. The layering rules in `01-node-ts-ruleset.md` are _also_ encoded as fitness tests so the architecture can't erode silently between reviews. Code Review's job here is twofold: (1) confirm the PR doesn't break an existing fitness test, and (2) confirm new architecture comes with its fitness test.

Tooling: dependency-cruiser (import-boundary rules) and/or a custom `node:test` suite that statically scans the source tree, plus runtime assertions for the queue cap. Keep them fast — they run on every PR.

---

## Fitness test 1 — controller/service/repository boundaries

**Rule:** controllers may import services; services may import repositories; nobody imports "upward". Controllers never import repositories directly; services never import the HTTP layer (`express`, `req`/`res`).

**How (dependency-cruiser sketch):**

```
forbidden:
  - name: no-controller-to-repository
    from: { path: "^src/controllers" }
    to:   { path: "^src/repositories" }
  - name: no-service-to-http
    from: { path: "^src/services" }
    to:   { path: "node_modules/express|^src/controllers" }
```

**Violation:** `order-controller.js` imports `order-repository.js` directly (skipping the service). PR finding **P2**; G5-blocking if unresolved.

## Fitness test 2 — no DB access outside repositories

**Rule:** Sequelize models / raw SQL / the DB client are imported and called **only** inside `src/repositories/**`. No controller, service, job, or util queries the DB.

**How:**

```
forbidden:
  - name: no-db-outside-repos
    from: { pathNot: "^src/repositories" }
    to:   { path: "^src/db|^src/models|sequelize" }
```

(plus a source scan for raw SQL strings / `sequelize.query(` outside repositories.)

**Violation:** a cron job in `src/jobs/inventory-sync.js` calls `InventoryModel.findAll(...)` directly. **P2**. This is the most common erosion — sync jobs reaching into the DB to "save a hop". File it.

## Fitness test 3 — API-version enforcement

**Rule:** all public API routes are mounted under a version prefix (`/api/v1/...`); no unversioned public route ships. Breaking changes go to a new version, they don't mutate `v1` in place.

**How:** a test that enumerates the registered routes (or scans the router definitions) and asserts every public route matches `^/api/v\d+/`. Optionally assert the OpenAPI `servers`/`info.version` matches the mounted prefix.

**Violation:** a new route added at `/api/items` (no version). **P2**. A breaking change to an existing `v1` contract (field removed/renamed) without a new version → **P1** (it breaks live consumers — the dashboards and any client integration).

## Fitness test 4 — queue retry caps

**Rule:** every queue/job processor declares a **bounded** retry policy (max attempts + backoff) and a **dead-letter** destination. No infinite retry, no silent drop.

**How:** a test that inspects each queue/worker registration and asserts `attempts` is set and finite, a backoff strategy is present, and a DLQ/failed-handler is wired. For `node-cron` simple schedules, assert a single-flight lock + a bounded internal retry.

**Violation:** a BullMQ worker with no `attempts` (defaults can mean effectively unbounded for the project's config) or no failed-job handler → **P2**. An unbounded `while(true)` retry loop → **P1** (it can hammer a downed ERP and never give up — the chaos tests will also catch this, but Code Review catches it first).

---

## What Code Review does on each PR

1. Run the fitness suite against the PR branch. Any **newly failing** fitness test → the finding's severity is the test's severity above; the PR is FAIL.
2. If the PR adds new architecture (a new layer interaction, a new queue, a new API version), confirm a fitness test covers it. Missing coverage for new architecture → **P3** ("add a fitness test for X").
3. If the PR **modifies or deletes** a fitness test, treat it as sensitive (it changes the system's guardrails) → **P1**, and flag for senior human review per `04-sensitive-paths.md`. Weakening a guardrail is never a silent change.
4. Record the fitness result in the review comment's Verification block and in `audit_log`.

---

## At G5

QA confirms the full fitness suite is green for the milestone as part of the G5 regression (`qa-agent/01-qa-modules.md`). Code Review's PR-level enforcement is what keeps the suite green between milestones so G5 isn't a cliff. A fitness regression discovered at G5 means PR-level enforcement was bypassed — that's a process finding, logged for the delivery review.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
