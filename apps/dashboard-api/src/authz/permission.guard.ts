import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
// Real (value) imports, not `import type` — NestJS constructor injection
// relies on emitDecoratorMetadata, which needs the actual class reference
// at runtime (see auth/google/google-auth.service.ts's identical note).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PermissionService } from "./permission.service.js";
import {
  PERMISSION_METADATA_KEY,
  type RequiredPermission,
} from "./require-permission.decorator.js";

/**
 * The authorization half — must run after `SessionGuard`
 * (`@UseGuards(SessionGuard, PermissionGuard)`, NestJS runs guards in
 * array order). Server-side only, per ADR-0010: this guard is the actual
 * access-control mechanism, never a UI-side hide.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission | undefined>(
      PERMISSION_METADATA_KEY,
      context.getHandler(),
    );
    if (!required) {
      // Deny-by-default extends to the framework itself: a route guarded
      // by PermissionGuard with no @RequirePermission is a developer
      // mistake (forgot to declare what's required), not "nothing to
      // check" — fails closed rather than silently allowing everything.
      throw new InternalServerErrorException(
        "Route is guarded by PermissionGuard but declares no @RequirePermission",
      );
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      throw new ForbiddenException("Authentication required before authorization can be checked");
    }

    const allowed = await this.permissionService.can(
      request.authUser.id,
      required.moduleKey,
      required.action,
    );
    if (!allowed) {
      throw new ForbiddenException(`Missing permission: ${required.moduleKey}:${required.action}`);
    }
    return true;
  }
}
