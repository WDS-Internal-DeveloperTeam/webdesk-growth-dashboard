import type { SystemEventEntity, SystemEventRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SystemActivityService } from "./system-activity.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function event(overrides: Partial<SystemEventEntity> = {}): SystemEventEntity {
  return {
    id: "event-1",
    eventType: "job_status_changed",
    category: "jobs",
    severity: null,
    sourceApplication: "dashboard-api",
    relatedEntityType: "job",
    relatedEntityId: "job-1",
    correlationId: null,
    message: "Job transitioned to running",
    metadata: null,
    relatedAuditEventId: null,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("SystemActivityService", () => {
  let events: {
    record: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let service: SystemActivityService;

  beforeEach(() => {
    events = { record: vi.fn(), findById: vi.fn(), list: vi.fn() };
    service = new SystemActivityService(events as unknown as SystemEventRepository);
  });

  it("records an activity event without implying any audit event", async () => {
    events.record.mockResolvedValue(event());
    const result = await service.record({
      eventType: "job_status_changed",
      message: "Job transitioned to running",
    });
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "job_status_changed" }),
    );
    expect(result.relatedAuditEventId).toBeNull();
  });

  it("records an activity event linked to a real audit event when the caller supplies one", async () => {
    events.record.mockResolvedValue(event({ relatedAuditEventId: "audit-1" }));
    const result = await service.record({
      eventType: "release_verification_failed",
      message: "Release verification failed",
      relatedAuditEventId: "audit-1",
    });
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ relatedAuditEventId: "audit-1" }),
    );
    expect(result.relatedAuditEventId).toBe("audit-1");
  });

  it("lists activity via the repository", async () => {
    events.list.mockResolvedValue([event()]);
    const result = await service.list({ eventType: "job_status_changed" });
    expect(result).toHaveLength(1);
  });
});
