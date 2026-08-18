import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  EmergencyAdminCredentialRepository,
  UserRepository,
} from "@webdesk/database";
import * as client from "openid-client";
import { authenticator } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";
import {
  CorrelationIdMiddleware,
  type RequestWithCorrelationId,
} from "../src/common/correlation-id.middleware.js";
import { AuthModule } from "../src/auth/auth.module.js";
import { OIDC_CONFIGURATION } from "../src/auth/config/auth.constants.js";
import { hashPassword } from "../src/auth/crypto/password.js";
import { encryptTotpSecret } from "../src/auth/crypto/totp-encryption.js";
import { SessionExchangeService } from "../src/auth/session/session-exchange.service.js";
import cookieParser from "cookie-parser";
import type { NextFunction, Response } from "express";

/**
 * Full request-level coverage for the Phase 1C emergency-admin flow,
 * session lifecycle, and the CSRF guard — against a REAL disposable
 * PostgreSQL database (docs/contracts/google-workspace-auth-contract.md
 * "Test requirements"), never mocked at this layer. Requires DATABASE_URL
 * to point at a throwaway database (see packages/database/README.md) and
 * the auth env vars below — all fixture/test values, never a real Google
 * OAuth client. `OIDC_CONFIGURATION` is overridden with a directly-built
 * offline `Configuration` so this suite needs no network access; the
 * Google SSO flow itself is covered by google-auth.service.spec.ts's
 * mocked-exchange unit tests, not repeated here as an e2e concern.
 */

process.env.GOOGLE_OAUTH_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI ??= "https://api.example.com/auth/google/callback";
process.env.WEB_APP_ORIGIN ??= "https://dashboard.example.com";
process.env.TOTP_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");
// supertest talks to the in-process Nest app over plain HTTP, not TLS — a
// `Secure` cookie is correctly never resent by its cookie jar over http://,
// which would make every multi-request flow here fail for an environment
// reason, not a real one. Same disposable/local-only exception pattern as
// packages/database's `DATABASE_SSL=false` — never set for a real deployment.
process.env.SESSION_COOKIE_SECURE ??= "false";
process.env.AUTH_LOCKOUT_MAX_ATTEMPTS ??= "3";
process.env.AUTH_LOCKOUT_WINDOW_SECONDS ??= "900";
process.env.AUTH_LOCKOUT_DURATION_SECONDS ??= "900";

const WEB_APP_ORIGIN = process.env.WEB_APP_ORIGIN;

