---
tier: 2
load_when: ["code-review-active", "code-review"]
description: Node 22 / ESM review checklist aligned to the coding standards — layering (controllers/services/repositories), async/await, const/let, kebab-case files, early returns, centralized errors, env for secrets, input validation, minimal deps, JSDoc on exports. Each check has a severity.
---

# Node 22 / ESM Review Ruleset

> The checks the Code Review agent applies to every PR, aligned to `nodejs/knowledge/01-coding-standards.md` (blueprint §11). ESLint/Prettier catch the mechanical subset; this ruleset is for what a linter can't reliably judge — layering, hallucinated APIs, error handling, input validation, and dependency discipline. Default severities are listed; `03-severity-classification.md` is the authority if they conflict.

---

## 1. Layering — controllers / services / repositories (the big one)

The architecture is three layers; mixing them is the most common and most damaging violation.

- **Controllers = HTTP only.** Parse/validate the request, call a service, shape the response, map errors to status codes. **No business logic, no DB access.**
- **Services = business logic.** Orchestrate, apply rules, call repositories. **No `req`/`res`, no `express` import, no raw SQL.**
- **Repositories = DB access.** All Sequelize/SQL lives here. Nothing else queries the DB.

Findings:

- Controller runs a Sequelize/raw query → **P2** (move to a repository).
- Service imports `express` / touches `req`/`res` → **P2** (the service must be transport-agnostic).
- Raw SQL or a Sequelize model call outside a repository → **P2** (also a G5 fitness test — `no-db-outside-repos`).
- Business logic living in a controller (branching on domain rules, computing sync deltas) → **P3–P2** depending on weight.

This layering is enforced again as an architecture fitness test (`02-architecture-fitness-enforcement.md`) at G5 — catching it at the PR avoids a milestone bounce.

## 2. Async / await — no `.then()` chains

- `async/await` only; no `.then().catch()` promise chains. → **P3** (consistency + readability; `await` in a loop without need is a separate perf note).
- No floating promises — an `async` call whose rejection isn't awaited/handled. → **P2** (a dropped rejection in a sync job silently loses work).
- No mixing callbacks where a promise API exists (use `fs/promises`, not callback `fs`). → **P3**.

## 3. Variable declarations — `const`/`let`, never `var`

- `const` by default; `let` only when reassigning; **`var` is forbidden**. → `var` = **P3** (hard pattern; cheap to flag).

## 4. Filenames — kebab-case

- Files are kebab-case: `user-service.js`, `auth-controller.js`, `inventory-repository.js`. PascalCase/camelCase/snake_case filenames → **P3**.
- (Variables/functions stay `camelCase`; classes `PascalCase` — that's a naming check, not a filename check.)

## 5. Small functions, early returns, shallow nesting

- Prefer early returns over nested `if/else` pyramids. Deeply nested conditionals (≥ 3 levels) → **P3** with a suggested guard-clause refactor.
- A function doing several unrelated things → **P3** (split).

## 6. Centralized error handling — throw, don't `console.log`

- Errors are **thrown** (typed/`AppError`-style where the project has one) and handled by the centralized error middleware; do not `console.log` an error and continue. → swallowing/`console.log`-instead-of-throw = **P2**.
- No empty `catch {}` that hides failures. → **P2**.
- Errors map to the correct HTTP status at the boundary (validation → 400/422, authz → 401/403, upstream down → 502/503/504), not a blanket 500. → **P2** if upstream failures collapse to 500.

## 7. Input validation — validate all external input

- Every external input (request body/params/query, webhook payload, ERP/store response) is validated before use (a schema validator — zod/joi/ajv — at the boundary). Unvalidated input flowing into a query/service → **P2** (or **P1** if it reaches a query unparameterized).
- Webhook handlers verify HMAC and shape before acting. → missing = **P1/P2**.

## 8. Secrets from env, never in code

- Secrets/config come from environment variables (validated at startup); no hardcoded keys/tokens/URLs. → a hardcoded secret = **P1** (also a secret-scan finding).
- No secret logged. → **P1/P2**.

## 9. Minimal dependencies — prefer native Node

- Prefer native Node 22 APIs (`fetch`, `crypto`, `fs/promises`, `node:test` where apt) over adding a dependency. A new dependency for something the platform already does → **P3** with the native alternative; a heavy/unmaintained/duplicate dependency → **P2**.
- New dependencies are sanity-checked: maintained, reasonable transitive weight, no known CVE (cross-check OSV).

## 10. JSDoc on exports only

- Exported/public functions carry a JSDoc block (params, returns, throws). Internal helpers don't need it. Missing JSDoc on an export → **P3/P4**. Over-commenting obvious code → a style note, not a finding.

## 11. Hallucinated APIs

- Verify methods/options actually exist on the package version in `package.json` and on Node core. A called method that doesn't exist (e.g. a Sequelize option that was renamed, a non-existent `fetch` option) → **P1/P2** (it will throw at runtime). When unsure, say "verify this exists on `<pkg>@<version>`" rather than guessing.

## 12. ESM specifics

- `import`/`export`, not `require`/`module.exports`. → CommonJS in an ESM project = **P2**.
- Relative imports include the file extension where the project's resolver requires it; no `__dirname`/`__filename` assumptions without the ESM shim. → **P3**.

---

## Quick scan order (cheap → expensive)

1. Haiku-tier pattern scans: `var`, `.then(`, non-kebab filenames, `console.log(`-on-error, hardcoded-secret regex, `require(`.
2. Layering scan: DB imports in controllers, `express`/`req`/`res` in services, raw SQL outside repos.
3. Input-validation + error-handling review (needs judgment — Sonnet).
4. Hallucinated-API + dependency review (lookups; Sonnet, escalate to Opus if architectural).

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
