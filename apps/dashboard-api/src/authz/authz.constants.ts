/** NestJS DI tokens for Phase 1D RBAC — kept in one file, same pattern as ../auth/config/auth.constants.ts. */
export const ROLE_REPOSITORY = Symbol("ROLE_REPOSITORY");
export const MODULE_REPOSITORY = Symbol("MODULE_REPOSITORY");
export const ROLE_PERMISSION_REPOSITORY = Symbol("ROLE_PERMISSION_REPOSITORY");
export const USER_ROLE_REPOSITORY = Symbol("USER_ROLE_REPOSITORY");
