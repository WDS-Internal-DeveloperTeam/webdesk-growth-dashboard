---
tier: 1
load_when: ["code-production"]
description: "Cross-cutting NEVERs for every Node.js project. Code Review blocks these (P1). Platform/arm forbidden files layer on top."
---

# Forbidden — Global (Node.js)

> The system-wide NEVERs. Every project obeys these regardless of project_type or integration target. The `nodejs` arm's `forbidden` file and each integration arm add platform-specific rules on top. Code Review Agent blocks these at P1.

---

## FG-001 — No secrets in code (P1)

No API keys, tokens, passwords, DB URLs, JWT keys, ERP/store credentials in source — ever. Use env / a secret manager; `.env` is gitignored; ship `.env.example` with keys, no values. A committed secret = rotate immediately (deleting the commit is not enough).

```js
// NEVER
const key = "sk_live_8a3f...";
// DO
const key = process.env.BIGCOMMERCE_API_TOKEN;
```

## FG-002 — No unvalidated external input (P1)

Validate every input at the boundary (body, query, params, headers, webhook payloads, **and ERP/store API responses**) with a schema validator before use. Reject unknown fields; bound sizes. Untrusted-by-default includes upstream systems (OWASP API10).

```js
// NEVER trust the shape
const qty = req.body.quantity; // unbounded, unchecked
// DO
const { quantity } = inventorySchema.parse(req.body);
```

## FG-003 — No `console.log` as error handling (P1)

Errors are **thrown** and handled by centralized error middleware, then logged through the structured logger. `console.log`/`console.error` is not error handling, leaks to stdout, and risks PII in logs. No swallowing an error into a log line and continuing.

```js
// NEVER
catch (e) { console.log(e); }             // swallowed, unstructured
// DO
catch (e) { throw new SyncError('inventory pull failed', { cause: e }); }
```

## FG-004 — No direct DB access outside repositories (P1)

Controllers do HTTP only; services hold business logic; **only repositories touch the DB**. No Sequelize model calls or queries in controllers/services/jobs. Enforced by architecture fitness tests (G5). This keeps data access testable, swappable, and auditable.

```js
// NEVER (in a controller or service)
const u = await User.findByPk(id);
// DO
const u = await userRepository.findById(id); // repository owns the model
```

## FG-005 — No silent catch (P1)

Never `catch {}` or catch-and-ignore. Every catch either handles meaningfully (retry, compensate, map to a domain error) or rethrows. Silent catches hide sync failures, token expiry, and partial writes — exactly the failures the cron engine must surface.

```js
// NEVER
try {
  await pushOrder(o);
} catch {}
// DO
try {
  await pushOrder(o);
} catch (e) {
  await deadLetter(o, e);
  throw e;
}
```

## FG-006 — No raw string-interpolated SQL (P1)

No SQL built by string interpolation. Use bind parameters / the ORM query interface, inside repositories only.

```js
// NEVER
sequelize.query(`SELECT * FROM orders WHERE id = ${id}`);
// DO
sequelize.query("SELECT * FROM orders WHERE id = :id", { replacements: { id } });
```

## FG-007 — No auto-deploy without a tested backup/rollback (P1)

No promotion to any shared/staging/production environment without a verified backup and a tested rollback path (Delivery Head, G6). No migration against a shared env before G-Schema passes. The deploy adapter must implement build → migrate → release → health-check → **rollback**.

## FG-008 — No fabricated API calls (P1)

Never call an ERP/store endpoint, ORM method, or Node/Express API you haven't verified exists. Hallucinated API surface is this system's #1 failure mode. Unverified external surfaces are coded against the documented contract + a mock and marked `verify-at-discovery` — never against a guessed endpoint, field name, or auth scheme.

## FG-009 — No `eval` / dynamic code execution (P1)

No `eval`, `new Function`, or `child_process.exec` on user/upstream-derived strings. Use `execFile` with an argument array if a subprocess is unavoidable.

## FG-010 — No PII in logs or client-facing errors (P1)

Customer email/phone/address/name never appear in logs or in error responses returned to clients. Redact at the logger. Stack traces never go to API clients.

## FG-011 — No unscoped tenant queries (P1)

In the multi-tenant dashboard, every query is scoped to the caller's tenant. No "fetch all X" without a tenant filter. Only the master/super-admin role crosses tenants, and that path is explicit + audited (BOLA, OWASP API1).

## FG-012 — No `var`, no `.then()` chains, no committed `node_modules` (P2)

ES Modules, `const`/`let` only, `async/await` only (no `.then()` chains), kebab-case filenames. `node_modules`, build output, and `.env` are gitignored.

---

## How this is enforced

- Code Review Agent blocks FG-001…FG-011 at P1 on every PR.
- Architecture fitness tests enforce FG-004 (and queue retry caps, API-version enforcement) at G5.
- Secret + dependency scanning (OSV-Scanner) runs in CI.

The `nodejs` arm `forbidden` file extends this with Node-specific coding rules (per blueprint §11); integration arms add ERP/store-specific NEVERs.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
