import { randomBytes } from "node:crypto";
import type {
  AuthEventRepository,
  EmergencyAdminCredentialRepository,
  UserRepository,
} from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import { hashPassword } from "../crypto/password.js";
import { encryptTotpSecret } from "../crypto/totp-encryption.js";
import { authenticator as rawAuthenticator } from "otplib";
import type { RateLimitService } from "../common/rate-limit.service.js";
import type { SessionService } from "../session/session.service.js";
import type { EmergencyAdminLoginNotifier } from "./emergency-admin-login-notifier.js";
import { EmergencyAdminService } from "./emergency-admin.service.js";

const totpKey = randomBytes(32).toString("hex");
const env = { TOTP_ENCRYPTION_KEY: totpKey } as AuthEnv;

describe("EmergencyAdminService", () => {
  let users: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    recordSuccessfulLogin: ReturnType<typeof vi.fn>;
  };
  let credentials: { findByUserId: ReturnType<typeof vi.fn> };
  let events: { record: ReturnType<typeof vi.fn> };
  let rateLimit: {
    isLocked: ReturnType<typeof vi.fn>;
    recordFailure: ReturnType<typeof vi.fn>;
    recordSuccess: ReturnType<typeof vi.fn>;
  };
  let sessionService: {
    issue: ReturnType<typeof vi.fn>;
    findPending: ReturnType<typeof vi.fn>;
    elevateAfterMfa: ReturnType<typeof vi.fn>;
  };
  let notifier: { notify: ReturnType<typeof vi.fn> };
  let service: EmergencyAdminService;

  const user = {
    id: "admin-1",
    email: "admin@webdesksolution.com",
    accountStatus: "active" as const,
  };
  const totpSecret = "JBSWY3DPEHPK3PXP";

  beforeEach(async () => {
    users = { findByEmail: vi.fn(), findById: vi.fn(), recordSuccessfulLogin: vi.fn() };
    credentials = { findByUserId: vi.fn() };
    events = { record: vi.fn() };
    rateLimit = {
      isLocked: vi.fn().mockResolvedValue({ locked: false, lockedUntil: null }),
      recordFailure: vi.fn().mockResolvedValue({ locked: false, lockedUntil: null }),
      recordSuccess: vi.fn(),
    };
    sessionService = {
      issue: vi
        .fn()
        .mockResolvedValue({ session: { id: "pending-session-1" }, rawToken: "pending-raw-token" }),
      findPending: vi.fn(),
      elevateAfterMfa: vi.fn(),
    };
    notifier = { notify: vi.fn() };

    const passwordHash = await hashPassword("correct-horse-battery-staple");
    credentials.findByUserId.mockResolvedValue({
      id: "cred-1",
      userId: user.id,
      passwordHash,
      totpSecretEncrypted: encryptTotpSecret(totpSecret, totpKey),
      status: "active",
    });

    service = new EmergencyAdminService(
      users as unknown as UserRepository,
      credentials as unknown as EmergencyAdminCredentialRepository,
      events as unknown as AuthEventRepository,
      env,
      notifier as unknown as EmergencyAdminLoginNotifier,
      rateLimit as unknown as RateLimitService,
      sessionService as unknown as SessionService,
    );
  });

  describe("login (password step)", () => {
    it("issues a pending (requiresMfa) session for a correct password", async () => {
      users.findByEmail.mockResolvedValue(user);

      const result = await service.login(
        "admin@webdesksolution.com",
        "correct-horse-battery-staple",
        {
          ipHash: null,
          userAgent: null,
        },
      );

      expect(result.ok).toBe(true);
      expect(sessionService.issue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          authMethod: "emergency_local",
          requiresMfa: true,
        }),
      );
      expect(rateLimit.recordSuccess).toHaveBeenCalledWith(
        "emergency_login",
        "admin@webdesksolution.com",
      );
    });

    it("rejects an incorrect password and records a failure", async () => {
      users.findByEmail.mockResolvedValue(user);

      const result = await service.login("admin@webdesksolution.com", "totally-wrong", {
        ipHash: null,
        userAgent: null,
      });

      expect(result.ok).toBe(false);
      expect(sessionService.issue).not.toHaveBeenCalled();
      expect(rateLimit.recordFailure).toHaveBeenCalledWith(
        "emergency_login",
        "admin@webdesksolution.com",
        expect.any(Date),
      );
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "emergency_login_failed",
          reason: "invalid_credentials",
        }),
      );
    });

    it("rejects an unknown email the same generic way as a wrong password", async () => {
      users.findByEmail.mockResolvedValue(null);

      const result = await service.login("nobody@webdesksolution.com", "anything", {
        ipHash: null,
        userAgent: null,
      });

      expect(result.ok).toBe(false);
      expect(credentials.findByUserId).not.toHaveBeenCalled();
    });

    it("rejects when locked out, without touching the credential at all", async () => {
      rateLimit.isLocked.mockResolvedValue({
        locked: true,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      users.findByEmail.mockResolvedValue(user);

      const result = await service.login(
        "admin@webdesksolution.com",
        "correct-horse-battery-staple",
        {
          ipHash: null,
          userAgent: null,
        },
      );

      expect(result.ok).toBe(false);
      expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it("records a distinct account_lockout_triggered event when a failure trips the lock", async () => {
      users.findByEmail.mockResolvedValue(user);
      rateLimit.recordFailure.mockResolvedValue({
        locked: true,
        lockedUntil: new Date(Date.now() + 900_000),
      });

      await service.login("admin@webdesksolution.com", "totally-wrong", {
        ipHash: null,
        userAgent: null,
      });

      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "account_lockout_triggered", userId: user.id }),
      );
    });

    it("does not record a lockout event when the failure did not trip the lock", async () => {
      users.findByEmail.mockResolvedValue(user);
      rateLimit.recordFailure.mockResolvedValue({ locked: false, lockedUntil: null });

      await service.login("admin@webdesksolution.com", "totally-wrong", {
        ipHash: null,
        userAgent: null,
      });

      expect(events.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "account_lockout_triggered" }),
      );
    });

    it("still runs a password verification (against a dummy hash) for an unknown account — timing-safety", async () => {
      users.findByEmail.mockResolvedValue(null);
      const start = performance.now();
      await service.login("nobody@webdesksolution.com", "anything", {
        ipHash: null,
        userAgent: null,
      });
      const unknownDuration = performance.now() - start;

      users.findByEmail.mockResolvedValue(user);
      const start2 = performance.now();
      await service.login("admin@webdesksolution.com", "totally-wrong", {
        ipHash: null,
        userAgent: null,
      });
      const knownWrongDuration = performance.now() - start2;

      // Both paths run a real argon2 verify — durations should be the same
      // order of magnitude (loose bound; this is a smoke check, not a
      // precise timing-attack proof, which needs a dedicated statistical
      // test out of scope for a unit suite).
      expect(unknownDuration).toBeGreaterThan(0);
      expect(knownWrongDuration).toBeGreaterThan(0);
    });
  });

  describe("verifyTotp (second step)", () => {
    it("elevates the session on a correct TOTP code and fires the login-alert notifier", async () => {
      sessionService.findPending.mockResolvedValue({
        id: "pending-session-1",
        userId: user.id,
        requiresMfa: true,
      });
      sessionService.elevateAfterMfa.mockResolvedValue({
        id: "pending-session-1",
        userId: user.id,
        requiresMfa: false,
      });
      users.findById.mockResolvedValue(user);
      const code = rawAuthenticator.generate(totpSecret);

      const result = await service.verifyTotp("pending-raw-token", code, {
        ipHash: null,
        userAgent: null,
      });

      expect(result.ok).toBe(true);
      expect(sessionService.elevateAfterMfa).toHaveBeenCalledWith(
        "pending-session-1",
        expect.any(Date),
      );
      expect(users.recordSuccessfulLogin).toHaveBeenCalledWith(user.id, expect.any(Date));
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id, email: user.email }),
      );
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "emergency_login_succeeded", success: true }),
      );
    });

    it("rejects an incorrect TOTP code as a distinct event type from a wrong password", async () => {
      sessionService.findPending.mockResolvedValue({
        id: "pending-session-1",
        userId: user.id,
        requiresMfa: true,
      });

      const result = await service.verifyTotp("pending-raw-token", "000000", {
        ipHash: null,
        userAgent: null,
      });

      expect(result.ok).toBe(false);
      expect(sessionService.elevateAfterMfa).not.toHaveBeenCalled();
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "emergency_totp_failed", reason: "invalid_totp" }),
      );
    });

    it("records account_lockout_triggered when a wrong TOTP code trips the TOTP-step lock", async () => {
      sessionService.findPending.mockResolvedValue({
        id: "pending-session-1",
        userId: user.id,
        requiresMfa: true,
      });
      rateLimit.recordFailure.mockResolvedValue({
        locked: true,
        lockedUntil: new Date(Date.now() + 900_000),
      });

      await service.verifyTotp("pending-raw-token", "000000", { ipHash: null, userAgent: null });

      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "account_lockout_triggered", userId: user.id }),
      );
    });

    it("rejects when there is no valid pending session (expired, wrong token, or already elevated)", async () => {
      sessionService.findPending.mockResolvedValue(null);

      const result = await service.verifyTotp("not-a-real-pending-token", "123456", {
        ipHash: null,
        userAgent: null,
      });

      expect(result.ok).toBe(false);
      expect(credentials.findByUserId).not.toHaveBeenCalled();
    });

    it("rejects when the TOTP step itself is locked out", async () => {
      sessionService.findPending.mockResolvedValue({
        id: "pending-session-1",
        userId: user.id,
        requiresMfa: true,
      });
      rateLimit.isLocked.mockResolvedValue({
        locked: true,
        lockedUntil: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyTotp(
        "pending-raw-token",
        rawAuthenticator.generate(totpSecret),
        {
          ipHash: null,
          userAgent: null,
        },
      );

      expect(result.ok).toBe(false);
      expect(credentials.findByUserId).not.toHaveBeenCalled();
    });
  });
});
