# @webdesk/dashboard-api

NestJS backend for the WebDesk Website Growth Dashboard — synchronous APIs, authorization,
webhooks, request orchestration (ADR-0002, ADR-0003). All database access and business logic for
the dashboard live here; `dashboard-web` never talks to the database or third-party integrations
directly.

## Scripts

- `pnpm dev` — start the Nest app (`nest start --watch`)
- `pnpm build` — production build (`nest build`)
- `pnpm typecheck` — TypeScript project check
- `pnpm lint` — ESLint
- `pnpm test` — unit tests (Vitest)
- `pnpm test:integration` — integration tests against a real disposable database

## Deployment

Per ADR-0003, `dashboard-api` runs inside a Vercel Function handler rather than as a long-running
`nest start` process — a Vercel-compatible Nest adapter wraps the Nest HTTP adapter for serverless
execution. That adapter has not been built yet; see `docs/architecture/decisions/0003-nestjs-execution-through-vercel-functions.md`
and `docs/phase-plans/phase-1-foundation-plan.md` (Task 13 — Staging deployment foundation).
