import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse, SessionInfo } from "@webdesk/shared-types";
import type { UserRepository } from "@webdesk/database";
import type { Response } from "express";
import type { RequestWithCorrelationId } from "../../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../common/origin-check.guard.js";
import { AUTH_ENV, USER_REPOSITORY } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { clearSessionCookie, readSessionCookie } from "./cookie.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionService } from "./session.service.js";

@ApiTags("auth")
@Controller("auth")
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
  ) {}

  @Get("session")
  @ApiOperation({ summary: "Current authenticated session, if any" })
  async getSession(@Req() req: RequestWithCorrelationId): Promise<ApiSuccessResponse<SessionInfo>> {
    const token = readSessionCookie(req, this.env);
    const session = token ? await this.sessionService.validate(token) : null;
    if (!session) {
      throw new UnauthorizedException("No active session");
    }

    const user = await this.users.findById(session.userId);
    if (!user || user.accountStatus !== "active") {
      throw new UnauthorizedException("No active session");
    }

    const data: SessionInfo = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        authMethod: session.authMethod,
      },
      expiresAt: session.expiresAt,
      mfaVerified: !session.requiresMfa,
    };
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard)
  @ApiOperation({ summary: "Log out — revokes the current session immediately, server-side" })
  async logout(
    @Req() req: RequestWithCorrelationId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ loggedOut: true }>> {
    const token = readSessionCookie(req, this.env);
    if (token) {
      const session = await this.sessionService.validate(token);
      if (session) {
        await this.sessionService.revoke(session.id, "user-initiated");
      }
    }
    clearSessionCookie(res, this.env);
    return {
      success: true,
      data: { loggedOut: true },
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
