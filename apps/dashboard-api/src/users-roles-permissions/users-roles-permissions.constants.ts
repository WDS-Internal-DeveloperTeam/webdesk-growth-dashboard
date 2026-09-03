/**
 * RBAC group key for the "Users, Roles and Permissions" module (module registry key
 * `users_roles_permissions`; seeded RBAC permission-group key `users_roles`, the same group
 * `role-assignment.controller.ts`/`users.controller.ts` already gate on — this module is an
 * admin surface layered on top of the already-built RBAC core, not a new permission group).
 * Reused in every `@RequirePermission` call here instead of a repeated string literal.
 */
export const USERS_ROLES_PERMISSIONS_MODULE_KEY = "users_roles" as const;
