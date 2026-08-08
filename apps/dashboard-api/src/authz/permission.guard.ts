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
import { AuthorizationService } from "./authorization.service.js";
import {
  PERMISSION_METADATA_KEY,
  type RequiredPermission,
} from "./require-permission.decorator.js";

/**
 * The authorization half — must run after `SessionGuard`
 * (`@UseGuards(SessionGuard, PermissionGuard)`, NestJS runs guards in
 * array order). Server-side only, per ADR-0010: this guard is the actual
 * access-control mechanism, never a UI-side hide. Calls the centralized
 * `AuthorizationService` (task package §13/§14) rather than embedding its
 * own grant-check logic — the guard's only job is request plumbing
 * (extract user/project, translate a denial into an HTTP exception) and
 * recording the real enforcement-point denial event.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
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

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params?: Record<string, string> }>();
    if (!request.authUser) {
      throw new ForbiddenException("Authentication required before authorization can be checked");
    }

    // Project-scoped routes are expected to expose the project id as a `:projectId` route param
    // once any exist (task package §6) — no controller does yet, so this is forward-compatible,
    // not yet exercised, plumbing.
    const projectId = request.params?.projectId;

    const decision = await this.authorization.evaluate(
      request.authUser.id,
      required.moduleKey,
      required.action,
      projectId,
    );
    if (!decision.allowed) {
      await this.authorization.recordAccessDenied(
        request.authUser.id,
        required.moduleKey,
        required.action,
        decision.reasonCode!,
      );
      throw new ForbiddenException(`Missing permission: ${required.moduleKey}:${required.action}`);
    }
    return true;
  }
}
