import type { SessionExchangeCodeRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import { hashSessionToken } from "../crypto/session-token.js";
import type { IssuedSession, SessionService } from "./session.service.js";
import { SessionExchangeService } from "./session-exchange.service.js";

const env = { SESSION_EXCHANGE_CODE_MAX_AGE_SECONDS: 60 } as AuthEnv;

describe("SessionExchangeService", () => {
  let exchangeCodes: {
    create: ReturnType<typeof vi.fn>;
    redeem: ReturnType<typeof vi.fn>;
  };
  let sessions: { issue: ReturnType<typeof vi.fn> };
  let service: SessionExchangeService;

  beforeEach(() => {
    exchangeCodes = { create: vi.fn(), redeem: vi.fn() };
    sessions = { issue: vi.fn() };
    service = new SessionExchangeService(
      exchangeCodes as unknown as SessionExchangeCodeRepository,
      sessions as unknown as SessionService,
      env,
    );
  });

  describe("issue()", () => {
    it("stores a hash of the returned raw code, never the raw value itself", async () => {
      exchangeCodes.create.mockResolvedValue({ id: "c1" });

      const rawCode = await service.issue({ userId: "u1", authMethod: "google_sso" });

      expect(rawCode.length).toBeGreaterThan(0);
      const createCall = exchangeCodes.create.mock.calls[0]?.[0];
      expect(createCall.codeHash).toBe(hashSessionToken(rawCode));
      expect(createCall.codeHash).not.toBe(rawCode);
    });

    it("expires the code SESSION_EXCHANGE_CODE_MAX_AGE_SECONDS after `now`", async () => {
      exchangeCodes.create.mockResolvedValue({ id: "c1" });
      const now = new Date("2026-01-01T00:00:00.000Z");

      await service.issue({ userId: "u1", authMethod: "google_sso", now });

      const createCall = exchangeCodes.create.mock.calls[0]?.[0];
      expect(createCall.expiresAt).toEqual(
        new Date(now.getTime() + env.SESSION_EXCHANGE_CODE_MAX_AGE_SECONDS * 1000),
      );
    });

    it("passes the given userId/authMethod through to the repository", async () => {
      exchangeCodes.create.mockResolvedValue({ id: "c1" });

      await service.issue({ userId: "u1", authMethod: "google_sso" });

      const createCall = exchangeCodes.create.mock.calls[0]?.[0];
      expect(createCall.userId).toBe("u1");
      expect(createCall.authMethod).toBe("google_sso");
    });
  });

  describe("redeem()", () => {
    it("returns null without minting a session when the code is missing, expired, or already redeemed", async () => {
      exchangeCodes.redeem.mockResolvedValue(null);

      const result = await service.redeem("some-code", {});

      expect(result).toBeNull();
      expect(sessions.issue).not.toHaveBeenCalled();
    });

    it("mints a brand-new, independent second session for the redeemed code's user", async () => {
      exchangeCodes.redeem.mockResolvedValue({
        id: "c1",
        userId: "u1",
        authMethod: "google_sso",
      });
      const issued: IssuedSession = {
        session: { id: "s2" } as IssuedSession["session"],
        rawToken: "new-raw-token",
      };
      sessions.issue.mockResolvedValue(issued);

      const result = await service.redeem(
        "raw-code",
        { ipHash: "hash1", userAgent: "ua1" },
        new Date("2026-01-01T00:00:00.000Z"),
      );

      expect(result).toBe(issued);
      expect(sessions.issue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          authMethod: "google_sso",
          requiresMfa: false,
          ipHash: "hash1",
          userAgent: "ua1",
        }),
      );
    });

    it("hashes the raw code the same way issue() does, so redeem() can find what issue() stored", async () => {
      exchangeCodes.redeem.mockResolvedValue(null);

      await service.redeem("raw-code-value", {});

      expect(exchangeCodes.redeem).toHaveBeenCalledWith(
        hashSessionToken("raw-code-value"),
        expect.any(Date),
      );
    });
  });
});
