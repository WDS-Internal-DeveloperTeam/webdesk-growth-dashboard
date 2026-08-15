---
tier: 1
load_when: ["code-production"]
description: "CRITICAL — Node.js forbidden patterns (NODE-xxx). Read before writing or reviewing any code. Code Review loads this on every PR."
---

# 09 — Forbidden Patterns (Node.js)

> **READ THIS FIRST, before any code.** This is the highest-leverage file in the arm. Every NODE-xxx rule below is a Code Review reject. Cross-platform/process rules live in `_spine/shared-knowledge/forbidden-global.md`; Code Review loads both.

## How this file works

Each rule has an **ID** (cited in PR comments), a **severity** (P1 must-fix / P2 must-fix / P3 warn), **what** is forbidden, **why**, and the **right way**. IDs are stable — never renumber.

| Prefix     | Family                                   |
| ---------- | ---------------------------------------- |
| `NODE-0xx` | Core language, layering, errors, secrets |
| `NODE-1xx` | Integration, sync, queues, tenancy       |

---

## NODE-001 — Never use `var`

**Severity:** P2
**What:** No `var` anywhere in new code.
**Why:** `var` is function-scoped and hoisted, producing closure-capture and redeclaration bugs that block-scoped bindings prevent.
**Right way:** `const` by default; `let` only when the binding is reassigned.

```js
// bad
var total = 0;
for (var i = 0; i < n; i++) total += items[i];
// good
let total = 0;
for (const item of items) total += item.amount;
```

---

## NODE-002 — Never use `.then()`/`.catch()` chains in new code

