import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionExchangeCodeRepository, UserRepository } from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises `SessionExchangeCodeRepository` against a REAL, disposable PostgreSQL database — the
 * fix for the cross-domain session-cookie bug documented in
 * `docs/implementation/session-exchange.md`. Never mocked; requires `DATABASE_URL` to point at a
 * throwaway database (see `packages/database/README.md`).
 */
describe("SessionExchangeCodeRepository (real disposable database)", () => {
  const users = new UserRepository();
  const exchangeCodes = new SessionExchangeCodeRepository();

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  it("creates a code and redeems it exactly once", async () => {
    const user = await users.create({
      email: "exchange-redeem@webdesksolution.com",
      displayName: "Exchange Redeem",
    });
    const now = new Date();
    const created = await exchangeCodes.create({
      userId: user.id,
      authMethod: "google_sso",
      codeHash: "a".repeat(64),
      expiresAt: new Date(now.getTime() + 60_000),
    });
    expect(created.redeemedAt).toBeNull();

    const redeemed = await exchangeCodes.redeem("a".repeat(64), new Date(now.getTime() + 1000));
    expect(redeemed?.id).toBe(created.id);
    expect(redeemed?.redeemedAt).not.toBeNull();
  });

  it("refuses to redeem the same code a second time", async () => {
    const user = await users.create({
      email: "exchange-double-redeem@webdesksolution.com",
      displayName: "Exchange Double Redeem",
    });
    const now = new Date();
    await exchangeCodes.create({
      userId: user.id,
      authMethod: "google_sso",
      codeHash: "b".repeat(64),
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const first = await exchangeCodes.redeem("b".repeat(64), now);
    expect(first).not.toBeNull();

    const second = await exchangeCodes.redeem("b".repeat(64), now);
    expect(second).toBeNull();
  });

  it("refuses to redeem an expired code", async () => {
    const user = await users.create({
      email: "exchange-expired@webdesksolution.com",
      displayName: "Exchange Expired",
    });
    const now = new Date();
    await exchangeCodes.create({
      userId: user.id,
      authMethod: "google_sso",
      codeHash: "c".repeat(64),
      expiresAt: new Date(now.getTime() - 1000),
    });

    const result = await exchangeCodes.redeem("c".repeat(64), now);
    expect(result).toBeNull();
  });

  it("returns null for a code that was never created", async () => {
    const result = await exchangeCodes.redeem("d".repeat(64), new Date());
    expect(result).toBeNull();
  });

  it("stores and round-trips ipHash/userAgent captured at issue time", async () => {
    const user = await users.create({
      email: "exchange-forensics@webdesksolution.com",
      displayName: "Exchange Forensics",
    });
    const now = new Date();
    const created = await exchangeCodes.create({
      userId: user.id,
      authMethod: "google_sso",
      codeHash: "e".repeat(64),
      expiresAt: new Date(now.getTime() + 60_000),
      ipHash: "real-browser-ip-hash",
      userAgent: "real-browser-user-agent",
    });
    expect(created.ipHash).toBe("real-browser-ip-hash");
    expect(created.userAgent).toBe("real-browser-user-agent");

    const redeemed = await exchangeCodes.redeem("e".repeat(64), now);
    expect(redeemed?.ipHash).toBe("real-browser-ip-hash");
    expect(redeemed?.userAgent).toBe("real-browser-user-agent");
  });

  it("defaults ipHash/userAgent to null when not provided", async () => {
    const user = await users.create({
      email: "exchange-no-forensics@webdesksolution.com",
      displayName: "Exchange No Forensics",
    });
    const now = new Date();
    const created = await exchangeCodes.create({
      userId: user.id,
      authMethod: "google_sso",
      codeHash: "f".repeat(64),
      expiresAt: new Date(now.getTime() + 60_000),
    });
    expect(created.ipHash).toBeNull();
    expect(created.userAgent).toBeNull();
  });
});
