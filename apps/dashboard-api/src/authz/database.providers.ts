import type { Provider } from "@nestjs/common";
import {
  ModuleRepository,
  RolePermissionRepository,
  RoleRepository,
  UserRoleRepository,
} from "@webdesk/database";
import {
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
];