**Severity:** P2
**What:** No promise chains; no mixing callbacks with promises.
**Why:** Chains nest, fork the error path, and silently drop rejections. `async/await` gives one linear flow and one `try/catch`.
**Right way:** `await` with `try/catch`. (`Promise.all` for genuine concurrency is fine — that's not a `.then` chain.)

```js
// bad
fetchOrder(id)
  .then((o) => push(o))
  .catch((e) => log(e));
// good
try {
  const order = await fetchOrder(id);
  await push(order);
} catch (err) {
  throw new SyncError("push failed", { cause: err });
}
```

---

## NODE-003 — Never access the database outside a repository

**Severity:** P1
**What:** No Sequelize model calls, raw SQL, or query builders in controllers, services, routes, or jobs. The only files that import models / run queries are under `repositories/` (and `db/`).
**Why:** Repositories are the single choke point where tenant-scoping, transactions, and query correctness are enforced. Leaking DB access elsewhere makes cross-tenant leaks and untested queries inevitable. Enforced by architecture fitness tests at G5.
**Right way:** Service calls a repository function; the repository owns the query.

```js
// bad — service reaching into the DB
const u = await User.findOne({ where: { email } }); // in a service
// good
const u = await userRepository.findByEmail(tenantId, email);
```

---

## NODE-004 — Never put secrets in code or logs

**Severity:** P1
**What:** No API keys, tokens, passwords, connection strings, or HMAC secrets hardcoded, committed, or written to logs (including error objects that embed credentials).
**Why:** Secrets in git/logs are permanently compromised and unrotatable in place; logs ship to aggregators with wider access.
**Right way:** Secrets come from env / a secret manager (`security/03-secrets-and-config.md`). Redact before logging.

```js
// bad
const erp = new ErpClient({ apiKey: "live_8f3a..." });
logger.info(`auth header ${req.headers.authorization}`);
// good
const erp = new ErpClient({ apiKey: requireEnv("ERP_DDI_API_KEY") });
logger.info({ userId }, "authenticated"); // no token in the log
```

---

## NODE-005 — Never trust unvalidated external input

**Severity:** P1
**What:** No use of request bodies, query/path params, headers, **or external API responses (ERP/store)** without schema validation at the boundary.
**Why:** Untrusted input drives injection, type-confusion, and corrupt-sync bugs. ERP/store responses are _external_ — their shape can change or be partial; treat them as untrusted, not as a contract you can assume.
**Right way:** Validate with a schema (`zod`/`joi`) before the data reaches a service; reject or quarantine on mismatch.

```js
// bad — assuming the ERP returned what you expect
const qty = erpResponse.item.inventory.onHand;
// good
const item = ErpItemSchema.parse(erpResponse.item); // throws → handled centrally
const qty = item.inventory.onHand;
```

---

## NODE-006 — Never swallow errors / empty catch

**Severity:** P1
**What:** No empty `catch {}`, no `catch (e) {}` that discards, no catching only to `return null`/continue without recording it.
**Why:** Swallowed errors turn failures into silent data corruption — the worst failure mode in a sync system, because it's invisible until reconciliation diverges.
**Right way:** Handle, rethrow (wrapped, preserving `cause`), or route to the DLQ. Always record it.

```js
// bad
try {
  await sync();
} catch (e) {
  /* ignore */
}
// good
try {
  await sync();
} catch (err) {
  logger.error({ err, entity }, "sync run failed");
  throw err;
}
```

---

## NODE-007 — Never use `console.log` for error handling

**Severity:** P2
**What:** No `console.log`/`console.error` as the error strategy, and no `console.*` in production request/job paths.
**Why:** `console` has no levels, no structure, no correlation IDs, and bypasses the centralized handler and log pipeline (G5.5 observability).
**Right way:** Throw typed errors to the centralized handler; use the structured logger (`pino`) with context. `console` is for throwaway local scripts only.

---

## NODE-008 — Never fabricate an API endpoint or field (verify-at-discovery)

**Severity:** P1
**What:** No coding an external endpoint path, auth scheme, field name, pagination, or rate limit "from memory." This applies especially to ERP APIs (DDI Inform, Sage, NetSuite, etc.).
**Why:** Inventing API surface produces code that compiles and fails in production. ERP API surfaces are partner-gated and vary; assumptions are how middleware projects bleed hours. The blueprint makes this structural via the G-Contracts gate.
**Right way:** Verify against real docs / a sandbox at discovery; record it in the integration contract (`integration-contracts/`). If unverified, **stop and flag it** — build against a mock behind the adapter interface, never against a guessed real endpoint.

---

## NODE-009 — Never block the event loop with sync I/O in the request path

**Severity:** P2
**What:** No `fs.readFileSync`, `crypto.*Sync`, synchronous `execSync`, or CPU-heavy synchronous loops inside a request handler or hot job tick.
**Why:** Node is single-threaded per process; sync I/O stalls every concurrent request, collapsing throughput under load (caught by G5 load tests).
**Right way:** Use the async APIs (`node:fs/promises`, async crypto); move CPU-heavy work to a worker thread or a queued job.

```js
// bad — in a request handler
const cfg = JSON.parse(fs.readFileSync("./big.json"));
// good
const cfg = JSON.parse(await fs.promises.readFile("./big.json", "utf8"));
```

---

## NODE-101 — Never use unbounded retries

**Severity:** P1
**What:** No retry loop without a cap, no immediate/fixed-interval retry storm, no retry without an eventual dead-letter path.
**Why:** Unbounded or tight retries amplify an upstream outage into a self-inflicted DoS and a hung job, and hide the failure instead of surfacing it.
**Right way:** Cap attempts + exponential backoff with jitter + a **DLQ** for exhausted items (`integration/02-queues-and-jobs.md`, `integration/03-rate-limits-and-backoff.md`).

```js
// good
await retryWithBackoff(() => store.push(order), {
  retries: 5,
  baseMs: 500,
  factor: 2,
  jitter: true,
  onExhausted: (e) => dlq.add(order, e),
});
```

---

## NODE-102 — Never write non-idempotent webhook/sync handlers

**Severity:** P1
**What:** No handler that produces a different result when the same webhook or sync record is delivered twice.
**Why:** At-least-once delivery is the norm (stores resend; cron runs overlap watermarks). Non-idempotent handlers double-create orders, double-decrement inventory, and corrupt reconciliation.
**Right way:** Dedupe on a stable external ID / event ID; upsert keyed on the external key; track processed IDs. See `integration/02-queues-and-jobs.md`, `security/04-webhook-security.md`.

```js
// good — upsert keyed on the external id, not a blind insert
await orderRepository.upsertByExternalId(tenantId, payload.id, mapped);
```

---

## NODE-103 — Never store tokens unencrypted

**Severity:** P1
**What:** No persisting OAuth tokens, refresh tokens, ERP/store credentials, or webhook secrets as plaintext in the DB.
**Why:** A DB read (backup leak, SQLi, insider) then yields live credentials for the client's ERP and store. Refresh tokens are long-lived and high-value.
**Right way:** Encrypt at rest with a KMS-managed key (or app-level AES-GCM with the key in a secret manager), decrypt only in memory at use. Never log the decrypted value. See `security/03-secrets-and-config.md`.

---

## NODE-104 — Never run a cross-tenant query without tenant scope

**Severity:** P1
**What:** No repository query against a tenant-owned table that omits `tenant_id` in the `where`. The single exception is the **master/super-admin** scope, which must be explicit and audited.
**Why:** This system is per-client + master (blueprint §8). One unscoped query leaks one client's data into another's dashboard — the most damaging bug class here.
**Right way:** Every repository function takes `tenantId` and includes it in the filter; a default scope / hook enforces it; the master scope is a separate, explicit code path. See `database/03-multi-tenancy.md`.

```js
// bad
return Order.findAll({ where: { status } });
// good
return Order.findAll({ where: { status, tenantId } });
```

---

## Code Review checklist (quick scan)

- [ ] No `var`; `const`/`let` only (NODE-001)
- [ ] No `.then` chains (NODE-002)
- [ ] No DB access outside `repositories/` (NODE-003)
- [ ] No secrets in code/logs; redaction in place (NODE-004)
- [ ] All external input + ERP/store responses validated (NODE-005)
- [ ] No empty/swallowing catch (NODE-006)
- [ ] No `console.*` error handling in prod paths (NODE-007)
- [ ] No fabricated external API surface; contract verified (NODE-008)
- [ ] No sync I/O in request/hot path (NODE-009)
- [ ] Retries capped + backoff + DLQ (NODE-101)
- [ ] Webhook/sync handlers idempotent (NODE-102)
- [ ] Tokens encrypted at rest (NODE-103)
- [ ] Every tenant-owned query scoped by `tenant_id` (NODE-104)
