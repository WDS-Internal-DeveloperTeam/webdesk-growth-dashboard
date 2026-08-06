# ADR-0001 — Turborepo Monorepo Boundaries

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard consists of three deployable units (a Next.js web app, a NestJS API, and background job handlers) plus several shared concerns (database access, types, validation, UI components, external-system integrations, configuration). The Node.js base skill's default `custom-app-build` guidance assumes a single-app layout; this project is the skill's first Turborepo-based build, and the boundary lines needed to be drawn explicitly before any code is written, since retrofitting package boundaries after code exists is expensive.

## Decision

Use a Turborepo monorepo with this structure:

```
apps/
├── dashboard-web/       (Next.js App Router — UI, no direct DB access)
├── dashboard-api/       (NestJS — the only app with direct DB access, all business logic)
└── dashboard-worker/    (Vercel Function handlers for background jobs — see ADR-0004)

packages/
├── database/            (Sequelize models, migrations — the ONLY package/app that runs migrations)
├── shared-types/        (TypeScript types shared across apps)
├── validation/           (shared validation schemas)
├── ui/                   (shared React components)
├── integrations/         (GitHub, WordPress, Google Workspace adapters)
└── configuration/        (shared config loading/env validation)
```

`dashboard-web` never queries the database directly — it calls `dashboard-api`. `dashboard-worker` shares `packages/database` and `packages/integrations` with `dashboard-api` but is deployed and scaled independently, since it runs on a different trigger model (queue/cron, not HTTP request).

## Alternatives considered

- **Single Next.js app with API routes** — rejected: doesn't cleanly separate the NestJS-based business-logic layer the Master Specification requires, and conflates web-serving concerns with background-job concerns.
- **Separate repositories per app** — rejected: the dashboard's apps share enough types, validation, and integration code that a monorepo avoids constant cross-repo version-pinning churn for a single-team, single-deployment-target project. Revisit only if the team or deployment model changes materially.
- **Nx instead of Turborepo** — rejected: no requirement favors it over Turborepo, and Turborepo has a smaller learning curve for this team size; not a strong technical reason either way.

## Consequences

- Every app/package boundary above must be enforced by import rules (e.g., ESLint boundaries or TypeScript project references) once scaffolded — Phase 1 setup task, not Phase 0.
- `packages/database` being the sole migration owner is restated as its own rule (WDS-011) precisely because a monorepo makes it structurally easy for a second app to accidentally acquire its own migration runner.
- CI (`turbo run lint test build`) can build/test only the apps/packages actually changed in a PR, once Turborepo's caching is configured — a Phase 1 concern.

## Security considerations

`dashboard-web` never holding direct DB credentials reduces the blast radius of a web-app-side compromise — only `dashboard-api` and `dashboard-worker` need database credentials at runtime.

## Operational considerations

Three independently deployable units means three sets of environment variables and three Vercel deployment targets (or a single Vercel project with multiple functions — exact Vercel project topology is a Phase 1 setup decision, tracked in `docs/project-state/setup-input-register.md`).

## Validation method

Reviewed against `01_Dashboard_Master_Specification.md` and profile `knowledge/02-turborepo-boundaries.md` for consistency — no new decision made here, this ADR formalizes what both sources already establish.

## Approval gate

G1 (architecture approval) — human sign-off required before Phase 1 scaffolds this structure.

## Related dashboard requirements

`01_Dashboard_Master_Specification.md` (architecture section), `03_Detailed_Module_Specifications.md` (module-to-app mapping).

## Related skill rules

Profile `knowledge/02-turborepo-boundaries.md`; base skill `nodejs/knowledge/technology-selection.md`.

## Open setup values

None — this decision doesn't depend on any unconfirmed setup-time input.
