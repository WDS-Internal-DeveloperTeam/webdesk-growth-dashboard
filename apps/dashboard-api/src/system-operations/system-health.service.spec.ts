import type {
  SystemComponentEntity,
  SystemComponentRepository,
  SystemHealthCheckEntity,
  SystemHealthCheckRepository,
} from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { SystemHealthService } from "./system-health.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function component(overrides: Partial<SystemComponentEntity> = {}): SystemComponentEntity {
  return {
    id: "component-1",
    key: "database",
    displayName: "Database",
    description: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function check(overrides: Partial<SystemHealthCheckEntity> = {}): SystemHealthCheckEntity {
  return {
    id: "check-1",
    componentKey: "database",
    status: "healthy",
    detail: null,
    checkedByUserId: "actor-1",
    source: "manual",
    correlationId: null,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("SystemHealthService", () => {
  let components: { findByKey: ReturnType<typeof vi.fn>; listAll: ReturnType<typeof vi.fn> };
  let checks: {
    record: ReturnType<typeof vi.fn>;
    findMostRecentForComponent: ReturnType<typeof vi.fn>;
    findHistoryForComponent: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: SystemHealthService;

  beforeEach(() => {
    components = { findByKey: vi.fn(), listAll: vi.fn() };
    checks = {
      record: vi.fn(),
      findMostRecentForComponent: vi.fn(),
      findHistoryForComponent: vi.fn(),
    };
    auditService = { record: vi.fn() };
    service = new SystemHealthService(
      components as unknown as SystemComponentRepository,
      checks as unknown as SystemHealthCheckRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("recordCheck", () => {
    it("records a check for a known component and audits a human-recorded check", async () => {
      components.findByKey.mockResolvedValue(component());
      checks.record.mockResolvedValue(check());

      await service.recordCheck({
        componentKey: "database",
        status: "healthy",
        checkedByUserId: "actor-1",
        correlationId: "corr-1",
      });

      expect(checks.record).toHaveBeenCalledWith(
        expect.objectContaining({ componentKey: "database", status: "healthy" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "system_health_check_recorded",
          actorUserId: "actor-1",
          entityId: "database",
          correlationId: "corr-1",
        }),
      );
    });

    it("does not audit a check with no human actor (a future automated probe)", async () => {
      components.findByKey.mockResolvedValue(component());
      checks.record.mockResolvedValue(check({ checkedByUserId: null, source: "scheduled_probe" }));

      await service.recordCheck({ componentKey: "database", status: "healthy" });

      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("rejects recording a check for an unknown component", async () => {
      components.findByKey.mockResolvedValue(null);
      await expect(
        service.recordCheck({ componentKey: "not-a-real-component", status: "healthy" }),
      ).rejects.toThrow(/Unknown system component/);
      expect(checks.record).not.toHaveBeenCalled();
    });
  });

  describe("getCurrentStatus", () => {
    it("returns unknown — not healthy — for a known component with zero recorded checks", async () => {
      components.findByKey.mockResolvedValue(component({ key: "wordpress" }));
      checks.findMostRecentForComponent.mockResolvedValue(null);
      const result = await service.getCurrentStatus("wordpress");
      expect(result).toEqual({
        componentKey: "wordpress",
        status: "unknown",
        detail: null,
        checkedAt: null,
        source: null,
      });
    });

    it("returns the most recent recorded status", async () => {
      components.findByKey.mockResolvedValue(component({ key: "database" }));
      checks.findMostRecentForComponent.mockResolvedValue(check({ status: "degraded" }));
      const result = await service.getCurrentStatus("database");
      expect(result.status).toBe("degraded");
    });

    it("rejects an unknown component key with a 404, not a fabricated 'unknown' status — matching recordCheck's own validation", async () => {
      components.findByKey.mockResolvedValue(null);
      await expect(service.getCurrentStatus("not-a-real-component")).rejects.toThrow(
        /Unknown system component/,
      );
      expect(checks.findMostRecentForComponent).not.toHaveBeenCalled();
    });
  });

  describe("getAllCurrentStatuses", () => {
    it("resolves a status for every seeded component, including untested ones", async () => {
      components.listAll.mockResolvedValue([
        component({ key: "database" }),
        component({ key: "wordpress", displayName: "WordPress" }),
      ]);
      components.findByKey.mockImplementation((key: string) => Promise.resolve(component({ key })));
      checks.findMostRecentForComponent.mockImplementation((key: string) =>
        key === "database" ? Promise.resolve(check()) : Promise.resolve(null),
      );

      const result = await service.getAllCurrentStatuses();

      expect(result).toEqual([
        {
          componentKey: "database",
          status: "healthy",
          detail: null,
          checkedAt: NOW.toISOString(),
          source: "manual",
        },
        {
          componentKey: "wordpress",
          status: "unknown",
          detail: null,
          checkedAt: null,
          source: null,
        },
      ]);
    });
  });
});