describe("Phase 1C auth endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let credentials: EmergencyAdminCredentialRepository;
  let sessionExchange: SessionExchangeService;
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const password = "correct-horse-battery-staple-1!";

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();

    const offlineOidcConfig = new client.Configuration(
      {
        issuer: "https://accounts.google.com",
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint: "https://oauth2.googleapis.com/token",
      },
      "test-client-id",
      "test-client-secret",
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(OIDC_CONFIGURATION)
      .useValue(offlineOidcConfig)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(cookieParser());
    const correlationIdMiddleware = new CorrelationIdMiddleware();
    app.use((req: RequestWithCorrelationId, res: Response, next: NextFunction) =>
      correlationIdMiddleware.use(req, res, next),
    );
    await app.init();

    users = new UserRepository();
    credentials = new EmergencyAdminCredentialRepository();
    sessionExchange = moduleRef.get(SessionExchangeService);

    const user = await users.create({
      email: "emergency.e2e@webdesksolution.com",
      displayName: "Emergency E2E",
      accountStatus: "active",
    });
    await credentials.create({
      userId: user.id,
      passwordHash: await hashPassword(password),
      totpSecretEncrypted: encryptTotpSecret(totpSecret, process.env.TOTP_ENCRYPTION_KEY as string),
      totpEnrolledAt: new Date(),
    });
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("OriginCheckGuard on state-changing auth endpoints", () => {
    it("rejects a login POST with no Origin/Referer header", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/emergency/login")
        .send({ email: "emergency.e2e@webdesksolution.com", password });
      expect(response.status).toBe(403);
    });

    it("rejects a login POST from a cross-origin Origin header", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/emergency/login")
        .set("Origin", "https://evil.example.com")
        .send({ email: "emergency.e2e@webdesksolution.com", password });
      expect(response.status).toBe(403);
    });
  });

  describe("Emergency-admin login — correct password, correct TOTP", () => {
    it("completes the two-step flow and issues a fully-verified session", async () => {
      const agent = request.agent(app.getHttpServer());

      const loginResponse = await agent
        .post("/auth/emergency/login")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ email: "emergency.e2e@webdesksolution.com", password });
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.mfaRequired).toBe(true);

      const pendingSessionCheck = await agent.get("/auth/session");
      expect(pendingSessionCheck.status).toBe(401); // pending-MFA session is not yet a valid credential

      const code = authenticator.generate(totpSecret);
      const totpResponse = await agent
        .post("/auth/emergency/totp")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ code });
      expect(totpResponse.status).toBe(200);
      expect(totpResponse.body.data.mfaRequired).toBe(false);

      const sessionResponse = await agent.get("/auth/session");
      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.data.user.email).toBe("emergency.e2e@webdesksolution.com");
      expect(sessionResponse.body.data.user.authMethod).toBe("emergency_local");
      expect(sessionResponse.body.data.mfaVerified).toBe(true);

      const logoutResponse = await agent
        .post("/auth/logout")
        .set("Origin", WEB_APP_ORIGIN as string);
      expect(logoutResponse.status).toBe(200);

      const afterLogout = await agent.get("/auth/session");
      expect(afterLogout.status).toBe(401);
    });
  });

  describe("Emergency-admin login — incorrect password", () => {
    it("rejects with a generic 401 and never issues a session", async () => {
      const agent = request.agent(app.getHttpServer());
      const response = await agent
        .post("/auth/emergency/login")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ email: "emergency.e2e@webdesksolution.com", password: "totally-wrong-pw" });

      expect(response.status).toBe(401);
      const sessionResponse = await agent.get("/auth/session");
      expect(sessionResponse.status).toBe(401);
    });

    it("rejects an unknown email with the identical generic 401", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/emergency/login")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ email: "nobody@webdesksolution.com", password: "anything" });
      expect(response.status).toBe(401);
    });
  });

  describe("Emergency-admin login — incorrect TOTP", () => {
    it("rejects step 2 with a generic 401 without elevating the session", async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post("/auth/emergency/login")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ email: "emergency.e2e@webdesksolution.com", password });

      const response = await agent
        .post("/auth/emergency/totp")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ code: "000000" });

      expect(response.status).toBe(401);
      const sessionResponse = await agent.get("/auth/session");
      expect(sessionResponse.status).toBe(401);
    });

    it("rejects a malformed (non-6-digit) code at the validation layer, before touching the credential", async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post("/auth/emergency/login")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ email: "emergency.e2e@webdesksolution.com", password });

      const response = await agent
        .post("/auth/emergency/totp")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ code: "not-digits" });

      expect(response.status).toBe(400);
    });
  });

  describe("Account lockout after repeated failures", () => {
    it("locks out the identifier after AUTH_LOCKOUT_MAX_ATTEMPTS failed password attempts, blocking even a subsequently correct password", async () => {
      const email = "lockout.e2e@webdesksolution.com";
      const lockoutUser = await users.create({
        email,
        displayName: "Lockout E2E",
        accountStatus: "active",
      });
      await credentials.create({
        userId: lockoutUser.id,
        passwordHash: await hashPassword(password),
        totpSecretEncrypted: encryptTotpSecret(
          totpSecret,
          process.env.TOTP_ENCRYPTION_KEY as string,
        ),
        totpEnrolledAt: new Date(),
      });

      const maxAttempts = Number(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS);
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await request(app.getHttpServer())
          .post("/auth/emergency/login")
          .set("Origin", WEB_APP_ORIGIN as string)
          .send({ email, password: "wrong-every-time" });
        expect(response.status).toBe(401);
      }

      // Now even the CORRECT password is rejected — proves the lockout is real, not just a coincidental streak of wrong-password rejections.
      const afterLockout = await request(app.getHttpServer())
        .post("/auth/emergency/login")
        .set("Origin", WEB_APP_ORIGIN as string)
        .send({ email, password });
      expect(afterLockout.status).toBe(401);
    });
  });

  describe("GET /auth/google/start", () => {
    it("redirects to Google's authorization endpoint with PKCE/state/nonce, and sets the transaction cookie", async () => {
      const response = await request(app.getHttpServer()).get("/auth/google/start");
      expect(response.status).toBe(302);
      const location = new URL(response.headers.location as string);
      expect(location.origin).toBe("https://accounts.google.com");
      expect(location.searchParams.get("code_challenge_method")).toBe("S256");
      expect(location.searchParams.has("state")).toBe(true);
      expect(location.searchParams.has("nonce")).toBe(true);

      const setCookie = response.headers["set-cookie"] as unknown as string[];
      expect(setCookie.some((cookie) => cookie.startsWith("wds_oidc_txn="))).toBe(true);
    });
  });

  describe("GET /auth/google/callback", () => {
    it("redirects to the generic error page when the transaction cookie is missing", async () => {
      const response = await request(app.getHttpServer()).get(
        "/auth/google/callback?code=abc&state=xyz",
      );
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`${WEB_APP_ORIGIN}/auth/error?reason=expired`);
    });
  });

  /**
   * `POST /auth/exchange` — the server-to-server leg `dashboard-web`'s own exchange route calls
   * to redeem a session-exchange code (docs/implementation/session-exchange.md). Exercised here
   * against the real `SessionExchangeService`/repository/database, not mocked — the Google OIDC
   * callback's own success path is covered separately (mocked) in
   * `google-auth.controller.e2e-spec.ts`, since driving a real token exchange here would require
   * real network access to Google.
   */
  describe("POST /auth/exchange", () => {
    it("redeems a valid code into a brand-new, independently-valid session, exactly once", async () => {
      const user = await users.create({
        email: "exchange.e2e@webdesksolution.com",
        displayName: "Exchange E2E",
        accountStatus: "active",
      });
      const rawCode = await sessionExchange.issue({ userId: user.id, authMethod: "google_sso" });

      const response = await request(app.getHttpServer())
        .post("/auth/exchange")
        .send({ code: rawCode });

      expect(response.status).toBe(200);
      expect(typeof response.body.data.sessionToken).toBe("string");
      expect(response.body.data.sessionToken.length).toBeGreaterThan(0);

      // The minted session is real and independently valid — proven via a second agent that never
      // touched the original login cookie, using only the exchanged raw token.
      const verifyAgent = request.agent(app.getHttpServer());
      const sessionCheck = await verifyAgent
        .get("/auth/session")
        .set("Cookie", `wds_session=${response.body.data.sessionToken as string}`);
      expect(sessionCheck.status).toBe(200);
      expect(sessionCheck.body.data.user.email).toBe("exchange.e2e@webdesksolution.com");

      // Single-use: redeeming the same raw code again must fail.
      const secondAttempt = await request(app.getHttpServer())
        .post("/auth/exchange")
        .send({ code: rawCode });
      expect(secondAttempt.status).toBe(400);
    });

    it("rejects an unknown code with a generic 400, no session issued", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/exchange")
        .send({ code: "this-code-was-never-issued" });
      expect(response.status).toBe(400);
    });

    it("rejects a missing code at the validation layer", async () => {
      const response = await request(app.getHttpServer()).post("/auth/exchange").send({});
      expect(response.status).toBe(400);
    });

    it("requires no Origin header — this is a server-to-server call, not a browser-mediated one", async () => {
      const user = await users.create({
        email: "exchange.no-origin.e2e@webdesksolution.com",
        displayName: "Exchange No Origin E2E",
        accountStatus: "active",
      });
      const rawCode = await sessionExchange.issue({ userId: user.id, authMethod: "google_sso" });

      const response = await request(app.getHttpServer())
        .post("/auth/exchange")
        .send({ code: rawCode });
      expect(response.status).toBe(200);
    });
  });
});
