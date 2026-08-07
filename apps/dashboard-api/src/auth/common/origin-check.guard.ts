import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { AUTH_ENV } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";

/**
 * CSRF defense-in-depth for cookie-authenticated, state-changing auth
 * endpoints (logout, emergency login/TOTP) that aren't already protected by
 * the OAuth `state` parameter the Google flow uses. SameSite=Strict on the
 * session cookie is the primary defense; this guard is a second,
 * independent check against a spoofed cross-site form/fetch — no `csurf`/
 * double-submit-cookie library (unmaintained, known weaknesses in its
 * default mode) for what a same-origin-only API can check directly.
 *
 * Compares Origin/Referer against `WEB_APP_ORIGIN`, a configured trusted
 * value — never against the incoming request's own Host header. A forged
 * cross-site request is still correctly addressed to this server (that's
 * how it reaches the server at all), so Host is always "correct" from the
 * attacker's perspective; only an independently-known trusted origin is a
 * valid comparison target.
 */
@Injectable()
export class OriginCheckGuard implements CanActivate {
  constructor(@Inject(AUTH_ENV) private readonly env: AuthEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.header("origin") ?? request.header("referer");
    if (!supplied) {
      // A same-origin browser POST always sends at least one of these; a
      // missing pair is treated as suspicious, not permissively allowed.
      throw new ForbiddenException("Missing Origin/Referer header");
    }

    let suppliedOrigin: string;
    try {
      suppliedOrigin = new URL(supplied).origin;
    } catch {
      throw new ForbiddenException("Malformed Origin/Referer header");
    }

    if (suppliedOrigin !== new URL(this.env.WEB_APP_ORIGIN).origin) {
      throw new ForbiddenException("Cross-origin request rejected");
    }
    return true;
  }
}
