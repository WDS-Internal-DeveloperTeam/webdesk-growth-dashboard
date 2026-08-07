import type { AuthEventRepository, SessionRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import { hashSessionToken } from "../crypto/session-token.js";
import { SessionService } from "./session.service.js";

const env = {
  SESSION_MAX_AGE_SECONDS: 7 * 24 * 3600,
  SESSION_PENDING_MFA_MAX_AGE_SECONDS: 300,
} as AuthEnv;

describe("SessionService", () => {
  let repo: {
    create: ReturnType<typeof vi.fn>;
    findByTokenHash: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    elevateAfterMfa: ReturnType<typeof vi.fn>;
    touchActivity: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    revokeAllForUser: ReturnType<typeof vi.fn>;
  };
  let events: { record: ReturnType<typeof vi.fn> };
  let service: SessionService;

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      findByTokenHash: vi.fn(),
      findById: vi.fn(),
      elevateAfterMfa: vi.fn(),
      touchActivity: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
    };
    events = { record: vi.fn() };
    service = new SessionService(
      repo as unknown as SessionRepository,
      events as unknown as AuthEventRepository,
      env,
    );
  });

  it("issues a full-window session for google_sso (requiresMfa: false)", async () => {
    repo.create.mockResolvedValue({ id: "s1", expiresAt: new Date().toISOString() });

    const { session, rawToken } = await service.issue({
      userId: "u1",
      authMethod: "google_sso",
      requiresMfa: false,
    });

    expect(session.id).toBe("s1");
    expect(rawToken.length).toBeGreaterThan(0);
    const createCall = repo.create.mock.calls[0]?.[0];
    expect(createCall.requiresMfa).toBe(false);
    expect(createCall.tokenHash).toBe(hashSessionToken(rawToken));
  });

  it("issues a short pending-window session when requiresMfa is true", async () => {
    repo.create.mockResolvedValue({ id: "s1" });
    const now = new Date("2026-01-01T00:00:00.000Z");

    await service.issue({ userId: "u1", authMethod: "emergency_local", requiresMfa: true, now });

    const createCall = repo.create.mock.calls[0]?.[0];
    const expectedExpiry = new Date(now.getTime() + env.SESSION_PENDING_MFA_MAX_AGE_SECONDS * 1000);
    expect(createCall.expiresAt).toEqual(expectedExpiry);
  });

  it("validate() returns null for an unknown token", async () => {
    repo.findByTokenHash.mockResolvedValue(null);
    expect(await service.validate("nonexistent")).toBeNull();
  });

  it("validate() returns null for a revoked session", async () => {
    repo.findByTokenHash.mockResolvedValue({
      revokedAt: new Date().toISOString(),
      requiresMfa: false,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(await service.validate("token")).toBeNull();
  });

  it("validate() returns null for an expired session", async () => {
    repo.findByTokenHash.mockResolvedValue({
      revokedAt: null,
      requiresMfa: false,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(await service.validate("token")).toBeNull();
  });

  it("validate() returns null for a still-pending-MFA session — not a valid API credential yet", async () => {
    repo.findByTokenHash.mockResolvedValue({
      revokedAt: null,
      requiresMfa: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(await service.validate("token")).toBeNull();
  });

  it("validate() touches last-activity and returns the session when valid", async () => {
    const session = {
      id: "s1",
      revokedAt: null,
      requiresMfa: false,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    repo.findByTokenHash.mockResolvedValue(session);

    const result = await service.validate("token");

    expect(result).toBe(session);
    expect(repo.touchActivity).toHaveBeenCalledWith("s1", expect.any(Date));
  });

  it("findPending() only returns sessions that are actually pending MFA", async () => {
    repo.findByTokenHash.mockResolvedValue({
      revokedAt: null,
      requiresMfa: false,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(await service.findPending("token")).toBeNull();
  });

  it("elevateAfterMfa() extends expiry to the full session window and re-fetches the row", async () => {
    repo.findById.mockResolvedValue({ id: "s1", requiresMfa: false });
    const now = new Date("2026-01-01T00:00:00.000Z");

    const updated = await service.elevateAfterMfa("s1", now);

    const expectedExpiry = new Date(now.getTime() + env.SESSION_MAX_AGE_SECONDS * 1000);
    expect(repo.elevateAfterMfa).toHaveBeenCalledWith("s1", expectedExpiry, now);
    expect(updated.id).toBe("s1");
  });

  it("elevateAfterMfa() throws if the session vanished between update and re-fetch", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.elevateAfterMfa("gone")).rejects.toThrow(/not found/);
  });

  it("revoke() delegates with a reason and records a session_revoked audit event", async () => {
    repo.findById.mockResolvedValue({ id: "s1", userId: "u1", authMethod: "google_sso" });
    const now = new Date();

    await service.revoke("s1", "user-initiated", now);

    expect(repo.revoke).toHaveBeenCalledWith("s1", "user-initiated", now);
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "session_revoked",
        userId: "u1",
        sessionId: "s1",
        reason: "user-initiated",
      }),
    );
  });

  it("revokeAllForUser() delegates, returns the count, and records one event for the batch", async () => {
    repo.revokeAllForUser.mockResolvedValue(3);

    const count = await service.revokeAllForUser("u1", "role-change");

    expect(count).toBe(3);
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "session_revoked", userId: "u1" }),
    );
  });

  it("revokeAllForUser() records no event when nothing was revoked", async () => {
    repo.revokeAllForUser.mockResolvedValue(0);
    await service.revokeAllForUser("u1", "role-change");
    expect(events.record).not.toHaveBeenCalled();
  });
});
