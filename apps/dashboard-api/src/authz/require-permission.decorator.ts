import { SetMetadata } from "@nestjs/common";

export const PERMISSION_METADATA_KEY = "requiredPermission";

export interface RequiredPermission {
  readonly moduleKey: string;
  readonly action: string;
}

/**
 * Declares the module+action a route requires — the base skill's own
 * rule, restated: "every protected route declares the module + action it
 * needs" (`nodejs/knowledge/security/02-authn-authz.md`). Always pair with
 * `@UseGuards(SessionGuard, PermissionGuard)`; `PermissionGuard` fails
 * closed with a 500 if applied to a route with no `@RequirePermission` at
 * all — a missing decorator is a developer mistake, not "nothing to
 * check."
 */
export const RequirePermission = (moduleKey: string, action: string) =>
  SetMetadata(PERMISSION_METADATA_KEY, { moduleKey, action } satisfies RequiredPermission);
