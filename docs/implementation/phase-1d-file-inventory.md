# Phase 1D (Expanded) — File Inventory

**Status:** Draft, produced during implementation of
`docs/task-packages/phase-1d-rbac-permissions-expanded.md`. Every file below is a real change on
branch `phase-1d-rbac-permissions-expanded` (base: `main` at the same commit `PR #8` merged to),
generated from `git status --short` — not a hand-maintained list that can drift from reality.

## 1. New migrations (`packages/database/src/migrations/`)

| File                                    | Purpose                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `00014-create-module-registry.ts`       | `module_registry` table (43-module lookup, FK to `modules`).                                |
| `00015-seed-module-registry.ts`         | Seeds the 43 real modules, mapped to their 21-row permission group.                         |
| `00016-add-project-scoping.ts`          | `user_roles.project_id`; replaces the global unique index with partial global/project ones. |
| `00017-create-authorization-actions.ts` | `authorization_actions` append-only table (separation-of-duties cross-request check).       |

## 2. New database-layer source (`packages/database/src/authz/`)

| File                                 | Purpose                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `authorization-action.repository.ts` | `record()` / `findActorsForResource()` for `authorization_actions`. |
| `module-registry.repository.ts`      | `findByKey()` / `listAll()` for the 43-module registry.             |

## 3. Modified database-layer source

| File                                  | Change                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `authz/entities.ts`                   | Added `projectId` to `UserRoleEntity`; new `ModuleRegistryEntity`/`AuthorizationActionEntity`.        |
| `authz/models.ts`                     | Sequelize model definitions for the two new entities; `projectId` field on `UserRole`.                |
| `authz/user-role.repository.ts`       | `findRoleIdsForUser`/`hasRole`/`assign`/`revoke` gained optional `projectId`; new `anyUserHoldsRole`. |
| `authz/role-permission.repository.ts` | `hasGrant` gained optional `projectId`; new `listGrantsForRoles` (N+1-safe capability aggregation).   |
| `authz/index.ts`                      | Barrel export additions for the two new repositories.                                                 |

## 4. New `dashboard-api` authorization source (`apps/dashboard-api/src/authz/`)

| File                               | Purpose                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `authorization.service.ts`         | Centralized `AuthorizationService` (task package §13) — retires `PermissionService`.   |
| `capabilities.controller.ts`       | `GET /me/capabilities`.                                                                |
| `catalog.controller.ts`            | `GET /authz/modules`, `GET /authz/module-registry`.                                    |
| `catalog.service.ts`               | Backing service for the two catalog endpoints.                                         |
| `confidential-field.util.ts`       | `redactConfidentialFields`/`redactConfidentialFieldsFromList` — pure, entity-agnostic. |
| `scripts/bootstrap-super-admin.ts` | Operator-run CLI, mirrors `provision-emergency-admin.ts`'s pattern (task package §18). |

## 5. Deleted `dashboard-api` source

| File                               | Reason                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `authz/permission.service.ts`      | Fully retired — `AuthorizationService` is the single grant-check code path (task §13/§14). |
| `authz/permission.service.spec.ts` | Removed alongside its subject.                                                             |

## 6. Modified `dashboard-api` source

| File                                          | Change                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `auth/auth.module.ts`                         | Registers `AuthorizationActionRepository` provider for `SeparationOfDutiesService`.                       |
| `auth/common/separation-of-duties.service.ts` | New `assertNoPriorConflictingAction`/`recordAction`, using the new repository.                            |
| `authz/authz.constants.ts`                    | New `MODULE_REGISTRY_REPOSITORY`, `AUTHORIZATION_ACTION_REPOSITORY` DI tokens.                            |
| `authz/authz.module.ts`                       | Swaps `PermissionService`→`AuthorizationService`; registers `CapabilitiesController`/`CatalogController`. |
| `authz/database.providers.ts`                 | Provider registrations for the two new repository tokens.                                                 |
| `authz/permission.guard.ts`                   | Injects `AuthorizationService` instead of `PermissionService`; unchanged request plumbing.                |
| `authz/role-assignment.service.ts`            | Self-role-assignment blocking (SoD) + `separation_of_duties_denied` event recording.                      |
| `apps/dashboard-api/package.json`             | New `bootstrap:super-admin` script.                                                                       |

## 7. New/modified test files

| File                                                       | Coverage                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `authz/authorization.service.spec.ts` (new)                | 15 unit tests — `evaluate`/`can`/confidential checks/`getEffectiveCapabilities`/N+1 proof.                     |
| `authz/permission.guard.spec.ts`                           | Rewritten to mock `AuthorizationService`.                                                                      |
| `authz/role-assignment.service.spec.ts`                    | + SoD self-targeting tests, + `separation_of_duties_denied` event assertions.                                  |
| `authz/confidential-field.util.spec.ts` (new)              | 6 unit tests.                                                                                                  |
| `authz/catalog.service.spec.ts` (new)                      | 3 unit tests.                                                                                                  |
| `auth/common/separation-of-duties.service.spec.ts`         | + `assertNoPriorConflictingAction`/`recordAction` tests.                                                       |
| `auth/recovery/recovery.service.spec.ts`                   | Updated `SeparationOfDutiesService` construction for the new repository dependency.                            |
| `test/authz.e2e-spec.ts`                                   | + privilege-escalation, `/me/capabilities`, `/authz/modules`, `/authz/module-registry` suites (real database). |
| `packages/database/test/phase1d-authz.integration.test.ts` | + module registry, project-scoping, `authorization_actions` suites (real database).                            |

## 8. New shared types

`packages/shared-types/src/index.ts` — 7 new `AuthEventType` values (`permission_granted`,
`permission_revoked`, `privileged_access_denied`, `confidential_field_accessed`,
`separation_of_duties_denied`, `super_admin_bootstrap`, `authorization_configuration_changed`);
new `ModuleSummary`/`ModuleRegistrySummary` interfaces.

## 9. New documentation (this phase's own §29 deliverables)

`docs/implementation/phase-1d-permission-catalog.md`, `phase-1d-rbac-architecture.md`,
`phase-1d-role-permission-matrix.md`, `phase-1d-separation-of-duties.md`,
`phase-1d-confidential-field-authorization.md`, `phase-1d-file-inventory.md` (this document).
`phase-1d-security-review.md`, `docs/project-state/phase-1d-validation-report.md` (addendum),
and `docs/project-state/phase-1d-approval-checklist.md` are tracked separately (still in
progress at the time this inventory was generated — see the task list in the session that
produced it).

## 10. Not touched

No `dashboard-web` frontend files, no `dashboard-worker` files, no CI workflow files, no
`packages/configuration`/`packages/validation`/`packages/ui`/`packages/integrations` files — this
phase's real changes are confined to the authorization surface in `packages/database` and
`apps/dashboard-api`, plus shared types and documentation, matching task package §32's scope
boundary.
