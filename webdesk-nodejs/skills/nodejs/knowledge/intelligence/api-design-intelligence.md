---
tier: 2
load_when: ["code-production", "integration-work", "planning"]
description: "API Design Intelligence — REST conventions and the full HTTP status-code table, including upstream-failure codes (502/503/504)."
---

# Intelligence — API Design

> Decision-support for designing the system's own REST APIs (blueprint §9, §10 #20). Consistent shapes, correct status codes — including the **upstream-failure codes** that matter when an ERP/store call fails behind your endpoint.

---

## REST conventions

- **Versioned, plural-noun, kebab-case paths**; the HTTP method is the verb (`02-naming-conventions.md`).
  `GET /api/v1/orders`, `POST /api/v1/sync-runs`, `GET /api/v1/sync-states/:entity`.
- **Pagination** mandatory on collections (cursor or limit/offset with a hard cap — OWASP API4).
- **Filtering/sorting** via query params, validated (NODE-005).
- **Response shape:** serialize through an explicit DTO (never a raw model — leaks internal/other-tenant fields, OWASP API3). Consistent envelope for errors: `{ error: <code>, message?, details? }` — never a stack trace to the client.
- **Idempotency:** mutating sync/bulk endpoints accept an idempotency key where a retry could double-apply.
- **Auth on every route**; per-module RBAC checked server-side (`security/02`).

---

## Status codes (the full table)

| Code            | Use                                                                              |
| --------------- | -------------------------------------------------------------------------------- |
| **200**         | OK — successful GET/PUT/PATCH                                                    |
| **201**         | Created — POST that created a resource                                           |
| **202**         | Accepted — async work enqueued (webhook ack, sync trigger)                       |
| **204**         | No Content — successful DELETE / empty body                                      |
| **301/302/304** | redirects / not-modified (caching)                                               |
| **400**         | Bad Request — malformed syntax                                                   |
| **401**         | Unauthorized — missing/invalid auth (bad/expired JWT, bad webhook HMAC)          |
| **403**         | Forbidden — authenticated but lacks the module permission (RBAC)                 |
| **404**         | Not Found — resource absent **or** hidden cross-tenant (don't reveal existence)  |
| **409**         | Conflict — version conflict, duplicate, sync conflict                            |
| **422**         | Unprocessable Entity — validation failed (semantically invalid input)            |
| **429**         | Too Many Requests — _our_ rate limit hit (we also receive this from upstreams)   |
| **500**         | Internal Server Error — unexpected; generic body, full detail logged             |
| **502**         | **Bad Gateway — upstream ERP/store returned an invalid/garbage response**        |
| **503**         | **Service Unavailable — upstream down, or we're shedding load / in maintenance** |
| **504**         | **Gateway Timeout — upstream ERP/store didn't respond in time**                  |

**502/503/504 are first-class here** (blueprint §9): when an endpoint depends on an ERP/store call that fails, map it honestly so callers and the dashboard can distinguish "our bug" (500) from "upstream is down" (502/503/504). The centralized error handler does this mapping (`01-coding-standards.md`); upstream-failure responses also drive the circuit/observability signals (`integration/03`, `04`).

---

## Errors → codes (mapping rule)

- Validation error → **422**; missing auth → **401**; wrong permission → **403**; not found / cross-tenant → **404**; conflict → **409**; our overload → **429/503**; upstream invalid → **502**; upstream timeout → **504**; unknown → **500** (generic body, logged with correlation id).
- Typed errors carry their status (`NotFoundError` → 404, `ForbiddenError` → 403, `UpstreamTimeoutError` → 504) so controllers stay thin and mapping is centralized.
