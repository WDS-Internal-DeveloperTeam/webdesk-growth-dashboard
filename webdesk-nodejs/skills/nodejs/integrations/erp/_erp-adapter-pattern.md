---
tier: 2
load_when:
  ["integration-work", "integration-erp-active", "sync-engine", "g1_5", "g_contracts", "planning"]
description: "THE ERP adapter pattern — one common pull/push/normalize/sync-state interface every ERP plugs behind. The interface matters more than any single ERP because the ERPs differ enormously. Maps to integration-contract.schema.json."
---

# ERP Adapter Pattern — the load-bearing interface

> This is the single most important file in `integrations/erp/`. The WebDesk middleware syncs a store (BigCommerce/Shopify) against an ERP that is the **system-of-record** for items, inventory, and pricing. The ERPs on the roadmap (DDI Inform pilot → Fishbowl, Sage 300, Sage 100, NetSuite, Acctivate, pc/MRP) differ wildly — REST/JSON, SOAP, RESTlets, Web API + COM/ODBC, FoxPro files, partner-gated web services. **We do not let those differences leak into the sync engine.** Every ERP implements one common interface; the engine is written once against it; each ERP differs only inside its adapter.
>
> Read this before `ddi-inform.md` or any roadmap stub. Read with `knowledge/integration/01-sync-strategies.md` (the engine), `knowledge/intelligence/integration-intelligence.md` (pattern choice), `knowledge/intelligence/failure-scenario-library.md` (pre-flight), and `_contracts/integration-contract.schema.json` (the contract each adapter config maps to).

---

## 1. Why the interface beats any single adapter

The temptation is to learn DDI Inform deeply and write the pilot against it. That is the trap that produces unportable code. The ERPs share almost nothing at the wire level:

| ERP        | Likely transport (verify at discovery)                                       |
| ---------- | ---------------------------------------------------------------------------- |
| DDI Inform | partner/credential-gated web services / Inform API — poll/cron, not webhooks |
| NetSuite   | SuiteTalk REST + SOAP + RESTlets + SuiteQL — strongest, well-documented      |
| Fishbowl   | REST/JSON (Fishbowl Advanced) + a legacy JSON/CSV-over-TCP API               |
| Sage 300   | Web API (HTTP/JSON, Swagger) + older COM/.NET/ODBC                           |
| Sage 100   | provider/object-model / ODBC — verify                                        |
| Acctivate  | API + SQL/ODBC — verify                                                      |
| pc/MRP     | **no real REST API** — FoxPro VFP files via ODBC; highest risk               |

What they share is the **shape of the problem**: pull business records since a watermark, normalize them to a canonical model, push canonical records back, track where we are, prove we're healthy. That shape is the interface. Build it right and adding the next ERP is "write an adapter," not "re-architect the sync engine." Build it wrong and every ERP is a rewrite — which is exactly the failure this system exists to prevent.

**Rule:** the sync engine, reconciliation, queueing, and dashboard NEVER import an ERP SDK or reference an ERP-specific field. They only touch the interface below and the canonical model.

---

## 2. The interface

Every ERP adapter is a class/module implementing this contract. Signatures are canonical; types are illustrative (plain JS + JSDoc, ES Modules per `09-forbidden.md`).

```js
// integrations/erp/<erp>/adapter.js
/**
 * @typedef {'items'|'inventory'|'customers'|'orders'|'pricing'|'categories'|'shipments'} Entity
 */

export class ErpAdapter {
  /** Static capability flags — the engine reads these to decide behavior. */
  static capabilities = {
    auth: "unknown", // 'api-key'|'oauth2'|'basic'|'token'|'mtls'|'vpn+credential'|'unknown'
    supportsWebhooks: false, // ERPs are almost always false — they are poll/cron
    supportsIncremental: false, // true if a usable modified-since watermark exists
    supportsPush: false, // can we write back (orders, etc.)?
    entities: [], // which Entity[] this adapter actually covers
    pagination: "unknown", // 'page'|'cursor'|'offset'|'link-header'|'none'|'unknown'
    rateLimits: null, // null until VERIFIED — never invent
  };

  /**
   * Read records FROM the ERP for one entity, changed since the watermark.
   * @param {Entity} entity
   * @param {string|null} sinceWatermark  ISO timestamp / opaque cursor; null = full sync
   * @param {{ signal?: AbortSignal, pageSize?: number }} [opts]
   * @returns {AsyncIterable<RawRecord>}   stream/paginate; do NOT buffer the whole ERP in memory
   */
  async *pull(entity, sinceWatermark, opts) {
    throw new Error("not implemented");
  }

  /**
   * Write canonical records TO the ERP for one entity.
   * Must be idempotent per record (NODE-102) — keyed by idempotency_key.
   * @param {Entity} entity
   * @param {CanonicalRecord[]} records
   * @returns {Promise<PushResult[]>}   per-record ok/fail + external id, for reconciliation
   */
  async push(entity, records) {
    throw new Error("not implemented");
  }

  /**
   * Map ONE raw ERP record to the canonical model. Pure, synchronous, total.
   * The only place that knows the ERP's field names. Throws on schema drift (NODE-005).
   * @param {Entity} entity
   * @param {RawRecord} raw
   * @returns {CanonicalRecord}
   */
  normalize(entity, raw) {
    throw new Error("not implemented");
  }

  /** Inverse of normalize for push: canonical → ERP-shaped payload. */
  denormalize(entity, record) {
    throw new Error("not implemented");
  }

  /** Per-tenant, per-entity sync watermark + cursor. Persisted in the DB (sync_state table). */
  async getSyncState(tenantId, entity) {
    throw new Error("not implemented");
  }
  async setSyncState(tenantId, entity, state) {
    throw new Error("not implemented");
  }

  /**
   * Cheap liveness/auth check for the dashboard + G5.5 monitoring.
   * @returns {Promise<{ ok: boolean, latencyMs: number, detail?: string }>}
   */
  async healthCheck() {
    throw new Error("not implemented");
  }
}
```

