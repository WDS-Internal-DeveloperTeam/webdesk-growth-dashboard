import {
  BadRequestException,
  Body,
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
  UsePipes,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse, SessionInfo } from "@webdesk/shared-types";
import type { UserRepository } from "@webdesk/database";
import type { Response } from "express";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import type { RequestWithCorrelationId } from "../../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../common/origin-check.guard.js";
import { getIpHash, getUserAgent } from "../common/request-context.util.js";
import { AUTH_ENV, USER_REPOSITORY } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { clearSessionCookie, readSessionCookie } from "./cookie.util.js";
import { sessionExchangeSchema, type SessionExchangeDto } from "./session-exchange.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionService } from "./session.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionExchangeService } from "./session-exchange.service.js";

/** `dashboard-web`'s own exchange route redeems a code into this — never a documented public API shape (`@webdesk/shared-types`), since no client other than `dashboard-web`'s own server-to-server call is meant to consume it. */
export interface SessionExchangeResult {
  readonly sessionToken: string;
  readonly expiresAt: string;
}

@ApiTags("auth")
@Controller("auth")
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sessionExchangeService: SessionExchangeService,
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

  /**
   * Server-to-server only — called by `dashboard-web`'s own exchange route, never by a browser
   * directly. Authenticated purely by possession of the single-use, 256-bit-random code (same
   * security model as a password-reset token) — no session cookie or `OriginCheckGuard` applies
   * here, since there is no browser-held cookie to check at this leg and no forgeable session to
   * protect (see `docs/implementation/session-exchange.md`).
   */
  @Post("exchange")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(sessionExchangeSchema))
  @ApiOperation({ summary: "Redeem a single-use session-exchange code (server-to-server only)" })
  async exchange(
    @Body() dto: SessionExchangeDto,
    @Req() req: RequestWithCorrelationId,
  ): Promise<ApiSuccessResponse<SessionExchangeResult>> {
    const issued = await this.sessionExchangeService.redeem(dto.code, {
      ipHash: getIpHash(req),
      userAgent: getUserAgent(req),
    });
    if (!issued) {
      throw new BadRequestException("Invalid or expired exchange code");
    }
    return {
      success: true,
      data: { sessionToken: issued.rawToken, expiresAt: issued.session.expiresAt },
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
