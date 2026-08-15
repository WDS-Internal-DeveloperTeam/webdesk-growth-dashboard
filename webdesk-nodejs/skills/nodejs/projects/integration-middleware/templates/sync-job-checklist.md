---
tier: 2
load_when: ["pt-integration-middleware", "sync-engine", "integration-work", "backend-active", "g4"]
description: Per-entity pre-flight checklist completed BEFORE writing sync code for an entity. Enforces the failure-mode pre-flight rule and the engine's correctness properties.
---

# Sync-Job Checklist — per entity, before any sync code

> Complete this for **each entity** (items, inventory, pricing, orders, …) **before** writing its sync code. It enforces the pre-flight failure-mode rule (`nodejs/knowledge/intelligence/failure-scenario-library.md`) and the engine's correctness properties (`knowledge/02-sync-engine.md`). Copy to `sync-jobs/<entity>-checklist.md` in the project workspace and fill it in. An entity whose checklist isn't complete is not ready for G4.

---

## Entity: `[ entity name ]` · Contract: `[ IC-... ]`

### 1. Contract & approval

- [ ] Entity appears in the system's `integration-contract` `entities[]`.
- [ ] Contract `status == client-approved` (G-Contracts passed). **Do not write code against a `draft` contract** (NODE-008).
- [ ] Field-mapping rows for this entity exist in `<system>.fields.md` and the client signed them.

### 2. Direction & authority

- [ ] Authoritative system identified: `[ ERP | store ]`.
- [ ] Direction(s): `[ pull | push | both ]`.
- [ ] If **both**: `sync.conflict_resolution` set and an ADR records the rule (`system-of-record-wins` / `last-write-wins by updated_at` / `manual review queue`).

### 3. Cadence & timezone

- [ ] Cron cadence taken from the contract (`sync.cron` / `cadence_per_entity`) — **not hard-coded**.
- [ ] Cron interpreted in `project.timezone` (Dashboard Settings), not server-local.
- [ ] Reconciliation cadence (coarser) defined for this entity.

### 4. Watermark & resumability

- [ ] First run = full sync (watermark `null`); subsequent runs incremental from `watermark_field` (`[ modifiedAt ]`).
- [ ] Watermark advances **as records are applied**, not at the end (so a mid-run kill resumes correctly).
- [ ] `sync_state` row keyed `(tenant_id, entity)`; cursor handled for non-timestamp pagination.
- [ ] **Watermark-resume** test planned (kill mid-sync → resume, no double-apply, no gap).

### 5. Idempotency

- [ ] Pulls upsert by `externalId`, tenant-scoped (re-apply is a no-op).
- [ ] Pushes deduped by idempotency key `[ {entity}:{externalId}:{modifiedAt} | provider key ]` (NODE-102).
- [ ] (Store side) webhook handler dedupes on idempotency key → `200` for duplicate.

### 6. Overlap protection

- [ ] `overlap_policy` = `[ skip-if-running (default) | queue | allow-overlap ]`.
- [ ] Run lock is real (DB row lock / Redis lock), not an in-process boolean.
- [ ] **Overlapping-run** test planned (slow run must not stack on the next tick).

### 7. Retry / backoff / DLQ

- [ ] Retry cap from contract `retry_policy.max_retries` (never unbounded — NODE-101).
- [ ] Backoff = `[ exponential-jitter ]`; honors rate-limit / Retry-After.
- [ ] Exhausted retries → DLQ (never silently dropped); surfaced on the dashboard.

### 8. Pre-flight failure modes (state the handling for each in scope)

- [ ] `api-timeout` → `[ handling ]`
- [ ] `rate-limit` → `[ handling ]`
- [ ] `token-expiry` → `[ handling — refresh per auth.token_refresh ]`
- [ ] `out-of-order` → `[ compare modifiedAt; don't overwrite newer with older ]`
- [ ] `clock-skew` → `[ tolerance window + reconciliation backstop ]`
- [ ] `watermark-gap` → `[ trailing-window re-pull in reconciliation ]`
- [ ] `partial-sync` → `[ watermark advances only past applied records ]`
- [ ] `upstream-5xx` → `[ transient retry + alert if sustained ]`
- [ ] `schema-drift` → `[ normalize() throws (NODE-005); surfaces loudly ]`

### 9. Reconciliation

- [ ] Parity check defined (count / checksum) for this entity between ERP and store.
- [ ] Divergence report → dashboard; unreconcilable → DLQ.
- [ ] **Sync-parity** test planned.

### 10. Transforms & mapping correctness

- [ ] Every transform from `<system>.fields.md` implemented (trim/case/currency/unit/HTML-strip) — no silent transform.
- [ ] Join key correct (`[ sku | externalId ]`).
- [ ] `normalize`/`denormalize` are the **only** code that knows this system's field names.

### 11. Tests (the G4 set for this entity)

- [ ] Contract/integration test vs sandbox/mock.
- [ ] Sync-parity · missed-run · overlapping-run · watermark-resume.
- [ ] (Store side) webhook idempotency/replay.

---

Last reviewed: 2026-06-30 by Claude (initial build)
