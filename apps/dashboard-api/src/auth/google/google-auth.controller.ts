import { Controller, Get, HttpStatus, Inject, Req, Res } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AUTH_ENV } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { getIpHash, getUserAgent } from "../common/request-context.util.js";
import { setSessionCookie } from "../session/cookie.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionExchangeService } from "../session/session-exchange.service.js";
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
 * controller redirects back to `WEB_APP_ORIGIN` when the flow is done.
 * Excluded from the OpenAPI document (`@ApiExcludeEndpoint`) — these are
 * browser-redirect endpoints, not a JSON API surface.
 *
 * The callback sets `dashboard-api`'s own session cookie (still needed for
 * direct browser-mediated `credentials: "include"` fetches to `dashboard-api`
 * from mutation UIs) **and** redirects through a session-exchange code
 * rather than straight to `WEB_APP_ORIGIN`'s root — that cookie is host-only
 * to `dashboard-api`'s own domain and would never reach `dashboard-web`'s
 * separate domain otherwise. See `docs/implementation/session-exchange.md`.
 */
@Controller("auth/google")
export class GoogleAuthController {
  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly sessionExchange: SessionExchangeService,
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

    const ipHash = getIpHash(req);
    const userAgent = getUserAgent(req);
    const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host") ?? ""}`);
    const result = await this.googleAuth.handleCallback(currentUrl, transaction, {
      ipHash,
      userAgent,
    });

    if (!result.ok) {
      res.redirect(HttpStatus.FOUND, `${this.env.WEB_APP_ORIGIN}/auth/error?reason=access_denied`);
      return;
    }

    // Issued BEFORE the cookie is set (and guarded), not after — so a failure here (e.g. a
    // transient DB error) can never leave the browser holding a valid session cookie alongside a
    // raw, unstyled 500 response. Redirects with reason=error, NOT reason=expired — this is a real
    // backend failure (e.g. the 2026-08-19 incident: a login raced migration 00046, so the INSERT
    // hit Postgres 42P01 "undefined_table"), not an actually-expired OIDC transaction, and labeling
    // it "expired" masked the real cause from the user and made the incident harder to triage.
    let exchangeCode: string;
    try {
      exchangeCode = await this.sessionExchange.issue({
        userId: result.user.id,
        authMethod: "google_sso",
        ipHash,
        userAgent,
      });
    } catch (error) {
      console.error("GoogleAuthController#callback: failed to issue session-exchange code", error);
      res.redirect(HttpStatus.FOUND, `${this.env.WEB_APP_ORIGIN}/auth/error?reason=error`);
      return;
    }

    setSessionCookie(res, result.rawToken, this.env);
    res.redirect(
      HttpStatus.FOUND,
      `${this.env.WEB_APP_ORIGIN}/auth/exchange?code=${encodeURIComponent(exchangeCode)}`,
    );
  }
}
