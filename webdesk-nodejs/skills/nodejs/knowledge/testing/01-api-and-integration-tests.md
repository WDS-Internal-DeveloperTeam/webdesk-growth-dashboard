---
tier: 2
load_when: ["code-production", "qa-active", "integration-work"]
description: "Node test stack for API contract + integration tests — node:test/vitest, supertest, contract tests vs ERP/store sandboxes, idempotency/replay, sync parity."
---

# Testing 01 — API & Integration Tests

> The test stack and what QA verifies at G4 (sprint) and G5 (milestone). Aligns with the QA agent modules (blueprint §7). Prefer native tooling; reach for more only when needed.

---

## Stack

- **Test runner:** **`node:test`** (native, no dependency) for unit + most integration tests. **vitest** only when you need its features (rich mocking, watch UX, coverage ergonomics, ESM edge cases). One runner per repo.
- **HTTP assertions:** **`supertest`** against the Express app (imported without binding a port — `backend/01`).
- **DB:** a **disposable Postgres** (Docker Compose / Testcontainers), migrated fresh, seeded with fixtures (`database/02`). Never test against a shared/real DB.
- **External systems:** **sandboxes** where they exist (BigCommerce/Shopify dev stores, an ERP test company) for true contract tests; **mocks behind the adapter interface** otherwise (`integrations/erp/_erp-adapter-pattern.md`).

---

## Layers of test

| Layer          | What                                                    | Tool                     |
| -------------- | ------------------------------------------------------- | ------------------------ |
| Unit           | services, mappers, `lib/` helpers in isolation          | node:test                |
| Repository     | queries incl. **tenant scoping** against a real test DB | node:test + test DB      |
| API / contract | routes via HTTP: status codes, validation, authz        | supertest                |
| Integration    | adapter ↔ sandbox/mock; sync tick end-to-end            | node:test + sandbox/mock |

---

## API contract tests

Assert the full contract, not just the happy path:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../src/app.js";

test("GET /api/v1/users requires the users:view permission", async () => {
  const app = buildApp();
  const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${noPermToken}`);
  assert.equal(res.status, 403); // RBAC enforced server-side (security/02)
});

test("POST /api/v1/users rejects invalid email with 422", async () => {
  const res = await request(buildApp())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: "nope" });
  assert.equal(res.status, 422); // input validation (NODE-005)
});
```

Cover: every status code the route can return (incl. **502/503/504** for upstream ERP/store failures — blueprint §9), authz denials, validation failures, and tenant isolation (tenant A can't read tenant B — `database/03`).

---

## Webhook idempotency & replay (blueprint §7)

```js
test("duplicate webhook delivery is idempotent", async () => {
  const payload = orderWebhookFixture();
  await deliver(payload); // first
  await deliver(payload); // replay — same signature
  assert.equal(await orderRepo.countByExternalId(tenantId, payload.id), 1); // NODE-102
});
test("webhook with bad HMAC is rejected 401", async () => {
  const res = await deliverRaw(body, { signature: "wrong" });
  assert.equal(res.status, 401); // security/04
});
```

---

## Sync engine tests (the load-bearing ones)

- **Data-integrity / sync parity:** after a sync, source and target agree for the entity (counts + field-level on a sample).
- **Watermark resume:** kill a run mid-way, restart, assert it resumes from the watermark and processes the unfinished tail exactly once (blueprint §7, `integration/01`).
- **Overlapping-run prevention:** trigger a second tick while one is in progress, assert it skips/coalesces — no concurrent run, no double-processing (`integration/02`).
- **Missed-run catch-up:** advance time past several intervals, assert the next tick catches up via the watermark (not a wall-clock replay).
- **DLQ:** a terminal-error record lands in the DLQ and is replayable; a retryable error retries with backoff then succeeds.

---

## CI wiring (blueprint §19)

Install (`npm ci`) → lint → typecheck → **test** → audit (OSV/`npm audit`) → **migration dry-run**. Tests run against the Compose test DB + mocks. Integration tests that need a sandbox are tagged and run where credentials are available, not on every PR.
