# Phase 1F — File Inventory (as-built)

**Status:** Full accounting of every file touched on `phase-1f-application-shell` vs. `main`, per
`git diff --stat main...phase-1f-application-shell`: **78 files changed, 5030 insertions(+), 92
deletions(-)** (as of the observability/accessibility/roadmap commits; the documentation-set
commit itself adds more on top — see the final validation report for the true final count).

## `apps/dashboard-api` (backend)

| File                                                 | Change                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `api/index.ts`                                       | Wire `initSentry()` into the Vercel Function bootstrap                             |
| `src/app.module.ts`                                  | Import `getBuildMetadata`; extend logger `base` with environment/version/commitSha |
| `src/auth/auth.module.ts`                            | Wire `MeController`                                                                |
| `src/auth/me.controller.ts` (+ `.spec.ts`)           | New — `GET /me`                                                                    |
| `src/authz/authz.module.ts`                          | Wire `NavigationService`/`NavigationController`                                    |
| `src/authz/catalog.service.ts` (+ `.spec.ts`)        | Use the shared `module-registry.mapper.ts`                                         |
| `src/authz/module-registry.mapper.ts`                | New — shared entity→DTO conversion                                                 |
| `src/authz/navigation.controller.ts`                 | New — `GET /me/navigation`                                                         |
| `src/authz/navigation.service.ts` (+ `.spec.ts`)     | New — permission-aware navigation filtering                                        |
| `src/common/all-exceptions.filter.ts` (+ `.spec.ts`) | Report 5xx exceptions to Sentry                                                    |
| `src/health/health.controller.ts` (+ `.spec.ts`)     | Add `build` metadata to `/health`/`/ready`                                         |
| `src/main.ts`                                        | Wire `initSentry()` into local-dev/CI bootstrap                                    |
| `src/observability/sentry.ts` (+ `.spec.ts`)         | New — Sentry init/capture, inert until `SENTRY_DSN` exists                         |
| `test/authz.e2e-spec.ts`                             | New `GET /me`/`GET /me/navigation` e2e blocks                                      |
| `test/health.e2e-spec.ts`                            | New build-metadata assertions                                                      |
| `package.json`                                       | Add `@sentry/node` dependency                                                      |

## `apps/dashboard-web` (frontend)

| File                                           | Change                                                       |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `app/(shell)/home/page.tsx`                    | New — the real Home landing page                             |
| `app/(shell)/layout.tsx`                       | New — the authenticated shell's session gate                 |
| `app/error.tsx`, `app/not-found.tsx`           | Rewritten to use `packages/ui`'s shared state components     |
| `app/globals.css`, `app/layout.tsx`            | Inject design-system CSS custom properties                   |
| `app/page.tsx`                                 | Redirect `/` → `/home`                                       |
| `components/app-shell.tsx` (+ `.module.css`)   | New — the shell chrome (header, nav, skip link)              |
| `lib/server-session.ts`                        | New — server-side session + navigation resolution            |
| `playwright.config.ts`                         | Fixture `NEXT_PUBLIC_API_BASE_URL` for the smoke-test server |
| `tests/e2e/accessibility.spec.ts`              | New — axe-core WCAG 2.2 AA checks                            |
| `tests/e2e/smoke.spec.ts`                      | Rewritten for the real shell/auth redirect behavior          |
| `tests/unit/app-shell.test.tsx` (+ `setup.ts`) | New RTL coverage; fixed a testing-library cleanup bug        |
| `package.json`                                 | Add `@axe-core/playwright` devDependency                     |

## `packages/database`

| File                                                      | Change                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `src/authz/entities.ts`, `models.ts`                      | Extend `ModuleRegistryEntity`/model with the full field set |
| `src/authz/index.ts`                                      | Export the new validation module                            |
| `src/authz/module-registry-validation.ts` (+ `.test.ts`)  | New — pure registry/permission-mapping validation           |
| `src/authz/module-registry.expected-keys.ts`              | New — versioned 43-key manifest                             |
| `src/authz/module-registry.repository.ts`                 | Extend `toEntity()`; add `listForNavigation()`              |
| `src/migrations/00034-extend-module-registry.ts`          | New — schema extension                                      |
| `src/migrations/00035-populate-module-registry-fields.ts` | New — real data for all 43 rows                             |
| `src/validate-module-registry.ts`                         | New — CLI entrypoint                                        |
| `package.json`                                            | Add `validate:module-registry` script                       |

## `packages/configuration`

| File                                   | Change                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| `src/build-metadata.ts` (+ `.test.ts`) | New — safe build/release metadata                                  |
| `src/sentry.ts` (+ `.test.ts`)         | New — per-environment Sentry config (data only, no SDK dependency) |
| `src/env.ts` (+ `.test.ts`)            | Add optional `SENTRY_DSN`                                          |
| `src/logging.ts` (+ `.test.ts`)        | Extend `DEFAULT_REDACT_PATHS`                                      |
| `src/index.ts`                         | Export the two new modules                                         |

## `packages/shared-types`

| File           | Change                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts` | Extend `ModuleRegistrySummary` with the full field set + `canView?`; add `HealthCheckBuildInfo`/`HealthCheckResult.build`; add `APPROVED_NAVIGATION_GROUPS` |

## `packages/ui` (new package content)

| File                                                 | Change                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `src/components/page-shell.tsx` (+ `.test.tsx`)      | New — Breadcrumbs/PageHeader/StatusBadge/ContentContainer/FiltersBar |
| `src/components/states.tsx` (+ `.test.tsx`)          | New — 9 shared UI-state components                                   |
| `src/tokens.ts` (+ `.test.ts`)                       | Extended with the full design-token set                              |
| `src/vitest.setup.ts`                                | New — fixes the testing-library cleanup bug                          |
| `src/index.ts`                                       | Export everything above                                              |
| `package.json`, `tsconfig.json`, `vitest.config.mts` | React/testing-library dependencies, JSX support, test config         |

## CI and documentation

| File                                                                  | Change                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                                            | Module-registry validation step, accessibility-check comment                          |
| `docs/task-packages/phase-1f-application-shell.md`                    | The formal task package                                                               |
| `docs/phase-plans/phase-1-foundation-plan.md`                         | Phase 1F kickoff addendum                                                             |
| `docs/phase-plans/module-implementation-roadmap.md`                   | New — computed build-order waves                                                      |
| `docs/task-packages/templates/module-implementation-task-template.md` | New — reusable template                                                               |
| `docs/implementation/phase-1f-*.md` (this file and its siblings)      | New — the required documentation set (brief §41)                                      |
| `docs/project-state/setup-input-register.md`                          | New Sentry-DSN open item                                                              |
| `pnpm-lock.yaml`                                                      | Reflects `@sentry/node`, `@axe-core/playwright`, and `packages/ui`'s new dependencies |

## What's conspicuously absent (by design)

No file under any of the 43 modules' eventual business routes exists yet — `apps/dashboard-web`
has exactly one real content page (`home`) beyond the pre-existing auth/health pages, and
`apps/dashboard-api` has no new business-module controller. This inventory is shell/registry/
observability infrastructure only, matching the brief's own scope boundary.
