import type { IdempotencyKeyRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyService } from "./idempotency.service.js";

describe("IdempotencyService", () => {
  let keys: {
    reserve: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
  };
  let service: IdempotencyService;

  beforeEach(() => {
    keys = { reserve: vi.fn(), complete: vi.fn(), fail: vi.fn() };
    service = new IdempotencyService(keys as unknown as IdempotencyKeyRepository);
  });

  it("maps a fresh reservation to outcome proceed", async () => {
    keys.reserve.mockResolvedValue({ kind: "reserved", entity: { id: "r-1" } });
    const result = await service.reserve({ scope: "job:x", idempotencyKey: "k" });
    expect(result.outcome).toBe("proceed");
  });

  it("maps a completed prior reservation to outcome duplicate", async () => {
    keys.reserve.mockResolvedValue({
      kind: "duplicate",
      entity: { id: "r-1", resultReference: "job-1" },
    });
    const result = await service.reserve({ scope: "job:x", idempotencyKey: "k" });
    expect(result.outcome).toBe("duplicate");
    expect(result.reservation.resultReference).toBe("job-1");
  });

  it("maps a still-pending prior reservation to outcome conflict", async () => {
    keys.reserve.mockResolvedValue({ kind: "in_progress", entity: { id: "r-1" } });
    const result = await service.reserve({ scope: "job:x", idempotencyKey: "k" });
    expect(result.outcome).toBe("conflict");
  });

  it("delegates complete/fail to the repository", async () => {
    await service.complete("r-1", "job-1");
    expect(keys.complete).toHaveBeenCalledWith("r-1", "job-1");

    await service.fail("r-1");
    expect(keys.fail).toHaveBeenCalledWith("r-1");
  });
});
