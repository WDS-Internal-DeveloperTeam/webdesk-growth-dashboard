# Dashboard Monorepo Plan

**Status:** Planning document. No repository has been created and no scaffold exists — this documents the intended structure per ADR-0001, for Phase 1 to execute against.

## Intended structure

```
apps/
├── dashboard-web/       Next.js App Router — presentation only, no DB access, no business logic
├── dashboard-api/       NestJS on Vercel Functions — synchronous APIs, authorization, webhooks
└── dashboard-worker/    Vercel Function handlers — asynchronous/scheduled jobs, shared services
                         and repositories with dashboard-api (no duplicated business rules,
                         no persistent process)

packages/
├── database/            Sequelize models + migrations — sole migration owner (WDS-011)
├── shared-types/        TypeScript types shared across apps
├── validation/           Shared validation schemas
├── ui/                   Shared React components
├── integrations/         GitHub, WordPress, Google Workspace, Vercel Blob/jobs adapters
└── configuration/        Shared config loading + env validation
```

## Ownership and dependency rules

- `dashboard-web` depends on `packages/shared-types`, `packages/validation`, `packages/ui` — never on `packages/database` directly.
- `dashboard-api` and `dashboard-worker` both depend on `packages/database`, `packages/integrations`, `packages/shared-types`, `packages/validation`, `packages/configuration`.
- `packages/integrations` depends on `packages/configuration` for credential loading, not on `packages/database` (integration adapters return data; persisting it is the caller's job).
- No package depends on an `apps/*` package — dependencies flow one direction, apps depend on packages, never the reverse.
- `packages/database` is the only package with Sequelize migration files; no other package or app defines its own migrations (WDS-011, enforced structurally by this boundary, not just by convention).

## What is NOT created in Phase 0

No directory above exists on disk yet. This plan documents intent for Phase 1's first task (Repository and monorepo scaffold, per `docs/phase-plans/phase-1-foundation-plan.md`) to execute against, with explicit human approval, not for Phase 0 to scaffold itself.

## Repository location

This monorepo is intended to live in its own GitHub repository, `WDS-Internal-DeveloperTeam/webdesk-growth-dashboard` (per `outputs/webdesk-growth-dashboard/project.json`'s `repository.url`, supplied by the project owner 2026-08-06 and registered as this working directory's local `origin` remote — see `docs/project-state/setup-input-register.md`). **Whether this repository has actually been created on GitHub is not confirmed by this document** — the URL being registered locally is not evidence the remote exists; Phase 1 Task 1 confirms this before scaffolding proceeds. Separate from the WebDesk Node.js Delivery System skill repository and separate from the WordPress theme repository (`docs/repository-plan/wordpress-repository-interface.md`).

## Turborepo configuration expectations (Phase 1)

`turbo.json` pipeline covering `lint`, `test`, `build`, and a migration dry-run task; `pnpm` workspaces per the tech-stack decision (`project.json.tech_stack`); CI wired to run only against changed packages/apps once caching is configured — exact CI provider and workflow files are a Phase 1 task, not designed here.
