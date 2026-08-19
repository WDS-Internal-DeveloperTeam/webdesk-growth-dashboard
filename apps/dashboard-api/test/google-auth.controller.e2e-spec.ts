import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import cookieParser from "cookie-parser";
import { GoogleAuthController } from "../src/auth/google/google-auth.controller.js";
import { GoogleAuthService } from "../src/auth/google/google-auth.service.js";
import { SessionExchangeService } from "../src/auth/session/session-exchange.service.js";
import { AUTH_ENV } from "../src/auth/config/auth.constants.js";
import type { AuthEnv } from "../src/auth/config/auth-env.js";

/**
 * Regression coverage for a real production incident (2026-08-12): Express's
 * `req.protocol` defaults to `"http"` behind Vercel's TLS-terminating
 * reverse proxy unless `trust proxy` is set — which silently corrupted the
 * `redirect_uri` `openid-client` sends during token exchange (derived
 * directly from the callback URL's own protocol+host, see
 * `openid-client`'s `authorizationCodeGrant` → `stripParams(currentUrl)`),
 * causing every real Google login to fail with a generic `invalid_grant`
 * error at Google's token endpoint (surfaced here as `token_exchange_failed`).
 * No test exercised the controller's real `req.protocol`-based URL
 * construction before this — `google-auth.service.spec.ts` only tests
 * `handleCallback` in isolation against a hardcoded `https://` fixture, so
 * this specific bug was invisible to the existing suite.
 */
describe("GoogleAuthController — currentUrl construction (integration)", () => {
  let app: INestApplication;
  let handleCallback: ReturnType<typeof vi.fn>;
  let issueExchangeCode: ReturnType<typeof vi.fn>;

  const env = {
    OIDC_TRANSACTION_COOKIE_NAME: "wds_oidc_txn",
    WEB_APP_ORIGIN: "https://dashboard.example.com",
    SESSION_COOKIE_NAME: "wds_session",
    SESSION_COOKIE_SECURE: true,
    SESSION_MAX_AGE_SECONDS: 7 * 24 * 3600,
  } as AuthEnv;

  async function buildApp(
    trustProxy: boolean,
    handleCallbackResult: unknown = { ok: false, reason: "token_exchange_failed" },
    issueExchangeCodeImpl?: () => Promise<string>,
  ): Promise<INestApplication> {
    handleCallback = vi.fn().mockResolvedValue(handleCallbackResult);
    issueExchangeCode = issueExchangeCodeImpl
      ? vi.fn(issueExchangeCodeImpl)
      : vi.fn().mockResolvedValue("raw-exchange-code");

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GoogleAuthController],
      providers: [
        {
          provide: GoogleAuthService,
          useValue: { handleCallback, buildAuthorizationRequest: vi.fn() },
        },
        { provide: SessionExchangeService, useValue: { issue: issueExchangeCode } },
        { provide: AUTH_ENV, useValue: env },
      ],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    if (trustProxy) {
      nestApp.set("trust proxy", true);
    }
    nestApp.use(cookieParser());
    await nestApp.init();
    return nestApp;
  }

  afterEach(async () => {
    await app.close();
  });

  it("builds an https:// currentUrl from a forwarded-HTTPS request when trust proxy is enabled", async () => {
    app = await buildApp(true);
    const transaction = { state: "s", nonce: "n", codeVerifier: "v" };

    await request(app.getHttpServer())
      .get("/auth/google/callback?code=abc&state=s")
      .set("X-Forwarded-Proto", "https")
      .set(
        "Cookie",
        `${env.OIDC_TRANSACTION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(transaction))}`,
      );

    expect(handleCallback).toHaveBeenCalledTimes(1);
    const currentUrl = handleCallback.mock.calls[0]?.[0] as URL;
    expect(currentUrl.protocol).toBe("https:");
  });

  it("regression guard: without trust proxy, a forwarded-HTTPS request is misread as http:// — proves why the fix is necessary", async () => {
    app = await buildApp(false);
    const transaction = { state: "s", nonce: "n", codeVerifier: "v" };

    await request(app.getHttpServer())
      .get("/auth/google/callback?code=abc&state=s")
      .set("X-Forwarded-Proto", "https")
      .set(
        "Cookie",
        `${env.OIDC_TRANSACTION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(transaction))}`,
      );

    expect(handleCallback).toHaveBeenCalledTimes(1);
    const currentUrl = handleCallback.mock.calls[0]?.[0] as URL;
    expect(currentUrl.protocol).toBe("http:");
  });

  /**
   * Regression coverage for the cross-domain session-cookie bug
   * (docs/implementation/session-exchange.md): a successful callback must
   * redirect through `/auth/exchange`, not straight to `WEB_APP_ORIGIN`'s
   * root — the latter would strand the browser with only
   * `dashboard-api`'s own host-only cookie, never reaching `dashboard-web`.
   */
  it("on a successful callback, issues an exchange code and redirects to /auth/exchange?code=...", async () => {
    app = await buildApp(true, {
      ok: true,
      user: { id: "u1" },
      rawToken: "raw-session-token",
    });
    const transaction = { state: "s", nonce: "n", codeVerifier: "v" };

    const response = await request(app.getHttpServer())
      .get("/auth/google/callback?code=abc&state=s")
      .set("X-Forwarded-Proto", "https")
      .set(
        "Cookie",
        `${env.OIDC_TRANSACTION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(transaction))}`,
      );

    expect(issueExchangeCode).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", authMethod: "google_sso" }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      `${env.WEB_APP_ORIGIN}/auth/exchange?code=raw-exchange-code`,
    );
  });

  /**
   * Regression coverage for a real gap this branch's own code review surfaced: the exchange-code
   * issuance used to run AFTER `setSessionCookie()` with no guard, so a transient failure there
   * (e.g. a DB error) would leak a raw JSON 500 body while a valid session cookie was already
   * staged on the response. Fixed by issuing the code FIRST, guarded — this proves both halves of
   * the fix: a clean redirect (not a raw 500) and no `Set-Cookie` header on the failure response.
   */
  it("on a failure to issue the exchange code, redirects to /auth/error?reason=expired without staging a session cookie", async () => {
    app = await buildApp(
      true,
      { ok: true, user: { id: "u1" }, rawToken: "raw-session-token" },
      () => Promise.reject(new Error("transient DB error")),
    );
    const transaction = { state: "s", nonce: "n", codeVerifier: "v" };

    const response = await request(app.getHttpServer())
      .get("/auth/google/callback?code=abc&state=s")
      .set("X-Forwarded-Proto", "https")
      .set(
        "Cookie",
        `${env.OIDC_TRANSACTION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(transaction))}`,
      );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`${env.WEB_APP_ORIGIN}/auth/error?reason=expired`);
    const setCookie = (response.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
    expect(setCookie.some((cookie) => cookie.startsWith(`${env.SESSION_COOKIE_NAME}=`))).toBe(
      false,
    );
  });
});
