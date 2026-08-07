import type { AuthEventRepository, RecoveryRequestRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeparationOfDutiesService } from "../common/separation-of-duties.service.js";
import { RecoveryService } from "./recovery.service.js";

describe("RecoveryService", () => {
  let requests: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    decide: ReturnType<typeof vi.fn>;
  };
  let events: { record: ReturnType<typeof vi.fn> };
  let service: RecoveryService;

  beforeEach(() => {
    requests = { create: vi.fn(), findById: vi.fn(), decide: vi.fn() };
    events = { record: vi.fn() };
    service = new RecoveryService(
      requests as unknown as RecoveryRequestRepository,
      events as unknown as AuthEventRepository,
      new SeparationOfDutiesService(),
    );
  });

  it("creates a request and records an event", async () => {
    requests.create.mockResolvedValue({ id: "r1", status: "pending" });

    await service.createRequest({
      targetUserId: "u1",
      requestedByUserId: null,
      reason: "locked out",
    });

    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recovery_request_created", userId: "u1" }),
    );
  });

  it("rejects a self-approval attempt — separation of duties", async () => {
    requests.findById.mockResolvedValue({ id: "r1", status: "pending", targetUserId: "u1" });

    await expect(
      service.decide({ requestId: "r1", decidedByUserId: "u1", approve: true }),
    ).rejects.toThrow(/Separation of duties/);

    expect(requests.decide).not.toHaveBeenCalled();
  });

  it("approves when decided by a second, distinct administrator", async () => {
    requests.findById.mockResolvedValue({ id: "r1", status: "pending", targetUserId: "u1" });
    requests.decide.mockResolvedValue({ id: "r1", status: "approved" });

    const result = await service.decide({ requestId: "r1", decidedByUserId: "u2", approve: true });

    expect(result.status).toBe("approved");
    expect(requests.decide).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ status: "approved", decidedByUserId: "u2" }),
    );
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recovery_request_approved" }),
    );
  });

  it("records a distinct event type for a rejection", async () => {
    requests.findById.mockResolvedValue({ id: "r1", status: "pending", targetUserId: "u1" });
    requests.decide.mockResolvedValue({ id: "r1", status: "rejected" });

    await service.decide({ requestId: "r1", decidedByUserId: "u2", approve: false });

    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recovery_request_denied" }),
    );
  });

  it("refuses to decide an already-decided request", async () => {
    requests.findById.mockResolvedValue({ id: "r1", status: "approved", targetUserId: "u1" });

    await expect(
      service.decide({ requestId: "r1", decidedByUserId: "u2", approve: true }),
    ).rejects.toThrow(/already decided/);
  });

  it("throws for an unknown request id", async () => {
    requests.findById.mockResolvedValue(null);

    await expect(
      service.decide({ requestId: "missing", decidedByUserId: "u2", approve: true }),
    ).rejects.toThrow(/not found/);
  });
});
