import type { OperationalContactEntity, OperationalContactRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { OperationalContactService } from "./operational-contact.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function contact(overrides: Partial<OperationalContactEntity> = {}): OperationalContactEntity {
  return {
    id: "contact-1",
    contactUserId: null,
    contactName: "Ops Vendor",
    contactEmail: null,
    contactPhone: null,
    area: "devops",
    role: "primary",
    escalationPriority: 1,
    channelPreference: "email",
    severityApplicability: null,
    workingHoursStart: null,
    workingHoursEnd: null,
    timeZone: null,
    effectiveStartDate: NOW.toISOString(),
    effectiveEndDate: null,
    activeStatus: true,
    verificationStatus: "unverified",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("OperationalContactService", () => {
  let contacts: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    findActiveForArea: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: OperationalContactService;

  beforeEach(() => {
    contacts = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      findActiveForArea: vi.fn(),
    };
    auditService = { record: vi.fn() };
    service = new OperationalContactService(
      contacts as unknown as OperationalContactRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a contact and records an audit event", async () => {
      contacts.create.mockResolvedValue(contact());
      const result = await service.create(
        { area: "devops", role: "primary", escalationPriority: 1, contactName: "Ops Vendor" },
        "actor-1",
      );

      expect(contacts.create).toHaveBeenCalledOnce();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "operational_contact_created",
          actorUserId: "actor-1",
          entityType: "operational_contact",
          action: "create",
        }),
      );
      expect(result.id).toBe("contact-1");
    });

    it("rejects a contact with neither contactUserId nor contactName", async () => {
      await expect(
        service.create({ area: "devops", role: "primary", escalationPriority: 1 }, "actor-1"),
      ).rejects.toThrow(/requires either contactUserId or contactName/);
      expect(contacts.create).not.toHaveBeenCalled();
    });

    it("rejects a non-positive escalationPriority", async () => {
      await expect(
        service.create(
          { area: "devops", role: "primary", escalationPriority: 0, contactName: "X" },
          "actor-1",
        ),
      ).rejects.toThrow(/escalationPriority must be a positive integer/);
    });
  });

  describe("update", () => {
    it("updates a contact and records an audit event", async () => {
      contacts.findById.mockResolvedValue(contact());
      contacts.update.mockResolvedValue(contact({ escalationPriority: 2 }));

      const result = await service.update("contact-1", { escalationPriority: 2 }, "actor-2");

      expect(contacts.update).toHaveBeenCalledWith("contact-1", { escalationPriority: 2 });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "operational_contact_updated",
          actorUserId: "actor-2",
          action: "update",
        }),
      );
      expect(result.escalationPriority).toBe(2);
    });

    it("deactivate() sets activeStatus false via update", async () => {
      contacts.findById.mockResolvedValue(contact());
      contacts.update.mockResolvedValue(contact({ activeStatus: false }));

      await service.deactivate("contact-1", "actor-2");

      expect(contacts.update).toHaveBeenCalledWith("contact-1", { activeStatus: false });
    });

    it("throws when the contact doesn't exist", async () => {
      contacts.findById.mockResolvedValue(null);
      await expect(service.update("contact-1", {}, "actor-2")).rejects.toThrow(/not found/);
    });
  });

  describe("resolveEscalationChain", () => {
    it("orders primary contacts before backups, then by escalation priority", async () => {
      contacts.findActiveForArea.mockResolvedValue([
        contact({ id: "backup-1", role: "backup", escalationPriority: 1 }),
        contact({ id: "primary-2", role: "primary", escalationPriority: 2 }),
        contact({ id: "primary-1", role: "primary", escalationPriority: 1 }),
      ]);

      const chain = await service.resolveEscalationChain("devops", "high", NOW);

      expect(chain.map((c) => c.id)).toEqual(["primary-1", "primary-2", "backup-1"]);
    });

    it("excludes contacts outside their effective date window", async () => {
      contacts.findActiveForArea.mockResolvedValue([
        contact({ id: "not-yet", effectiveStartDate: "2030-01-01T00:00:00.000Z" }),
        contact({ id: "expired", effectiveEndDate: "2020-01-01T00:00:00.000Z" }),
        contact({ id: "current" }),
      ]);

      const chain = await service.resolveEscalationChain("devops", "high", NOW);

      expect(chain.map((c) => c.id)).toEqual(["current"]);
    });

    it("excludes contacts that don't apply to the requested severity", async () => {
      contacts.findActiveForArea.mockResolvedValue([
        contact({ id: "critical-only", severityApplicability: ["critical"] }),
        contact({ id: "any-severity", severityApplicability: null }),
        contact({ id: "high-included", severityApplicability: ["high", "medium"] }),
      ]);

      const chain = await service.resolveEscalationChain("devops", "high", NOW);

      expect(chain.map((c) => c.id).sort()).toEqual(["any-severity", "high-included"]);
    });

    it("excludes contacts outside their configured working hours", async () => {
      // NOW is 2026-08-13T00:00:00.000Z — represent it in a contact's own timezone.
      contacts.findActiveForArea.mockResolvedValue([
        contact({
          id: "outside-hours",
          workingHoursStart: "09:00:00",
          workingHoursEnd: "17:00:00",
          timeZone: "UTC",
        }),
        contact({ id: "no-hours-restriction" }),
      ]);

      const chain = await service.resolveEscalationChain("devops", "high", NOW);

      expect(chain.map((c) => c.id)).toEqual(["no-hours-restriction"]);
    });
  });
});
