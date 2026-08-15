---
tier: 2
load_when: ["code-review-active"]
description: "Output template."
---

# Review Comment Template

> One consolidated comment per review (not many small ones). Severity-tagged findings, file:line, referenced rule, concrete fix. PASS/FAIL is derived from open P1/P2 + sensitive-path review state.

---

## Comment structure

```markdown
# AI Code Review — [PASS | PASS_WITH_NOTES | FAIL]

**PR:** #[number] — [title]
**Reviewed:** [ISO timestamp]
**Findings:** [N] (P1: _ P2: _ P3: _ P4: _)

---

## Summary

[1–3 sentences: what was reviewed, overall finding.]

---

## Issues by Severity

### P1 ([count]) — must fix before merge

### P2 ([count]) — must fix before merge

### P3 ([count]) — recommended, non-blocking

### P4 ([count]) — informational

---

## Architecture Fitness

- [ ] boundaries (controller/service/repository): [PASS/FAIL]
- [ ] no-db-outside-repos: [PASS/FAIL]
- [ ] api-version-enforcement: [PASS/FAIL]
- [ ] queue-retry-caps: [PASS/FAIL]

## Sensitive Paths Touched (if any)

[Files matching auth / payments-PII / sync-write / migrations — name the required CODEOWNERS reviewer(s). Automated PASS is not sufficient here.]

## Verification (CI — run in parallel)

- [ ] ESLint + Prettier: [link]
- [ ] Unit + integration tests: [n/n]
- [ ] API contract tests (vs OpenAPI): [link]
- [ ] OSV-Scanner / npm audit: [0 high/critical?]
- [ ] Migration dry-run (if migrations touched): [link]

## Next Steps

[Specific actions.]

---

Reviewed by Code Review Agent v1.0 — does not auto-fix, does not merge.
```

---

## Individual finding format

````markdown
### [P2] Controller queries the DB directly — architecture / layering

**File:** `src/controllers/order-controller.js:38`

**Issue:**
The controller calls `OrderModel.findAll(...)` directly. DB access belongs in a repository; controllers are HTTP-only. This also fails the `no-db-outside-repos` fitness test (gated at G5).

**Code:**

```js
const orders = await OrderModel.findAll({ where: { tenantId } });
```
````

**Recommendation:**
Move the query into `order-repository.js` and call it from the service:

```js
// order-repository.js
export async function findOrdersByTenant(tenantId) {
  return OrderModel.findAll({ where: { tenantId } });
}
// order-controller.js
const orders = await orderService.listOrders(tenantId);
```

**Reference:** coding-standards §layering · fitness test `no-db-outside-repos` · `01-node-ts-ruleset.md` §1

````

---

## Example — FAIL

```markdown
# AI Code Review — FAIL

**PR:** #214 — feat: push pricing updates to BigCommerce
**Reviewed:** 2026-07-18T11:04:00Z
**Findings:** 3  (P1: 1  P2: 1  P3: 1)

---

## Summary
Reviewed the pricing push path (4 files, 196 lines). One P1 (watermark advanced before commit — will drop updates on crash) and one P2 (no idempotency on the store write — an overlapping run can double-apply). Sensitive path (sync write + pricing) — senior review required.

---

## Issues by Severity

### P1 (1) — must fix before merge

#### [P1] Watermark advanced before batch commit — sync-engine / data-integrity
**File:** `src/services/pricing-sync-service.js:71`

**Issue:**
`syncState.advance(cursor)` runs before the batch transaction commits. A crash between the two leaves the watermark ahead of committed data — the next run skips those SKUs (permanent staleness). This is the watermark-resume failure the chaos tests target.

**Code:**
```js
await syncState.advance(cursor);
await repo.upsertPrices(batch);   // commits AFTER the watermark moved
````

**Recommendation:**
Advance the watermark only after the write commits, inside/after the same transaction:

```js
await repo.withTransaction(async (tx) => {
  await repo.upsertPrices(batch, tx);
  await syncState.advance(cursor, tx);
});
```

**Reference:** Failure Scenario Library (watermark gap) · `qa-agent/01-qa-modules.md` Module 8 · forbidden.md candidate

---

### P2 (1) — must fix before merge

#### [P2] Store write is not idempotent — webhook/sync

**File:** `src/repositories/store-repository.js:52`

**Issue:**
`upsertPrices` keys on an auto-generated id, so an overlapping run / retry can write the same delta twice. Overlapping-run tests will fail.

**Recommendation:**
Key the upsert on the stable SKU + source revision; add a single-flight lock on the pricing-sync job so a slow run can't stack on the next tick.

**Reference:** `01-node-ts-ruleset.md` §7 · fitness `queue-retry-caps` (single-flight)

---

### P3 (1)

#### [P3] `.then()` chain — async style

**File:** `src/services/pricing-sync-service.js:44` — convert to `await`. Non-blocking.

---

## Architecture Fitness

- [x] boundaries: PASS
- [x] no-db-outside-repos: PASS
- [x] api-version-enforcement: PASS
- [ ] queue-retry-caps: **FAIL** (no single-flight on pricing-sync — see P2)

## Sensitive Paths Touched

- `src/services/pricing-sync-service.js`, `src/repositories/store-repository.js` — **sync write-path + pricing**.
  Senior review required per CODEOWNERS: @tech-lead, @senior-backend. Automated PASS is not sufficient.

## Verification

- [x] ESLint + Prettier: PASS
- [ ] Unit + integration: 38/40 (2 overlapping-run tests failing)
- [x] OSV-Scanner: 0 high/critical

## Next Steps

1. Fix P1 (commit-then-advance) and P2 (idempotent upsert + single-flight).
2. Re-run overlapping-run + watermark-resume tests.
3. Obtain senior review (sync write + pricing).
4. Re-request review.

---

Reviewed by Code Review Agent v1.0 — does not auto-fix, does not merge.

```

---

## Re-review update strategy

On new commits: update the **same** comment. Mark prior findings resolved (✓) or still-open, show what's new since the last review, and recompute PASS/FAIL. Don't spawn a new comment per push.

---

## Tone

Direct ("Move the query to a repository"), not deferential ("maybe consider…"). Specific (file:line + code), referenced (rule id), constructive (show the fix), brief (no padding).

---

## Anti-patterns

1. Many small comments instead of one consolidated comment.
2. No severity tags / no file:line / no references.
3. "Fix this" with no suggested fix.
4. Padding and buttering.
5. Not updating the comment on re-review.
6. Passing a sensitive-path PR on automated findings alone.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
```
