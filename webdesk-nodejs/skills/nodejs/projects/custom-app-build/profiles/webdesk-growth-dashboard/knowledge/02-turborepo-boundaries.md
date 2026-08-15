---
tier: 2
load_when: ["webdesk-growth-dashboard", "scaffold", "schema-work", "g1_5"]
description: "Turborepo package/app boundaries, migration ownership, build pipeline, and how the base skill's controller/service/repository layering and architecture-fitness tests apply per-app inside the monorepo."
---

# 02 — Turborepo Boundaries

> The base skill's canonical project layout and service-skeleton template assume one deployable service per repository. This file is the adaptation: the same layering and fitness-test discipline, applied per app inside one workspace, plus the package-ownership rules a single-repo skeleton never had to specify.

---

## Workspace layout

```text
webdesk-growth-dashboard/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                 root — pnpm workspace root, shared devDependencies
├── apps/
│   ├── dashboard-web/            Next.js App Router
│   ├── dashboard-api/            NestJS, deployed as Vercel Functions
│   └── dashboard-worker/         Vercel Function handlers — no server.js, no listen()
├── packages/
│   ├── database/                 Sequelize models + migrations — SOLE migration owner
│   ├── shared-types/             Cross-app TS types (generated from Zod where practical)
│   ├── validation/                Zod schemas — SOLE validation-schema source
│   ├── ui/                       Shared React components + design tokens
│   ├── integrations/             github/, wordpress/, google-workspace/, vercel/ adapters
│   └── configuration/            Env schema (zod), shared config loader
├── docs/architecture/adr/        ADRs (precedence level 3 — see knowledge/00-scope-and-precedence.md)
└── operations/                   Runbooks (see knowledge/11-retention-backup-and-operations.md)
```

---

## Layering applies per app, unchanged

`nodejs/knowledge/01-coding-standards.md`'s controller/service/repository split, and NODE-003/FG-004 (no DB access outside repositories), apply **within `apps/dashboard-api`** exactly as documented — Nest's `@Controller()`/`@Injectable()`/repository-provider structure maps onto it directly (`knowledge/03-nestjs-on-vercel.md`). `apps/dashboard-worker`'s handlers follow the same service/repository split minus the controller layer (no HTTP surface to speak of — see `knowledge/04-serverless-queues-workflows-and-cron.md`).

**The architecture-fitness dependency-cruiser configuration (`nodejs/templates/architecture-tests/dependency-cruiser.config.cjs`) needs one config per app**, not one at repo root — a single root config cannot express "no Sequelize import outside `apps/dashboard-api/src/repositories/` or `packages/database/`" without also constraining `dashboard-web`'s unrelated import graph. Each app's `dependency-cruiser.config.cjs` extends a shared base rule-set from `packages/configuration` so the rules themselves aren't duplicated three times, only the file-glob scoping differs per app.

---

## Package ownership rules

| Package                  | Owns                                                                                               | Consumed by                                                                                                                                            | Notes                                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/database`      | Sequelize models, **all** migrations                                                               | `dashboard-api` (read/write via repositories), `dashboard-worker` (read/write via repositories)                                                        | **Sole migration owner.** No other app or package runs `sequelize-cli db:migrate` against a shared environment. `dashboard-worker` never runs its own migration path — it imports the same models.                                                      |
| `packages/shared-types`  | Cross-app TypeScript types, generally derived from `packages/validation`'s Zod schemas (`z.infer`) | `dashboard-web`, `dashboard-api`, `dashboard-worker`                                                                                                   | Types follow schemas, not the other way around — do not hand-author a type in `shared-types` that duplicates what a Zod schema in `packages/validation` already implies.                                                                                |
| `packages/validation`    | Zod schemas — the **single** validation-schema source                                              | `dashboard-web` (React Hook Form + zodResolver), `dashboard-api` (NestJS pipes wired to the same schemas), `dashboard-worker` (job-payload validation) | Never let `dashboard-api` grow a parallel `class-validator` DTO layer that duplicates a `packages/validation` schema — this is the single most likely place for validation drift to creep in (`docs/implementation/architecture-validation.md` §8).     |
| `packages/ui`            | Shared React components, Tailwind design tokens                                                    | `dashboard-web`                                                                                                                                        | Isolated from the WordPress theme's own SCSS design tokens — the two are unrelated systems (`knowledge/01-approved-architecture.md` styling row).                                                                                                       |
| `packages/integrations`  | GitHub/WordPress/Google-Workspace/Vercel adapter implementations, each behind an interface         | `dashboard-api`, `dashboard-worker`                                                                                                                    | The adapter **interfaces** live here; adapter-specific _knowledge_ (how to use them correctly) lives in this profile's `integrations/*` directories, loaded separately per context-budget discipline.                                                   |
| `packages/configuration` | Env schema (Zod), shared config-loading logic, shared dependency-cruiser base rules                | All apps                                                                                                                                               | Fail-fast env validation at boot, per `nodejs/knowledge/backend/01-runtime-and-frameworks.md`'s config pattern — adapted for Vercel Functions' per-invocation cold start rather than a single long-lived boot (see `knowledge/03-nestjs-on-vercel.md`). |

---

## Build pipeline (Turborepo)

CI wiring adapts the base skill's sequence (`nodejs/knowledge/testing/01-api-and-integration-tests.md`: install → lint → typecheck → test → audit → migration dry-run) to be pipeline-aware:

```jsonc
// turbo.json (illustrative — not a scaffold artifact; recorded here as the intended shape)
{
  "pipeline": {
    "lint": { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "migrate:dry-run": { "cache": false },
  },
}
```

Only affected packages/apps rebuild and retest on a given PR (`turbo run lint test build --filter=...[origin/staging]`) — this is what keeps the monorepo's CI time proportional to the change, not to the whole workspace, consistent with the base skill's context-budget philosophy applied to build time instead of token budget.

Migration dry-run remains a **repo-wide, non-cached** step (`cache: false` above) run against `packages/database` regardless of which app changed, since a migration's correctness doesn't depend on which app triggered the PR.

---

## What this file does not cover

- NestJS-specific adaptation of the base skill's middleware/error-handling examples → `knowledge/03-nestjs-on-vercel.md`.
- The `dashboard-worker` execution model in detail (why it has no `server.js`) → `knowledge/04-serverless-queues-workflows-and-cron.md`.
