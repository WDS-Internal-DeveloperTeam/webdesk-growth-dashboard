import type {
  IntegrationRepository,
  WebhookEventEntity,
  WebhookEventRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { WebhookEventsService } from "./webhook-events.service.js";

const NOW = new Date("2026-09-07T00:00:00.000Z");
const INTEGRATION_ID = "11111111-1111-4111-8111-111111111111";

function webhookEvent(overrides: Partial<WebhookEventEntity> = {}): WebhookEventEntity {
  return {
    id: "event-1",
    integrationId: INTEGRATION_ID,
    eventType: "push",
    receivedAt: NOW.toISOString(),
    payloadSummary: null,
    processingStatus: "received",
    errorMessage: null,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("WebhookEventsService", () => {
  let integrations: { existsById: ReturnType<typeof vi.fn> };
  let events: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: WebhookEventsService;

  beforeEach(() => {
    integrations = { existsById: vi.fn().mockResolvedValue(true) };
    events = { create: vi.fn(), findById: vi.fn(), list: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new WebhookEventsService(
      integrations as unknown as IntegrationRepository,
      events as unknown as WebhookEventRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a webhook event with no integrationId (an unmatched event)", async () => {
      events.create.mockResolvedValue(webhookEvent({ integrationId: null }));

      const result = await svc.create({ eventType: "push" }, "actor-1");

      expect(integrations.existsById).not.toHaveBeenCalled();
      expect(result.integrationId).toBeNull();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "webhook_processed" }),
      );
    });

    it("validates a supplied integrationId exists, rejecting a dangling reference with a clean 400", async () => {
      integrations.existsById.mockResolvedValue(false);

      await expect(
        svc.create({ integrationId: INTEGRATION_ID, eventType: "push" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(events.create).not.toHaveBeenCalled();
    });

    it("creates and links to a real integration", async () => {
      events.create.mockResolvedValue(webhookEvent());

      const result = await svc.create(
        { integrationId: INTEGRATION_ID, eventType: "push" },
        "actor-1",
      );

      expect(result.integrationId).toBe(INTEGRATION_ID);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the event does not exist", async () => {
      events.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("listByIntegration", () => {
    it("validates the parent integration exists first, then lists scoped to it", async () => {
      events.list.mockResolvedValue([webhookEvent()]);

      const result = await svc.listByIntegration(INTEGRATION_ID, {});

      expect(integrations.existsById).toHaveBeenCalledWith(INTEGRATION_ID);
      expect(events.list).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: INTEGRATION_ID }),
      );
      expect(result).toHaveLength(1);
    });

    it("throws NotFoundException when the parent integration doesn't exist", async () => {
      integrations.existsById.mockResolvedValue(false);
      await expect(svc.listByIntegration(INTEGRATION_ID, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("lists across every integration with no scoping", async () => {
      events.list.mockResolvedValue([webhookEvent(), webhookEvent({ integrationId: null })]);
      const result = await svc.list({});
      expect(result).toHaveLength(2);
    });
  });
});
