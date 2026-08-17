import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuthEventRepository,
  AuthLockoutStateRepository,
  EmergencyAdminCredentialRepository,
  ExternalAuthIdentityRepository,
  RecoveryRequestRepository,
  SessionRepository,
  UserRepository,
} from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises every Phase 1C repository against a REAL, disposable PostgreSQL
 * database (docs/contracts/database-contract.md "Test requirements",
 * docs/task-packages/phase-1c-authentication-sessions.md §6) — never
 * mocked. Requires DATABASE_URL to point at a throwaway database (see
 * packages/database/README.md).
 */
describe("Phase 1C auth repositories (real disposable database)", () => {
  const users = new UserRepository();
  const identities = new ExternalAuthIdentityRepository();
  const credentials = new EmergencyAdminCredentialRepository();
  const sessions = new SessionRepository();
  const lockout = new AuthLockoutStateRepository();
  const recovery = new RecoveryRequestRepository();
  const events = new AuthEventRepository();

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("UserRepository", () => {
    it("creates a pre-provisioned user and finds it by email", async () => {
      const created = await users.create({
        email: "sso-user@webdesksolution.com",
        displayName: "SSO User",
      });
      expect(created.accountStatus).toBe("active");
      expect(created.lastLoginAt).toBeNull();

      const found = await users.findByEmail("sso-user@webdesksolution.com");
      expect(found?.id).toBe(created.id);
    });

    it("returns null for an email with no pre-provisioned user", async () => {
      const found = await users.findByEmail("nobody@webdesksolution.com");
      expect(found).toBeNull();
    });

    it("records a successful login timestamp", async () => {
      const created = await users.create({
        email: "login-record@webdesksolution.com",
        displayName: "Login Record",
      });
      const loginAt = new Date();
      await users.recordSuccessfulLogin(created.id, loginAt);

      const found = await users.findById(created.id);
      expect(found?.lastLoginAt).toBe(loginAt.toISOString());
    });

    describe("search() — the read-only lookup capability for picker UIs", () => {
      it("matches by a substring of either displayName or email, case-insensitively", async () => {
        await users.create({ email: "jane.doe@webdesksolution.com", displayName: "Jane Doe" });
        await users.create({
          email: "someone-else@webdesksolution.com",
          displayName: "Someone Else",
        });

        const byName = await users.search({ search: "jane" });
        expect(byName.map((u) => u.email)).toEqual(["jane.doe@webdesksolution.com"]);

        const byEmail = await users.search({ search: "JANE.DOE" });
        expect(byEmail.map((u) => u.email)).toEqual(["jane.doe@webdesksolution.com"]);

        const noMatch = await users.search({ search: "nonexistent-zzz" });
        expect(noMatch).toEqual([]);
      });

      it("excludes disabled accounts even when they match the search term", async () => {
        const disabled = await users.create({
          email: "disabled-search-user@webdesksolution.com",
          displayName: "Disabled Search User",
          accountStatus: "disabled",
        });

        const results = await users.search({ search: "Disabled Search User" });
        expect(results.some((u) => u.id === disabled.id)).toBe(false);
      });

      it("with no search term, returns active users ordered by displayName", async () => {
        await users.create({ email: "aaa-first@webdesksolution.com", displayName: "AAA First" });
        const results = await users.search({ limit: 200 });
        expect(results[0]?.displayName).toBe("AAA First");
        expect(results.every((u) => u.accountStatus === "active")).toBe(true);
      });

      it("respects the limit/offset bounds", async () => {
        for (let index = 0; index < 5; index += 1) {
          await users.create({
            email: `paged-user-${index}@webdesksolution.com`,
            displayName: `Paged User ${index}`,
          });
        }
        const page = await users.search({ search: "Paged User", limit: 2, offset: 1 });
        expect(page).toHaveLength(2);
      });

      it("treats a literal underscore in the search term as a literal character, not a wildcard", async () => {
        await users.create({
          email: "john_doe@webdesksolution.com",
          displayName: "John Underscore",
        });
        await users.create({
          email: "johnxdoe@webdesksolution.com",
          displayName: "John Wildcard Collision",
        });

        const results = await users.search({ search: "john_doe" });
        expect(results.map((u) => u.email)).toEqual(["john_doe@webdesksolution.com"]);
      });
    });

    describe("findByIds() — batch resolve, avoiding N individual round trips", () => {
      it("resolves multiple active users in a single query", async () => {
        const a = await users.create({
          email: "batch-a@webdesksolution.com",
          displayName: "Batch A",
        });
        const b = await users.create({
          email: "batch-b@webdesksolution.com",
          displayName: "Batch B",
        });

        const results = await users.findByIds([a.id, b.id]);
        expect(results.map((u) => u.id).sort()).toEqual([a.id, b.id].sort());
      });

      it("silently drops a disabled or nonexistent id, same convention as findById()", async () => {
        const active = await users.create({
          email: "batch-active@webdesksolution.com",
          displayName: "Batch Active",
        });
        const disabled = await users.create({
          email: "batch-disabled@webdesksolution.com",
          displayName: "Batch Disabled",
          accountStatus: "disabled",
        });

        const results = await users.findByIds([
          active.id,
          disabled.id,
          "00000000-0000-0000-0000-000000000000",
        ]);
        expect(results.map((u) => u.id)).toEqual([active.id]);
      });

      it("returns an empty array for an empty input without querying", async () => {
        expect(await users.findByIds([])).toEqual([]);
      });
    });
  });

  describe("ExternalAuthIdentityRepository", () => {
    it("links a Google subject to a pre-provisioned user, and looks it up both ways", async () => {
      const user = await users.create({
        email: "google-link@webdesksolution.com",
        displayName: "Google Link",
      });
      await identities.link({
        userId: user.id,
        provider: "google",
        providerSubjectId: "google-sub-123",
        workspaceDomain: "webdesksolution.com",
      });

      const bySubject = await identities.findByProviderSubject("google", "google-sub-123");
      expect(bySubject?.userId).toBe(user.id);

      const byUser = await identities.findByUserId(user.id);
      expect(byUser?.providerSubjectId).toBe("google-sub-123");
    });

    it("enforces one (provider, subject) pair maps to at most one row", async () => {
      const userA = await users.create({ email: "dup-a@webdesksolution.com", displayName: "A" });
      const userB = await users.create({ email: "dup-b@webdesksolution.com", displayName: "B" });
      await identities.link({
        userId: userA.id,
        provider: "google",
        providerSubjectId: "dup-subject",
        workspaceDomain: "webdesksolution.com",
      });

      await expect(
        identities.link({
          userId: userB.id,
          provider: "google",
          providerSubjectId: "dup-subject",
          workspaceDomain: "webdesksolution.com",
        }),
      ).rejects.toThrow();
    });
  });

  describe("EmergencyAdminCredentialRepository", () => {
    it("creates a credential row and finds it by user id", async () => {
      const user = await users.create({
        email: "emergency-admin@webdesksolution.com",
        displayName: "Emergency Admin",
      });
      const created = await credentials.create({
        userId: user.id,
        passwordHash: "argon2id$fake-hash-for-test",
        totpSecretEncrypted: "iv:tag:ciphertext",
      });
      expect(created.status).toBe("active");

      const found = await credentials.findByUserId(user.id);
      expect(found?.passwordHash).toBe("argon2id$fake-hash-for-test");
    });

    it("disables a credential", async () => {
      const user = await users.create({
        email: "disable-admin@webdesksolution.com",
        displayName: "Disable Admin",
      });
      const created = await credentials.create({
        userId: user.id,
        passwordHash: "hash",
        totpSecretEncrypted: "enc",
      });
      await credentials.setStatus(created.id, "disabled");

      const found = await credentials.findByUserId(user.id);
      expect(found?.status).toBe("disabled");
    });
  });

  describe("SessionRepository", () => {
    it("creates a pending-MFA session, elevates it after TOTP success", async () => {
      const user = await users.create({
        email: "session-user@webdesksolution.com",
        displayName: "Session User",
      });
      const pendingExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const created = await sessions.create({
        userId: user.id,
        tokenHash: "a".repeat(64),
        authMethod: "emergency_local",
        requiresMfa: true,
        expiresAt: pendingExpiry,
      });
      expect(created.requiresMfa).toBe(true);
      expect(created.mfaVerifiedAt).toBeNull();

      const fullExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const mfaVerifiedAt = new Date();
      await sessions.elevateAfterMfa(created.id, fullExpiry, mfaVerifiedAt);

      const found = await sessions.findByTokenHash("a".repeat(64));
      expect(found?.requiresMfa).toBe(false);
      expect(found?.mfaVerifiedAt).toBe(mfaVerifiedAt.toISOString());
      expect(found?.expiresAt).toBe(fullExpiry.toISOString());
    });

    it("revokes a session with a reason", async () => {
      const user = await users.create({
        email: "revoke-user@webdesksolution.com",
        displayName: "Revoke User",
      });
      const created = await sessions.create({
        userId: user.id,
        tokenHash: "b".repeat(64),
        authMethod: "google_sso",
        requiresMfa: false,
        expiresAt: new Date(Date.now() + 3600_000),
      });
      const revokedAt = new Date();
      await sessions.revoke(created.id, "user-initiated", revokedAt);

      const found = await sessions.findById(created.id);
      expect(found?.revokedAt).toBe(revokedAt.toISOString());
      expect(found?.revokedReason).toBe("user-initiated");
    });

    it("revokes every active session for a user (role-change / admin-forced)", async () => {
      const user = await users.create({
        email: "revoke-all@webdesksolution.com",
        displayName: "Revoke All",
      });
      await sessions.create({
        userId: user.id,
        tokenHash: "c".repeat(64),
        authMethod: "google_sso",
        requiresMfa: false,
        expiresAt: new Date(Date.now() + 3600_000),
      });
      await sessions.create({
        userId: user.id,
        tokenHash: "d".repeat(64),
        authMethod: "google_sso",
        requiresMfa: false,
        expiresAt: new Date(Date.now() + 3600_000),
      });

      const count = await sessions.revokeAllForUser(user.id, "role-change", new Date());
      expect(count).toBe(2);
    });
  });

  describe("AuthLockoutStateRepository", () => {
    it("accumulates failures atomically for a scope+identifier pair", async () => {
      const scope = "emergency_login";
      const identifier = "lockout-test@webdesksolution.com";
      await lockout.recordFailure(scope, identifier, new Date());
      await lockout.recordFailure(scope, identifier, new Date());
      const third = await lockout.recordFailure(scope, identifier, new Date());

      expect(third.failedCount).toBe(3);
      expect(third.firstFailedAt).not.toBeNull();
    });

    it("locks and then resets", async () => {
      const scope = "emergency_totp";
      const identifier = "lockout-reset@webdesksolution.com";
      await lockout.recordFailure(scope, identifier, new Date());
      const until = new Date(Date.now() + 15 * 60 * 1000);
      await lockout.lock(scope, identifier, until);

      const locked = await lockout.get(scope, identifier);
      expect(locked?.lockedUntil).toBe(until.toISOString());

      await lockout.reset(scope, identifier);
      const cleared = await lockout.get(scope, identifier);
      expect(cleared).toBeNull();
    });
  });

  describe("RecoveryRequestRepository", () => {
    it("creates a request and records a second administrator's approval", async () => {
      const target = await users.create({
        email: "recovery-target@webdesksolution.com",
        displayName: "Recovery Target",
      });
      const approver = await users.create({
        email: "recovery-approver@webdesksolution.com",
        displayName: "Recovery Approver",
      });

      const created = await recovery.create({
        targetUserId: target.id,
        requestedByUserId: null,
        reason: "Locked out after too many failed TOTP attempts",
      });
      expect(created.status).toBe("pending");

      const decided = await recovery.decide(created.id, {
        status: "approved",
        decidedByUserId: approver.id,
        decidedAt: new Date(),
        note: "Verified identity over a call",
      });
      expect(decided.status).toBe("approved");
      expect(decided.decidedByUserId).toBe(approver.id);
    });
  });

  describe("AuthEventRepository", () => {
    it("records events and lists them most-recent-first", async () => {
      const user = await users.create({
        email: "event-user@webdesksolution.com",
        displayName: "Event User",
      });
      await events.record({ eventType: "sso_login_succeeded", userId: user.id, success: true });
      await events.record({
        eventType: "sso_login_rejected",
        userId: user.id,
        success: false,
        reason: "domain_not_allowed",
      });

      const recent = await events.findRecentByUserId(user.id);
      expect(recent).toHaveLength(2);
      expect(recent[0]?.eventType).toBe("sso_login_rejected");
      expect(recent[1]?.eventType).toBe("sso_login_succeeded");
    });

    it("exposes no update or delete method — append-only by construction", () => {
      expect((events as unknown as Record<string, unknown>)["update"]).toBeUndefined();
      expect((events as unknown as Record<string, unknown>)["delete"]).toBeUndefined();
    });
  });
});
