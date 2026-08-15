---
tier: 2
load_when: ["code-review-active", "code-review"]
description: How Code Review classifies findings P1–P4 (same scale as QA, so a review finding and a bug speak the same language), with Node/sync-specific examples and the PASS/FAIL rule.
---

# Severity Classification — Code Review

> Code Review uses the **same P1–P4 scale** as QA's bug severity (`qa-agent/02-bug-severity-matrix.md`, aligned to `_contracts/bug-tracker.schema.json`). One scale across the system means a review comment and a logged bug are directly comparable, and a finding that escapes review and becomes a defect carries the same label. P1/P2 **block the PR**; P3/P4 do not.

---

## The scale (review lens)

| Sev    | In a PR this means                                                                                                                                                                                                 | Blocks merge? |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| **P1** | The change will corrupt data, halt sync, expose a secret, bypass authz, ship a breaking API change to live consumers, or weaken a guardrail (delete a fitness test).                                               | **Yes**       |
| **P2** | A real defect or a clear architecture/standard violation: layering breach, DB outside repos, missing input validation, unbounded retry, swallowed error, CommonJS in ESM, an endpoint with the wrong status/shape. | **Yes**       |
| **P3** | Minor: `var`, `.then()` chain, deep nesting, missing JSDoc on an export, an avoidable dependency, kebab-case filename.                                                                                             | No            |
| **P4** | Polish: naming, comment quality, micro-readability.                                                                                                                                                                | No            |

PR status: **FAIL** if any P1 or P2 finding is open (or a sensitive path lacks the required senior review); **PASS** / **PASS-with-notes** otherwise.

---

## P1 — examples

- Hardcoded API key/token/secret in the diff. (also a secret-scan hit)
- Unvalidated request data flowing into an unparameterized query (injection).
- A breaking change to an existing `/api/v1` contract (field removed/renamed) with no new version — breaks the dashboards and any client integration.
- Watermark advanced **before** the batch commits in a sync job — guarantees gaps on crash.
- Authz check removed or weakened so a tenant can reach another tenant's data.
- A fitness test deleted or weakened.
- A destructive migration with no reversible down-path and no justification.

## P2 — examples

- Controller queries the DB directly / service imports `express` / raw SQL outside a repository (layering + fitness violation).
- A queue worker with no bounded retry or no DLQ.
- Missing HMAC verification or missing idempotency on a webhook handler.
- A floating (unawaited) promise in a sync path — dropped rejection loses work.
- Upstream failures collapsed to a blanket 500 instead of 502/503/504.
- New public route mounted without a version prefix.
- Empty `catch {}` hiding a failure.

## P3 — examples

- `var` instead of `const`/`let`; a `.then()` chain where `await` belongs.
- Deeply nested conditionals that should be guard clauses.
- A new dependency for something Node 22 does natively.
- Missing JSDoc on an exported function; non-kebab-case filename.

## P4 — examples

- A single-letter or unclear variable name.
- A comment restating the obvious; a micro-readability suggestion.

---

## Classification rules

1. **Match QA's lens for impact.** If the same defect would be a P1 bug in production, it's a P1 review finding. Don't soften a data-corruption risk to "P3 nit" because it's "just a small diff".
2. **Money raises a notch.** Anything touching orders/pricing escalates — a P2 ordering smell that could double-charge is P1.
3. **Guardrail changes are P1.** Deleting/weakening a fitness test or an authz check is P1 regardless of intent, and requires senior review.
4. **Standards-only nits are P3/P4.** `var`, JSDoc, naming — flag them, but they never block a merge on their own.
5. **When unsure between two levels, state the risk and pick the higher**, then let the human merger weigh it. Over-flagging a borderline P2 is cheaper than shipping a P1.

---

## Output coupling

Each finding in the PR comment carries its severity tag, the file:line, the rule reference (coding-standards section / fitness-test name / forbidden.md id), and a concrete fix. The PASS/FAIL status is derived purely from open P1/P2 count + sensitive-path review state. Recurring P1/P2 patterns are flagged as KB-update candidates so the next occurrence becomes a forbidden-pattern lint instead of a manual catch.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
