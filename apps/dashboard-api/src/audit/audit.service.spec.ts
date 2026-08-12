import type { AuditEventRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditService } from "./audit.service.js";

describe("AuditService", () => {
  let events: { record: ReturnType<typeof vi.fn> };
  let service: AuditService;

  beforeEach(() => {
    events = { record: vi.fn().mockResolvedValue({ id: "event-1" }) };
    service = new AuditService(events as unknown as AuditEventRepository);
  });

  it("delegates a valid event straight to the repository", async () => {
    await service.record({
      eventType: "permission_change",
      actorUserId: "actor-1",
      actorType: "human",
      entityType: "user",
      entityId: "user-1",
      action: "role_assigned",
      retentionCategory: "approval-audit-7y",
    });

    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "permission_change",
        actorUserId: "actor-1",
        actorType: "human",
        entityType: "user",
        entityId: "user-1",
        action: "role_assigned",
        retentionCategory: "approval-audit-7y",
        legalHold: false,
      }),
    );
  });

  it("rejects an unrecognized event_type before touching the repository", async () => {
    await expect(
      service.record({
        // @ts-expect-error -- deliberately invalid for this test
        eventType: "not_a_real_event_type",
        actorType: "human",
        entityType: "user",
        entityId: "user-1",
        action: "whatever",
        retentionCategory: "audit-7y",
      }),
    ).rejects.toThrow(/Unrecognized audit event_type/);
    expect(events.record).not.toHaveBeenCalled();
  });

  it("rejects an unrecognized retention_category before touching the repository", async () => {
    await expect(
      service.record({
        eventType: "data_change",
        actorType: "system",
        entityType: "user",
        entityId: "user-1",
        action: "whatever",
        // @ts-expect-error -- deliberately invalid for this test
        retentionCategory: "not-a-real-category",
      }),
    ).rejects.toThrow(/Unrecognized audit retention_category/);
    expect(events.record).not.toHaveBeenCalled();
  });

  it("defaults legalHold to false and passes through an explicit legal hold", async () => {
    await service.record({
      eventType: "security_exception",
      actorType: "system",
      entityType: "user",
      entityId: "user-1",
      action: "investigation",
      retentionCategory: "security-log-1y",
      legalHold: true,
      legalHoldReason: "active investigation",
    });

    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ legalHold: true, legalHoldReason: "active investigation" }),
    );
  });
});