`getSyncState`/`setSyncState` are usually inherited from a shared base (they hit the same `sync_state` table for every ERP); only the wire methods (`pull`/`push`/`normalize`/`denormalize`/`healthCheck`) and `capabilities` differ per adapter.

---

## 3. Canonical entity model

The engine and dashboard speak **only** canonical. Each adapter's `normalize` is the boundary. Keep the canonical model deliberately small and ERP-neutral; carry ERP-specific extras in `raw` for debugging, never in business logic.

```js
// Canonical shapes (illustrative — finalize field-by-field at G-Schema, client-approved)
Item      = { sku, name, description?, category?, uom?, attributes?, externalId, source, modifiedAt }
Inventory = { sku, locationCode, quantityAvailable, quantityOnHand?, externalId, source, modifiedAt }
Customer  = { externalId, name, email?, phone?, billingAddress?, shippingAddress?, terms?, source, modifiedAt }
Order     = { externalId, customerRef, lines:[{ sku, qty, unitPrice }], status, totals?, placedAt, source, modifiedAt }
Pricing   = { sku, customerRef?, priceListRef?, unitPrice, currency, effectiveFrom?, externalId, source, modifiedAt }
Category  = { externalId, name, parentRef?, source, modifiedAt }
```

Conventions every canonical record carries:

- `externalId` — the ERP's primary key for the record (the join key).
- `source` — which system it came from (`'erp:ddi-inform'`, `'bigcommerce'`), for provenance + conflict resolution.
- `modifiedAt` — UTC; the watermark source. Clock-skew handling lives here (failure-scenario-library).

**Direction defaults** (override per contract at G-Contracts): ERP is system-of-record for `items`, `inventory`, `pricing`, `categories` (pull ERP → push store). Store is authoritative for `orders` and often `customers` (pull store → push ERP). Two-way needs `conflict_resolution`.

---

## 4. Cron-scheduled pull/push is the default

ERPs are poll-only in the common case (DDI Inform included — verify, NODE-008). So the steady state is the **continuous cron-scheduled sync** from `integration/01`, not webhooks. The engine drives every adapter the same way:

```
for each tenant, for each entity on its cadence:
  state   = adapter.getSyncState(tenant, entity)
  for await (raw of adapter.pull(entity, state.watermark)):   // first run: watermark=null → full
      canonical = adapter.normalize(entity, raw)
      upsert(canonical)                                        // idempotent, tenant-scoped (NODE-104)
      advance(state.watermark, canonical.modifiedAt)
  adapter.setSyncState(tenant, entity, state)
  reconcile(tenant, entity)                                    // §6
```

- **Per-entity cadence** lives in the integration contract (`sync.cadence_per_entity`): e.g. inventory every 15 min, pricing hourly, items nightly.
- **Timezone-aware:** cron is interpreted in `project.timezone` (Dashboard Settings), stored UTC. Never server-local (blueprint §6).
- **Overlap protection:** `skip-if-running` by default — a slow run must not stack on the next tick.
- **Webhooks only on the store side**, where supported, as near-real-time + cron reconciliation as the safety net. An adapter with `supportsWebhooks:false` (every ERP, expected) simply never registers webhooks; the engine notices via the capability flag and schedules crons instead. This is the explicit contrast called out in `integrations/bigcommerce/04-webhooks.md`.

---

## 5. Idempotency, retry/backoff, DLQ

Non-negotiable for every adapter (NODE-101, NODE-102):

