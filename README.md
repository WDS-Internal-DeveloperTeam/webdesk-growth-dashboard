# WebDesk Website Growth Dashboard

Turborepo monorepo for the WebDesk Website Growth Dashboard. **Status: Phase 1A (repository and monorepo foundation) only** — see `docs/project-state/phase-0-approval-checklist.md` for the exact authorization scope. No business modules, authentication, database entities, or external integrations are implemented yet.

For the full architecture record, read `docs/architecture/decisions/` (20 ADRs), `docs/contracts/` (7 integration contracts), and `docs/repository-plan/` before writing any code here.

## Installation

Requires Node.js **24.x** (pinned in `.nvmrc`/`.node-version`) and `pnpm` (version pinned in `package.json`'s `packageManager` field, activated via [Corepack](https://nodejs.org/api/corepack.html)).

```bash
nvm use            # or: nvm install (if 24.x isn't installed yet)
corepack enable
pnpm install --frozen-lockfile
```

`--frozen-lockfile` is used deliberately — it fails loudly if `package.json` and `pnpm-lock.yaml` have drifted, rather than silently re-resolving.

## Development commands

```bash
pnpm dev           # turbo run dev — starts all apps in watch mode
pnpm dev --filter=dashboard-web    # a single app only
```

## Validation commands

```bash
pnpm typecheck     # turbo run typecheck — TypeScript, no emit
pnpm lint          # turbo run lint — ESLint, all apps/packages
pnpm format        # prettier --check — fails if formatting drifted
pnpm format:write  # prettier --write — fixes formatting locally
pnpm boundaries:check   # dependency-cruiser — see "Package dependency rules" below
pnpm audit         # pnpm audit --audit-level=high — dependency vulnerability scan
```

## Test commands

```bash
pnpm test              # turbo run test — unit tests, all apps/packages
pnpm test:integration  # turbo run test:integration — no external services required
```

Every test in this repository, at Phase 1A, runs with **no external API, no database, and no cloud resource** — see each app's own `README.md`/test files for what's stubbed vs. real.

## Build commands

```bash
pnpm build         # turbo run build — production build, all apps
```

## Environment-file handling

- `.env`, `.env.local`, and `.env.*.local` are gitignored (see `.gitignore`) and **must never be committed**.
- Every app/package that reads environment variables validates them against a schema at startup (`packages/configuration`) — an app fails fast on a missing/malformed variable rather than running with `undefined` silently propagating.
- Phase 1A ships **no real credentials anywhere** — see `docs/security/secrets-management-plan.md` for the eventual (Phase 1B+) secrets model. Any `.env.example` file in this repository contains placeholder values only.

## Application ownership

| App                     | Owns                                                                                                                                        | Does not own                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `apps/dashboard-web`    | Presentation (Next.js App Router), client-side interactivity                                                                                | Business logic, direct database access    |
| `apps/dashboard-api`    | Synchronous APIs, authorization, webhooks, request orchestration (NestJS)                                                                   | Asynchronous/scheduled work               |
| `apps/dashboard-worker` | Asynchronous/scheduled execution (serverless handlers) — shares services/repositories with `dashboard-api`, never duplicates business rules | A permanent process — forbidden (WDS-005) |

Full record: `docs/architecture/decisions/0001-turborepo-monorepo-boundaries.md`, `0002-nextjs-nestjs-responsibility-separation.md`, `0004-dashboard-worker-serverless-decomposition.md`.

## Package dependency rules

- `packages/database` is the **sole** Sequelize model/connection/migration boundary (WDS-011). At Phase 1A it contains configuration and interface placeholders only — no models, no migrations.
- `packages/shared-types` is application-neutral — no database or framework-specific code.
- `packages/validation` holds shared Zod schemas, consumed by both `dashboard-web` (client-side) and `dashboard-api` (server-side validation pipes).
- `packages/ui` holds the dashboard's own design tokens/components — **never** WordPress styles or competing design tokens (the dashboard and WordPress theme's CSS remain completely isolated, per `docs/architecture/decisions/0020-wordpress-native-metadata-no-acf.md`'s broader WordPress-isolation principle).
- `packages/integrations` holds adapter **interfaces** only at Phase 1A — no GitHub, WordPress, Google Workspace, SMTP, Blob, or Vercel job-queue implementations yet.
- `packages/configuration` holds environment-schema and shared config-loading foundations — no real secret values, ever.
- No package imports from an `apps/*` app — dependency flow is one-directional (apps depend on packages, never the reverse).
- No circular package dependencies.

These rules are mechanically enforced by `pnpm boundaries:check` (`dependency-cruiser.config.cjs`, adapted from the base skill's own architecture-fitness template — see `docs/architecture/decisions/0001-turborepo-monorepo-boundaries.md` for the full rationale). It currently reports 2 harmless orphan warnings (a vitest `setupFiles` entry and a module reached only through the `@/` path alias, which the default resolver doesn't trace) — both exit code 0; only `error`-severity boundary violations fail the check.

## What Phase 1A deliberately does not include

No database entities, no authentication, no RBAC, no audit-log persistence, no business dashboard modules, no GitHub/WordPress/Google Workspace/SMTP/Blob integration implementations, no Vercel Queues/Workflows connections, no deployment. See `docs/phase-plans/phase-1-foundation-plan.md` for the full Phase 1B–1F sequence, each requiring its own separate authorization.
