import type { AuthLockoutStateRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import { RateLimitService } from "./rate-limit.service.js";

const env = {
  AUTH_LOCKOUT_MAX_ATTEMPTS: 3,
  AUTH_LOCKOUT_WINDOW_SECONDS: 900,
  AUTH_LOCKOUT_DURATION_SECONDS: 900,
} as AuthEnv;

describe("RateLimitService", () => {
  let repo: {
    get: ReturnType<typeof vi.fn>;
    recordFailure: ReturnType<typeof vi.fn>;
    lock: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
  let service: RateLimitService;

  beforeEach(() => {
    repo = { get: vi.fn(), recordFailure: vi.fn(), lock: vi.fn(), reset: vi.fn() };
    service = new RateLimitService(repo as unknown as AuthLockoutStateRepository, env);
  });

  it("reports not locked when no row exists", async () => {
    repo.get.mockResolvedValue(null);
    const result = await service.isLocked("emergency_login", "a@b.com");
    expect(result.locked).toBe(false);
  });

  it("reports locked while lockedUntil is in the future", async () => {
    const future = new Date(Date.now() + 60_000);
    repo.get.mockResolvedValue({ lockedUntil: future.toISOString() });
    const result = await service.isLocked("emergency_login", "a@b.com");
    expect(result.locked).toBe(true);
    expect(result.lockedUntil).toEqual(future);
  });

  it("reports not locked once lockedUntil is in the past", async () => {
    const past = new Date(Date.now() - 60_000);
    repo.get.mockResolvedValue({ lockedUntil: past.toISOString() });
    const result = await service.isLocked("emergency_login", "a@b.com");
    expect(result.locked).toBe(false);
  });

  it("trips a lockout once failedCount reaches the configured maximum", async () => {
    repo.get.mockResolvedValue(null);
    repo.recordFailure.mockResolvedValue({
      failedCount: 3,
      firstFailedAt: new Date().toISOString(),
    });

    const result = await service.recordFailure("emergency_login", "a@b.com");

    expect(result.locked).toBe(true);
    expect(repo.lock).toHaveBeenCalledWith("emergency_login", "a@b.com", expect.any(Date));
  });

  it("does not lock while under the maximum", async () => {
    repo.get.mockResolvedValue(null);
    repo.recordFailure.mockResolvedValue({
      failedCount: 2,
      firstFailedAt: new Date().toISOString(),
    });

    const result = await service.recordFailure("emergency_login", "a@b.com");

    expect(result.locked).toBe(false);
    expect(repo.lock).not.toHaveBeenCalled();
  });

  it("resets a stale window before recording a new failure", async () => {
    const staleFirstFailure = new Date(Date.now() - env.AUTH_LOCKOUT_WINDOW_SECONDS * 1000 - 1000);
    repo.get.mockResolvedValue({ failedCount: 5, firstFailedAt: staleFirstFailure.toISOString() });
    repo.recordFailure.mockResolvedValue({
      failedCount: 1,
      firstFailedAt: new Date().toISOString(),
    });

    const result = await service.recordFailure("emergency_login", "a@b.com");

    expect(repo.reset).toHaveBeenCalledWith("emergency_login", "a@b.com");
    expect(result.locked).toBe(false);
  });

  it("does not reset a still-fresh window", async () => {
    const recentFirstFailure = new Date(Date.now() - 10_000);
    repo.get.mockResolvedValue({ failedCount: 1, firstFailedAt: recentFirstFailure.toISOString() });
    repo.recordFailure.mockResolvedValue({
      failedCount: 2,
      firstFailedAt: recentFirstFailure.toISOString(),
    });

    await service.recordFailure("emergency_login", "a@b.com");

    expect(repo.reset).not.toHaveBeenCalled();
  });

  it("clears state on recordSuccess", async () => {
    await service.recordSuccess("emergency_login", "a@b.com");
    expect(repo.reset).toHaveBeenCalledWith("emergency_login", "a@b.com");
  });
});
