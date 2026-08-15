---
tier: 2
load_when: ["code-review-active", "code-review"]
description: The paths that require senior human review regardless of automated findings — auth, payments/PII, sync write-paths, and migration files. How they're detected and what the senior reviewer checks.
---

# Sensitive Paths — Senior Human Review Required

> Some code is dangerous enough that AI review + linters are necessary but not sufficient: a human senior reviewer signs off as well. The four sensitive categories are **auth**, **payments/PII**, **sync write-paths**, and **migration files**. When a PR touches any of them, Code Review flags it, names the required reviewer(s) from CODEOWNERS, and the PR cannot pass on automated findings alone — even a clean automated review still requires the human sign-off.

---

## The four categories

### 1. Auth

Anything in the authentication/authorization surface:

- JWT issuance/verification, refresh-token rotation, the revocation list.
- The RBAC enforcement layer (the per-module VED checks on endpoints), role/permission changes.
- Login, password handling, session/token middleware.
- Tenant-scoping logic (the code that ensures a query is bound to the caller's tenant).

**Why:** an authz mistake is a tenant-data-breach or an auth-bypass — the worst-case P1. AI can miss a subtle scoping hole.

**Senior checks:** is every endpoint's authz server-side and tenant-scoped? Does the change preserve the access/refresh/rotation/revocation model? Could any object be reached cross-tenant by id (BOLA)?

### 2. Payments / PII

Code that handles money or personal data:

- Order/pricing sync write-paths (financial correctness).
- Any storage/transit/logging of PII (customer records, emails, contact details).
- Secret-bearing config (API keys, access tokens, client secrets) handling.

**Why:** double-charges, mis-priced syncs, and leaked PII are P1 and carry legal/financial consequences.

**Senior checks:** is money/PII handled idempotently and never logged? Are secrets read from env and masked? Is the financial write exactly-once?

### 3. Sync write-paths

The code that **writes** into the ERP or the store (not read-only sync):

- Push to BigCommerce/store, push to the ERP, two-way conflict resolution, watermark advancement, the reconciliation that corrects drift.

**Why:** this is where data corruption happens — duplicate writes, gaps, wrong conflict-resolution. The whole product is correct sync; the write path is the sharp edge.

**Senior checks:** does the watermark advance only after commit? Is the write idempotent (a re-run/overlap can't dupe)? Does conflict resolution match the **client-approved contract**? Is there a DLQ and a bounded retry?

### 4. Migration files

Any DB migration (`migrations/**`, Sequelize/umzug migration files):

- Schema changes, especially destructive ones (drop column/table, type change, non-null backfill).

**Why:** a bad migration is irreversible data loss; migrations run in shared environments and can't be "undone" by a revert once data is gone.

**Senior checks:** is the migration **reversible** (a real `down`, not a stub)? Is any destructive change explicit and justified? Are new indexes/constraints sound and non-locking on large tables? Was it dry-run validated? (G-Schema must have approved the data-model first — a migration that diverges from the approved `data-model.md` is itself a finding.)

---

## Detection

Code Review flags a PR as sensitive when the diff touches paths matching the project's CODEOWNERS / a sensitive-path glob, typically:

```
src/auth/**            src/middleware/auth*       src/services/*auth*      → auth
src/**/*payment*  src/**/*pricing*  src/**/*pii*  + secret-config handlers → payments/PII
src/services/*sync*write*  src/repositories/*store*  src/repositories/*erp*
  src/jobs/*sync*  (write direction)  src/services/*reconcil*               → sync write-paths
migrations/**                                                               → migrations
```

Keep the authoritative globs in the project's CODEOWNERS; this list is the default seed. When matched, name the required reviewer(s) from CODEOWNERS in the PR comment's "Sensitive Paths Touched" block.

---

## The rule

1. A sensitive-path PR **requires** named senior human review. Automated PASS is necessary, not sufficient.
2. Code Review still posts its full review (it doesn't defer entirely to the human) — the human reviews _on top of_ the automated findings, with the sensitive context highlighted.
3. The PR status stays FAIL/blocked until the senior review is recorded, even with zero automated findings.
4. Weakening a guardrail in a sensitive path (removing an authz check, deleting a fitness test, making a migration non-reversible) is **P1** on its own.
5. Self-approval is prohibited: the senior reviewer can't be the author (mirrors the gate self-approval rule in `_contracts/gate-format.md`).

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
