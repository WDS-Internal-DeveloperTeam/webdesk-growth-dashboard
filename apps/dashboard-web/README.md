# @webdesk/dashboard-web

Next.js App Router frontend for the WebDesk Website Growth Dashboard — presentation only, no
database access, no business logic (ADR-0002). All server-side authorization and data access go
through `dashboard-api`.

## Scripts

- `pnpm dev` — start the Next.js dev server
- `pnpm build` — production build
- `pnpm typecheck` — TypeScript project check
- `pnpm lint` — ESLint
- `pnpm test` — unit tests (Vitest)
- `pnpm test:integration` — Playwright end-to-end tests

## Deployment

Deployed to Vercel as its own project, Root Directory `apps/dashboard-web`, Framework Preset
Next.js. See `docs/repository-plan/environment-plan.md` and
`docs/project-state/setup-input-register.md` for environment/origin status.
