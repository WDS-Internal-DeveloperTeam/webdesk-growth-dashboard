import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { AUTH_ENV } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { readSessionCookie } from "./cookie.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionService } from "./session.service.js";

/** Populated by `SessionGuard` — every route it protects can rely on `request.authUser` being present and valid. */
export interface AuthenticatedRequest extends Request {
  authUser?: { readonly id: string; readonly sessionId: string };
}

/**
 * The authentication half of "authenticate, then authorize" — RBAC's
 * `PermissionGuard` (../authz/permission.guard.ts) depends on this having
 * already run and populated `request.authUser`. Rejects a missing,
 * invalid, expired, revoked, or still-pending-MFA session with a generic
 * 401 (delegates the actual validity rules to `SessionService.validate`,
 * already proven in Phase 1C).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionCookie(request, this.env);
    if (!token) {
      throw new UnauthorizedException("No active session");
    }
    const session = await this.sessionService.validate(token);
    if (!session) {
      throw new UnauthorizedException("No active session");
    }
    request.authUser = { id: session.userId, sessionId: session.id };
    return true;
  }
}
