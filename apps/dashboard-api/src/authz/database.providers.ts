import type { Provider } from "@nestjs/common";
import {
  AuthorizationActionRepository,
  ModuleRegistryRepository,
  ModuleRepository,
  RolePermissionRepository,
  RoleRepository,
  UserRoleRepository,
} from "@webdesk/database";
import {
  AUTHORIZATION_ACTION_REPOSITORY,
  MODULE_REGISTRY_REPOSITORY,
  MODULE_REPOSITORY,
  ROLE_PERMISSION_REPOSITORY,
  ROLE_REPOSITORY,
  USER_ROLE_REPOSITORY,
} from "./authz.constants.js";

/** DI wiring for `packages/database`'s Phase 1D RBAC repositories — same pattern as ../auth/database.providers.ts. */
export const authzRepositoryProviders: Provider[] = [
  { provide: ROLE_REPOSITORY, useFactory: () => new RoleRepository() },
  { provide: MODULE_REPOSITORY, useFactory: () => new ModuleRepository() },
  { provide: ROLE_PERMISSION_REPOSITORY, useFactory: () => new RolePermissionRepository() },
  { provide: USER_ROLE_REPOSITORY, useFactory: () => new UserRoleRepository() },
  { provide: MODULE_REGISTRY_REPOSITORY, useFactory: () => new ModuleRegistryRepository() },
  {
    provide: AUTHORIZATION_ACTION_REPOSITORY,
    useFactory: () => new AuthorizationActionRepository(),
  },
];
