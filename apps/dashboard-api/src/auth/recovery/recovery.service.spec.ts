import type { AuthEventRepository, RecoveryRequestRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeparationOfDutiesService } from "../common/separation-of-duties.service.js";
import type { AuditService } from "../../audit/audit.service.js";
import { RecoveryService } from "./recovery.service.js";

describe("RecoveryService", () => {
  let requests: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    decide: ReturnType<typeof vi.fn>;
  };
  let events: { record: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: RecoveryService;

  beforeEach(() => {
    requests = { create: vi.fn(), findById: vi.fn(), decide: vi.fn() };
    events = { record: vi.fn() };
    auditService = { record: vi.fn() };
    service = new RecoveryService(
      requests as unknown as RecoveryRequestRepository,
      events as unknown as AuthEventRepository,
      // Same `auditService` mock passed to both constructors — SeparationOfDutiesService now
      // records its own security_exception audit event on denial.
      new SeparationOfDutiesService(
        { findActorsForResource: vi.fn(), record: vi.fn() } as never,
        auditService as unknown as AuditService,
      ),
      auditService as unknown as AuditService,
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
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "account_recovery_request",
        entityType: "recovery_request",
        entityId: "r1",
        actorType: "system",
      }),
    );
  });

  it("rejects a self-approval attempt — separation of duties — and records a security_exception audit event", async () => {
    requests.findById.mockResolvedValue({ id: "r1", status: "pending", targetUserId: "u1" });

    await expect(
      service.decide({ requestId: "r1", decidedByUserId: "u1", approve: true }),
    ).rejects.toThrow(/Separation of duties/);

    expect(requests.decide).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "security_exception",
        actorUserId: "u1",
        entityId: "r1",
        action: "separation_of_duties_denied",
      }),
    );
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
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "account_recovery_decision",
        actorUserId: "u2",
        entityId: "r1",
        action: "approve",
        retentionCategory: "approval-audit-7y",
      }),
    );
  });

  it("records a distinct event type for a rejection", async () => {
    requests.findById.mockResolvedValue({ id: "r1", status: "pending", targetUserId: "u1" });
    requests.decide.mockResolvedValue({ id: "r1", status: "rejected" });

    await service.decide({ requestId: "r1", decidedByUserId: "u2", approve: false });

    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recovery_request_denied" }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "account_recovery_decision",
        action: "reject",
      }),
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
