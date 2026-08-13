import type { OperationalContactEntity } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { OperationalContactsController } from "./operational-contacts.controller.js";
import type { OperationalContactService } from "./operational-contact.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function contact(overrides: Partial<OperationalContactEntity> = {}): OperationalContactEntity {
  return {
    id: "contact-1",
    contactUserId: null,
    contactName: "Jane Vendor",
    contactEmail: "jane@vendor.example.com",
    contactPhone: "+1-555-0100",
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

function fakeRequest(): AuthenticatedRequest & RequestWithCorrelationId {
  return {
    authUser: { id: "actor-1", sessionId: "session-1" },
    correlationId: "corr-1",
  } as AuthenticatedRequest & RequestWithCorrelationId;
}

/**
 * Closes `docs/security/threat-model-phase-1e-operational-infrastructure.md`'s Information
 * Disclosure finding: `contactName`/`contactEmail`/`contactPhone` were previously returned
 * unfiltered to any caller with plain `contacts_view`, with no confidential-field gating
 * comparable to the Phase 1D-expanded `view_confidential` precedent used elsewhere. No real HTTP
 * grant exists to prove this end-to-end (this project deliberately has no code path that grants a
 * `role_permissions` row outside a migration — see `operational-contacts.e2e-spec.ts`'s own "zero
 * seeded grants" design), so this is tested at the controller level, mocking
 * `AuthorizationService.canViewConfidential` directly.
 */
describe("OperationalContactsController — confidential-field gating", () => {
  let contactService: {
    list: ReturnType<typeof vi.fn>;
    resolveEscalationChain: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { canViewConfidential: ReturnType<typeof vi.fn> };
  let controller: OperationalContactsController;

  beforeEach(() => {
    contactService = {
      list: vi.fn(),
      resolveEscalationChain: vi.fn(),
      findById: vi.fn(),
    };
    authorizationService = { canViewConfidential: vi.fn() };
    controller = new OperationalContactsController(
      contactService as unknown as OperationalContactService,
      authorizationService as unknown as AuthorizationService,
    );
  });

  describe("list", () => {
    it("strips PII when the caller cannot view confidential data", async () => {
      contactService.list.mockResolvedValue([contact()]);
      authorizationService.canViewConfidential.mockResolvedValue(false);

      const result = await controller.list({}, fakeRequest());

      expect(authorizationService.canViewConfidential).toHaveBeenCalledWith(
        "actor-1",
        "system_settings",
      );
      expect(result.data[0]).not.toHaveProperty("contactName");
      expect(result.data[0]).not.toHaveProperty("contactEmail");
      expect(result.data[0]).not.toHaveProperty("contactPhone");
      expect(result.data[0]).toMatchObject({ id: "contact-1", area: "devops" });
    });

    it("returns PII unredacted when the caller can view confidential data", async () => {
      contactService.list.mockResolvedValue([contact()]);
      authorizationService.canViewConfidential.mockResolvedValue(true);

      const result = await controller.list({}, fakeRequest());

      expect(result.data[0]).toMatchObject({
        contactName: "Jane Vendor",
        contactEmail: "jane@vendor.example.com",
        contactPhone: "+1-555-0100",
      });
    });
  });

  describe("escalationChain", () => {
    it("strips PII from every contact in the resolved chain when the caller cannot view confidential data", async () => {
      contactService.resolveEscalationChain.mockResolvedValue([
        contact({ id: "contact-1", role: "primary" }),
        contact({ id: "contact-2", role: "backup" }),
      ]);
      authorizationService.canViewConfidential.mockResolvedValue(false);

      const result = await controller.escalationChain(
        { area: "devops", severity: "high" },
        fakeRequest(),
      );

      expect(result.data).toHaveLength(2);
      for (const record of result.data) {
        expect(record).not.toHaveProperty("contactEmail");
      }
    });
  });

  describe("getById", () => {
    it("strips PII when the caller cannot view confidential data", async () => {
      contactService.findById.mockResolvedValue(contact());
      authorizationService.canViewConfidential.mockResolvedValue(false);

      const result = await controller.getById("contact-1", fakeRequest());

      expect(result.data).not.toHaveProperty("contactName");
      expect(result.data).not.toHaveProperty("contactEmail");
      expect(result.data).not.toHaveProperty("contactPhone");
    });

    it("returns PII unredacted when the caller can view confidential data", async () => {
      contactService.findById.mockResolvedValue(contact());
      authorizationService.canViewConfidential.mockResolvedValue(true);

      const result = await controller.getById("contact-1", fakeRequest());

      expect(result.data).toMatchObject({ contactName: "Jane Vendor" });
    });
  });
});