- **Idempotency.** Pushes are deduped by an idempotency key (`{entity}:{externalId}:{modifiedAt}` or a provider key where one exists). Pulls upsert by `externalId`, so re-processing a record is a no-op. A killed run resumes from the persisted watermark without double-applying.
- **Retry + backoff.** Capped retries (never unbounded — NODE-101), exponential-with-jitter backoff. Caps and strategy come from the contract's `retry_policy`, enforced by architecture fitness tests.
- **DLQ.** Records that exhaust retries go to a dead-letter queue, surfaced on the dashboard and drained by the `queue-recovery` / `webhook-replay` runbooks. Never silently dropped.
- **Failure modes are declared before code** (pre-flight rule, failure-scenario-library): api-timeout, rate-limit, token-expiry, out-of-order, clock-skew, watermark-gap, partial-sync, overlapping-sync, upstream-5xx, schema-drift. Each maps to a `failure_modes[]` entry in the contract.

Queue runtime: default **node-cron**; escalate to **BullMQ + Redis** when concurrency / retries / DLQ semantics are needed (`integration/02`). The adapter is agnostic to which — it exposes `pull`/`push`; the engine owns scheduling and the queue.

---

## 6. Reconciliation

Incremental sync drifts (missed records, ERP edits that don't bump `modifiedAt`, clock skew). Each entity runs a periodic reconciliation pass independent of incremental ticks:

- **Count/checksum parity** between ERP and store per entity (e.g. compare active SKU counts; spot-check field hashes).
- **Watermark-gap detection** — if the watermark window can miss edits, a full or windowed re-pull repairs it (`watermark-gap` failure mode).
- **Divergence report** to the dashboard + DLQ for records that can't be auto-reconciled.
- Reconciliation cadence is coarser than incremental (e.g. nightly) and is itself a cron entry in the contract.

QA covers this with **sync-parity, missed-run, overlapping-run, and watermark-resume tests** (blueprint §7).

---

## 7. Per-adapter config maps to the integration contract

Every adapter is configured by exactly one **integration contract** validating against `_contracts/integration-contract.schema.json`, client-approved at **G-Contracts** before any integration code (NODE-008 forbids coding against a `draft` contract). The mapping:

| Adapter concept                                                     | Contract field                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `capabilities.auth`                                                 | `auth.type` (+ `auth.credential_location`, `auth.token_refresh`) |
| `capabilities.supportsWebhooks` → engine picks scheduled vs webhook | `sync.pattern` (`scheduled` for ERPs)                            |
| `capabilities.supportsIncremental`, watermark field                 | `sync.incremental`, `sync.watermark_field`                       |
| `capabilities.entities`, per-entity direction                       | `entities[]`, `directions[]`, `role`                             |
| per-entity cron cadence                                             | `sync.cron`, `sync.cadence_per_entity`, `sync.timezone_source`   |
| overlap protection                                                  | `sync.overlap_policy`                                            |
| two-way conflict rule                                               | `sync.conflict_resolution`                                       |
| retry/backoff/DLQ                                                   | `retry_policy` (`max_retries`, `backoff`, `dead_letter`)         |
| idempotency strategy                                                | `idempotency_key`                                                |
| `capabilities.rateLimits` (null until verified)                     | `rate_limits` (null until verified — never invent)               |
| `capabilities.pagination`                                           | `pagination.style`, `page_size`                                  |
| `normalize` field map (the row-by-row table)                        | `field_mapping_ref` (client signs off)                           |
| declared failure modes                                              | `failure_modes[]`                                                |
| API version pin                                                     | `api_version` (fitness-test enforced)                            |

Anything not verified against real ERP docs or a sandbox stays `null` in the contract and is tagged **verify-at-discovery** — the schema explicitly allows nulls pre-Discovery for exactly this reason. Do not fabricate endpoints, rate limits, or fields to fill a contract (NODE-008).

---

## 8. Adding an ERP (the checklist)

1. Confirm the real API surface, auth, rate limits, entity coverage, pagination, and sandbox availability at Discovery — never code from memory (NODE-008).
2. Draft the integration contract; leave unverified specifics `null` + flag them.
3. Implement `capabilities`, `pull`, `push`, `normalize`/`denormalize`, `healthCheck`; inherit `getSyncState`/`setSyncState`.
4. Write the field-mapping table (`field_mapping_ref`); get client sign-off at G-Contracts.
5. List failure modes + handling (pre-flight) → contract `failure_modes[]`.
6. Wire the adapter into the engine purely via the interface — no engine changes.
7. Contract + integration tests against the ERP sandbox/mock; sync-parity + watermark-resume + overlapping-run tests.

The pilot (`ddi-inform.md`) is the worked example. The roadmap stubs (`fishbowl.md`, `sage-300.md`, `sage-100.md`, `netsuite.md`, `acctivate.md`, `pc-mrp.md`) each only describe how their transport plugs behind this interface.
