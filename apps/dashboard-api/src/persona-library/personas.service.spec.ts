import type { PersonaEntity, PersonaRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { PersonasService } from "./personas.service.js";

const NOW = new Date("2026-08-22T00:00:00.000Z");

function persona(overrides: Partial<PersonaEntity> = {}): PersonaEntity {
  return {
    id: "persona-1",
    publicId: "PERSONA-ENTERPRISE-IT-DIRECTOR",
    name: "Enterprise IT Director",
    buyerType: null,
    companySize: null,
    roles: [],
    industries: [],
    geography: null,
    goals: null,
    pains: null,
    triggers: null,
    objections: null,
    decisionCriteria: null,
    relatedServiceIds: [],
    badFitSignals: null,
    messagingTrack: null,
    ctaPreferences: null,
    approvalStatus: "draft",
    version: 1,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("PersonasService", () => {
  let personas: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: PersonasService;

  beforeEach(() => {
    personas = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new PersonasService(
      personas as unknown as PersonaRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a persona after validating the publicId is free", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      personas.create.mockResolvedValue(persona());

      const result = await svc.create(
        { publicId: "PERSONA-ENTERPRISE-IT-DIRECTOR", name: "Enterprise IT Director" },
        "actor-1",
      );

      expect(result).toEqual(persona());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "persona" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      personas.findByPublicId.mockResolvedValue(persona());

      await expect(
        svc.create({ publicId: "PERSONA-ENTERPRISE-IT-DIRECTOR", name: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(personas.create).not.toHaveBeenCalled();
    });

    it("passes the plain-text fields through unchanged (no sanitization for this module)", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      personas.create.mockResolvedValue(persona());

      await svc.create(
        {
          publicId: "PERSONA-X",
          name: "X",
          goals: "<script>alert(1)</script>",
        },
        "actor-1",
      );

      const [writtenInput] = personas.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.goals).toBe("<script>alert(1)</script>");
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the persona does not exist", async () => {
      personas.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the persona when it exists", async () => {
      personas.findById.mockResolvedValue(persona());
      await expect(svc.findById("persona-1")).resolves.toEqual(persona());
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      personas.list.mockResolvedValue([persona()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(personas.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([persona()]);
    });
  });

  describe("update", () => {
    it("404s cleanly before touching anything else when the persona does not exist", async () => {
      personas.findById.mockResolvedValue(null);
      await expect(svc.update("missing", { name: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(personas.update).not.toHaveBeenCalled();
    });

    it("never accepts approvalStatus or version through the general update patch", async () => {
      personas.findById.mockResolvedValue(persona());
      personas.update.mockResolvedValue(persona({ name: "Renamed", version: 2 }));

      // TypeScript's own UpdatePersonaDto type already excludes approvalStatus/version; this
      // proves the service layer doesn't forward whatever extra keys a patch object might carry.
      await svc.update("persona-1", { name: "Renamed" }, "actor-1");

      const [, patchArg] = personas.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("version");
    });

    it("returns the repository's updated entity, with version incremented server-side", async () => {
      personas.findById.mockResolvedValue(persona({ version: 3 }));
      personas.update.mockResolvedValue(persona({ name: "Renamed", version: 4 }));

      const result = await svc.update("persona-1", { name: "Renamed" }, "actor-1");

      expect(result.version).toBe(4);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "persona" }),
      );
    });

    it("throws NotFoundException if the repository update races a deletion and returns null", async () => {
      personas.findById.mockResolvedValue(persona());
      personas.update.mockResolvedValue(null);

      await expect(svc.update("persona-1", { name: "Renamed" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      personas.findById.mockResolvedValue(persona({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("persona-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("does not increment version on a status transition", async () => {
      personas.findById.mockResolvedValue(persona({ approvalStatus: "draft", version: 5 }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      personas.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: persona({ approvalStatus: "submitted", version: 5 }),
      });

      const result = await svc.changeApprovalStatus("persona-1", "submitted", "actor-1");
      expect(result.version).toBe(5);
    });

    it("rejects a transition not in the allowlist", async () => {
      personas.findById.mockResolvedValue(persona({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("persona-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "approved", "approve"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
      ["approved", "superseded", "approve"],
      ["draft", "archived", "approve"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      personas.findById.mockResolvedValue(persona({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      personas.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: persona({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("persona-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        action,
      );
    });

    it.each([
      ["submitted", "draft"],
      ["revision_requested", "draft"],
      ["rejected", "draft"],
    ] as const)(
      "requires the 'submit' action for %s -> draft (the submitter/editor drives the revise loop, not the approver)",
      async (from, to) => {
        personas.findById.mockResolvedValue(persona({ approvalStatus: from }));
        authorizationService.assertAllowed.mockResolvedValue(undefined);
        personas.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: persona({ approvalStatus: to }),
        });

        await svc.changeApprovalStatus("persona-1", to, "actor-1");

        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          "actor-1",
          "service_persona_proof",
          "submit",
        );
      },
    );

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      personas.findById.mockResolvedValueOnce(persona({ approvalStatus: "archived" }));
      await expect(svc.changeApprovalStatus("persona-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      personas.findById.mockResolvedValueOnce(persona({ approvalStatus: "superseded" }));
      await expect(svc.changeApprovalStatus("persona-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      personas.findById.mockResolvedValue(persona({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: service_persona_proof:approve"),
      );

      await expect(svc.changeApprovalStatus("persona-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(personas.updateStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      personas.findById.mockResolvedValue(persona({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      personas.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("persona-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      personas.findById.mockResolvedValue(persona({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      personas.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: persona({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("persona-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      personas.findById.mockResolvedValue(persona({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      personas.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: persona({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("persona-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
