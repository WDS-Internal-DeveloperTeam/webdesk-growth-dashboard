import { beforeEach, describe, expect, it, vi } from "vitest";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import, see google-auth.service.ts's own note.
import { AuditService } from "../audit/audit.service.js";
import { DECISION_AND_ACTIVITY_LOG_EVENT_TYPES } from "./decision-and-activity-log.constants.js";
import { DecisionAndActivityLogService } from "./decision-and-activity-log.service.js";

describe("DecisionAndActivityLogService", () => {
  let audit: { list: ReturnType<typeof vi.fn> };
  let service: DecisionAndActivityLogService;

  beforeEach(() => {
    audit = { list: vi.fn().mockResolvedValue([]) };
    service = new DecisionAndActivityLogService(audit as unknown as AuditService);
  });

  it("defaults to the module's own event-type allowlist when the caller supplies none", async () => {
    await service.list({});
    expect(audit.list).toHaveBeenCalledWith(
      expect.objectContaining({ eventTypes: DECISION_AND_ACTIVITY_LOG_EVENT_TYPES }),
    );
  });

  it("passes through an explicit eventType filter instead of the default allowlist", async () => {
    await service.list({ eventType: ["rollback"] });
    expect(audit.list).toHaveBeenCalledWith(expect.objectContaining({ eventTypes: ["rollback"] }));
  });

  it("passes through every other filter field unchanged", async () => {
    await service.list({
      projectId: "project-1",
      actorUserId: "user-1",
      entityType: "project",
      entityId: "entity-1",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z",
      limit: 10,
      offset: 5,
    });
    expect(audit.list).toHaveBeenCalledWith({
      eventTypes: DECISION_AND_ACTIVITY_LOG_EVENT_TYPES,
      projectId: "project-1",
      actorUserId: "user-1",
      entityType: "project",
      entityId: "entity-1",
      createdAfter: "2026-01-01T00:00:00.000Z",
      createdBefore: "2026-01-02T00:00:00.000Z",
      limit: 10,
      offset: 5,
    });
  });

  it("returns whatever the audit service returns", async () => {
    const fakeEvents = [{ id: "event-1" }];
    audit.list.mockResolvedValue(fakeEvents);
    const result = await service.list({});
    expect(result).toBe(fakeEvents);
  });
});
