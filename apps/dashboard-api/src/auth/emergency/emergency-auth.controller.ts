import {
  Body,
  Controller,
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
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { Response } from "express";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import type { RequestWithCorrelationId } from "../../common/correlation-id.middleware.js";
import { getIpHash, getUserAgent } from "../common/request-context.util.js";
import { OriginCheckGuard } from "../common/origin-check.guard.js";
import { AUTH_ENV } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "../session/cookie.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { EmergencyAdminService } from "./emergency-admin.service.js";
import {
  emergencyLoginSchema,
  emergencyTotpSchema,
  type EmergencyLoginDto,
  type EmergencyTotpDto,
} from "./emergency-auth.dto.js";

/**
 * ADR-0009 — not exposed as an equally-weighted option alongside SSO in the
 * normal login UI (knowledge/05); this controller is the mechanism, not the
 * UX framing. `OriginCheckGuard` on every route here — this path uses
 * cookie-based auth without an OAuth `state` parameter of its own, so the
 * Origin/Referer check is the primary CSRF defense (on top of
 * SameSite=Strict).
 */
@ApiTags("auth")
@Controller("auth/emergency")
@UseGuards(OriginCheckGuard)
export class EmergencyAuthController {
  constructor(
    private readonly emergencyAuth: EmergencyAdminService,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(emergencyLoginSchema))
  @ApiOperation({ summary: "Emergency-administrator login, step 1 of 2 (password)" })
  async login(
    @Body() body: EmergencyLoginDto,
    @Req() req: RequestWithCorrelationId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ mfaRequired: true }>> {
    const result = await this.emergencyAuth.login(body.email, body.password, {
      ipHash: getIpHash(req),
      userAgent: getUserAgent(req),
    });

    if (!result.ok) {
      // Generic message regardless of unknown-email / wrong-password /
      // disabled-credential / locked-out — no user enumeration.
      throw new UnauthorizedException("Invalid credentials");
    }

    setSessionCookie(res, result.rawToken, this.env, this.env.SESSION_PENDING_MFA_MAX_AGE_SECONDS);
    return {
      success: true,
      data: { mfaRequired: true },
      correlationId: req.correlationId ?? "unknown",
    };
  }

  @Post("totp")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(emergencyTotpSchema))
  @ApiOperation({ summary: "Emergency-administrator login, step 2 of 2 (TOTP)" })
  async totp(
    @Body() body: EmergencyTotpDto,
    @Req() req: RequestWithCorrelationId,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ mfaRequired: false }>> {
    const pendingToken = readSessionCookie(req, this.env);
    if (!pendingToken) {
      throw new UnauthorizedException("No pending emergency-admin login");
    }

    const result = await this.emergencyAuth.verifyTotp(pendingToken, body.code, {
      ipHash: getIpHash(req),
      userAgent: getUserAgent(req),
    });

    if (!result.ok) {
      clearSessionCookie(res, this.env);
      throw new UnauthorizedException("Invalid code");
    }

    // Same underlying session/token, now elevated — re-set the cookie so
    // the browser keeps it for the full session lifetime, not just the
    // short pending-MFA window it was originally issued with.
    setSessionCookie(res, pendingToken, this.env);
    return {
      success: true,
      data: { mfaRequired: false },
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
