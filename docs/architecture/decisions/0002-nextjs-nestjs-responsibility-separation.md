# ADR-0002 — Next.js and NestJS Responsibility Separation

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The base Node.js skill's documented default backend framework is Express; the Master Specification requires NestJS for the API layer and Next.js (App Router) for the web UI. Both frameworks can technically render pages and handle HTTP requests, so the boundary between them needs to be explicit or the two responsibilities will blur over time as features are added.

## Decision

- `dashboard-web` (Next.js App Router) owns: page rendering, client-side interactivity, calling `dashboard-api` over HTTP for all data and mutations, and session-cookie handling for the browser. It holds no business logic and no direct database access.
- `dashboard-api` (NestJS) owns: all business logic, all database access (via `packages/database`), all authorization checks, all integration calls (GitHub, WordPress, Google Workspace), and all webhook receivers.
- Next.js Server Components may call `dashboard-api` server-side (avoiding a client-side round trip) but must still go through `dashboard-api`'s own authorization checks — Server Components are not a backdoor around the API layer's access control.

This follows the base skill's own default override mechanism (`nodejs/knowledge/technology-selection.md`'s "ask-if-missing, record the override" rule): the Master Specification is precedence level 1 and names NestJS explicitly; this ADR records that override rather than silently applying the base skill's Express default.

## Alternatives considered

- **Next.js API routes as the entire backend** — rejected: doesn't satisfy the Master Specification's explicit NestJS requirement, and NestJS's module/dependency-injection structure is a better fit for the dashboard's many distinct modules (Scan Center, Release Center, Notification Center, etc.) than Next.js route handlers.
- **NestJS serving server-rendered pages directly** — rejected: Next.js's App Router is the more mature choice for the dashboard's UI needs (React Server Components, streaming, routing conventions); mixing page-rendering into NestJS would duplicate what Next.js already does well.

## Consequences

Every dashboard feature requires touching two apps (a `dashboard-api` module + a `dashboard-web` page/component) rather than one — more files per feature, but a clean, independently-testable boundary. `packages/shared-types` becomes load-bearing for keeping the two apps' request/response contracts in sync.

## Security considerations

Centralizing all authorization in `dashboard-api` means there is exactly one place to audit for access-control correctness, rather than authorization logic potentially duplicated (and drifting) across both apps.

## Operational considerations

Two apps means two sets of logs/metrics to correlate per user-facing request (web → API). Correlation IDs across the web→API boundary are a Phase 1 observability requirement, not designed here.

## Validation method

Reviewed against `01_Dashboard_Master_Specification.md`'s technology requirements and profile `knowledge/03-nestjs-on-vercel.md`.

## Approval gate

G1 (architecture approval).

## Related dashboard requirements

`01_Dashboard_Master_Specification.md`, `03_Detailed_Module_Specifications.md`.

## Related skill rules

Profile `knowledge/03-nestjs-on-vercel.md`; base skill `nodejs/knowledge/technology-selection.md`.

## Open setup values

None.
