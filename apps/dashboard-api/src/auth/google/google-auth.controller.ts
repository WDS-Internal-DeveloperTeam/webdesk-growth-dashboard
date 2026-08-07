import { Controller, Get, HttpStatus, Inject, Req, Res } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AUTH_ENV } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { getIpHash, getUserAgent } from "../common/request-context.util.js";
import { setSessionCookie } from "../session/cookie.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { GoogleAuthService } from "./google-auth.service.js";
import {
  clearOidcTransactionCookie,
  readOidcTransactionCookie,
  setOidcTransactionCookie,
} from "./oidc-transaction.js";

/**
 * Google Workspace OIDC — `dashboard-web` never handles OAuth tokens
 * directly (docs/contracts/google-workspace-auth-contract.md "Trust
 * boundary"): it links or top-level-redirects the browser here, and this
 * controller redirects back to `WEB_APP_ORIGIN` when the flow is done, with
 * the session cookie already set. Excluded from the OpenAPI document
 * (`@ApiExcludeEndpoint`) — these are browser-redirect endpoints, not a
 * JSON API surface.
 */
@Controller("auth/google")
export class GoogleAuthController {
  constructor(
    private readonly googleAuth: GoogleAuthService,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
  ) {}

  @Get("start")
  @ApiExcludeEndpoint()
  async start(@Res() res: Response): Promise<void> {
    const { redirectUrl, transaction } = await this.googleAuth.buildAuthorizationRequest();
    setOidcTransactionCookie(res, transaction, this.env);
    res.redirect(HttpStatus.FOUND, redirectUrl.toString());
  }

  @Get("callback")
  @ApiExcludeEndpoint()
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const transaction = readOidcTransactionCookie(req, this.env);
    clearOidcTransactionCookie(res, this.env);

    if (!transaction) {
      res.redirect(HttpStatus.FOUND, `${this.env.WEB_APP_ORIGIN}/auth/error?reason=expired`);
      return;
    }

    const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host") ?? ""}`);
    const result = await this.googleAuth.handleCallback(currentUrl, transaction, {
      ipHash: getIpHash(req),
      userAgent: getUserAgent(req),
    });

    if (!result.ok) {
      res.redirect(HttpStatus.FOUND, `${this.env.WEB_APP_ORIGIN}/auth/error?reason=access_denied`);
      return;
    }

    setSessionCookie(res, result.rawToken, this.env);
    res.redirect(HttpStatus.FOUND, this.env.WEB_APP_ORIGIN);
  }
}
