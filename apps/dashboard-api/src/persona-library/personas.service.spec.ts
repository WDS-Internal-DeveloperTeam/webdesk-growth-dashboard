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
import type { ServicesService } from "../service-library/services.service.js";
import { PersonasService } from "./personas.service.js";

const NOW = new Date("2026-08-22T00:00:00.000Z");
// A well-formed UUID for tests that need a relatedServiceIds entry to actually reach
// services.existingServiceIds() — assertServiceIdsExist() filters out non-UUID-shaped entries
// before querying, so a plain string like "service-1" would never be looked up at all.
const FAKE_SERVICE_ID = "11111111-1111-4111-8111-111111111111";

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `PersonasService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

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
  let services: { existingServiceIds: ReturnType<typeof vi.fn> };
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
    // Defaults to "every id resolves" so tests that don't care about relatedServiceIds
    // validation (the majority) don't need to stub this themselves.
    services = { existingServiceIds: vi.fn().mockResolvedValue(new Set()) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new PersonasService(
      personas as unknown as PersonaRepository,
      services as unknown as ServicesService,
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

    it("sanitizes rich-text fields before writing, stripping a disallowed tag (2026-08-22 rich-text editor rollout)", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      personas.create.mockResolvedValue(persona());

      await svc.create(
        {
          publicId: "PERSONA-X",
          name: "X",
          goals: "<script>alert(1)</script><p>Reduce cost</p>",
          pains: null,
          triggers: undefined,
        },
        "actor-1",
      );

      const [writtenInput] = personas.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.goals).toBe("<p>Reduce cost</p>");
      // null/undefined pass through unchanged rather than being coerced into an empty string.
      expect(writtenInput.pains).toBeNull();
      expect(writtenInput.triggers).toBeUndefined();
    });

    it("sanitizes every one of the 8 narrative fields on create, not just goals", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      personas.create.mockResolvedValue(persona());
      const dirty = "<p>Text</p><script>bad</script>";
      const clean = "<p>Text</p>";

      await svc.create(
        {
          publicId: "PERSONA-X",
          name: "X",
          pains: dirty,
          triggers: dirty,
          objections: dirty,
          decisionCriteria: dirty,
          badFitSignals: dirty,
          messagingTrack: dirty,
          ctaPreferences: dirty,
        },
        "actor-1",
      );

      const [writtenInput] = personas.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.pains).toBe(clean);
      expect(writtenInput.triggers).toBe(clean);
      expect(writtenInput.objections).toBe(clean);
      expect(writtenInput.decisionCriteria).toBe(clean);
      expect(writtenInput.badFitSignals).toBe(clean);
      expect(writtenInput.messagingTrack).toBe(clean);
      expect(writtenInput.ctaPreferences).toBe(clean);
    });

    it("validates relatedServiceIds against the real services table before creating", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      personas.create.mockResolvedValue(persona());
      services.existingServiceIds.mockResolvedValue(new Set([FAKE_SERVICE_ID]));

      await svc.create(
        { publicId: "PERSONA-X", name: "X", relatedServiceIds: [FAKE_SERVICE_ID] },
        "actor-1",
      );

      expect(services.existingServiceIds).toHaveBeenCalledWith([FAKE_SERVICE_ID]);
      expect(personas.create).toHaveBeenCalled();
    });

    it("treats a malformed (non-UUID) relatedServiceIds entry as not-found, without querying it", async () => {
      personas.findByPublicId.mockResolvedValue(null);

      await expect(
        svc.create(
          { publicId: "PERSONA-X", name: "X", relatedServiceIds: ["not-even-a-uuid"] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      // A malformed id must never be sent to services.existingServiceIds() — Postgres's uuid column type
      // would reject it with a raw driver error instead of this clean 400.
      expect(services.existingServiceIds).not.toHaveBeenCalled();
    });

    it("rejects relatedServiceIds that don't resolve to real services, without creating", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      // Well-formed UUID, but findByIds() reports it doesn't exist as a real service.
      services.existingServiceIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          { publicId: "PERSONA-X", name: "X", relatedServiceIds: [FAKE_SERVICE_ID] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(personas.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      personas.create.mockRejectedValue(uniqueConstraintError());

      await expect(svc.create({ publicId: "PERSONA-RACE", name: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      personas.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      personas.create.mockRejectedValue(dbError);

      await expect(svc.create({ publicId: "PERSONA-X", name: "X" }, "actor-1")).rejects.toBe(
        dbError,
      );
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
    beforeEach(() => {
      // The pre-fetch reintroduced by the 2026-08-22 rich-text editor rollout (see below) needs
      // a "current" persona to diff rich-text fields against — default every update() test to a
      // successful pre-fetch so tests unrelated to that behavior don't need to stub it themselves.
      personas.findById.mockResolvedValue(persona());
    });

    it("pre-fetches the persona before updating, 404ing cleanly before any write is attempted (reintroduced 2026-08-22 for the rich-text editor rollout)", async () => {
      // A prior code-review pass removed this pre-fetch as a wasted SELECT when Persona Library
      // had no rich-text fields to diff against a "current" value. Now that it does
      // (sanitizeNullableRichTextIfChanged() needs `current` to skip re-sanitizing an unchanged
      // field), the pre-fetch is load-bearing again, mirroring ServicesService.update()'s own
      // findServiceOrThrow()-first ordering.
      personas.findById.mockResolvedValue(null);

      await expect(svc.update("missing", { name: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(personas.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the repository update finds nothing to update (a TOCTOU race after a successful pre-fetch)", async () => {
      personas.update.mockResolvedValue(null);

      await expect(svc.update("persona-1", { name: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("sanitizes rich-text fields before writing, stripping a disallowed tag", async () => {
      personas.update.mockResolvedValue(persona());

      await svc.update(
        "persona-1",
        { pains: "<script>alert(1)</script><p>Budget freeze</p>" },
        "actor-1",
      );

      const [, writtenPatch] = personas.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(writtenPatch.pains).toBe("<p>Budget freeze</p>");
    });

    it("skips re-sanitizing a rich-text field the patch resends unchanged from the current stored value", async () => {
      personas.findById.mockResolvedValue(persona({ goals: "<p>Reduce cost</p>" }));
      personas.update.mockResolvedValue(persona());

      // Resends goals byte-for-byte unchanged, alongside a real change to a different field.
      await svc.update("persona-1", { goals: "<p>Reduce cost</p>", name: "Renamed" }, "actor-1");

      const [, writtenPatch] = personas.update.mock.calls[0] as [string, Record<string, unknown>];
      // Unchanged and returned verbatim — proves the real HTML parse/allowlist-filter was
      // skipped, not just that the value happens to look the same afterward.
      expect(writtenPatch.goals).toBe("<p>Reduce cost</p>");
      expect(writtenPatch.name).toBe("Renamed");
    });

    it("proves the skip is a real skip, not a run that happens to produce identical output (code-review finding: the prior version of this test used an already-clean fixture, so it couldn't distinguish the two)", async () => {
      // A value containing a tag the sanitizer's own allowlist would strip if it ran, stored as
      // the "current" value (representing e.g. a row written before this sanitizer existed) and
      // resent unchanged. If sanitizeNullableRichTextIfChanged() actually skipped re-sanitizing,
      // the disallowed tag survives verbatim; if it re-ran the real sanitizer despite the values
      // matching, the tag would be stripped and this assertion would fail.
      const dirty = "<script>alert(1)</script><p>Reduce cost</p>";
      personas.findById.mockResolvedValue(persona({ goals: dirty }));
      personas.update.mockResolvedValue(persona());

      await svc.update("persona-1", { goals: dirty }, "actor-1");

      const [, writtenPatch] = personas.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(writtenPatch.goals).toBe(dirty);
    });

    it("never accepts approvalStatus or version through the general update patch", async () => {
      personas.update.mockResolvedValue(persona({ name: "Renamed", version: 2 }));

      // TypeScript's own UpdatePersonaDto type already excludes approvalStatus/version; this
      // proves the service layer doesn't forward whatever extra keys a patch object might carry.
      await svc.update("persona-1", { name: "Renamed" }, "actor-1");

      const [, patchArg] = personas.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("version");
    });

    it("returns the repository's updated entity, with version incremented server-side", async () => {
      personas.update.mockResolvedValue(persona({ name: "Renamed", version: 4 }));

      const result = await svc.update("persona-1", { name: "Renamed" }, "actor-1");

      expect(result.version).toBe(4);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "persona" }),
      );
    });

    it("validates relatedServiceIds against the real services table before writing", async () => {
      services.existingServiceIds.mockResolvedValue(new Set([FAKE_SERVICE_ID]));
      personas.update.mockResolvedValue(persona());

      await svc.update("persona-1", { relatedServiceIds: [FAKE_SERVICE_ID] }, "actor-1");

      expect(services.existingServiceIds).toHaveBeenCalledWith([FAKE_SERVICE_ID]);
      expect(personas.update).toHaveBeenCalled();
    });

    it("rejects relatedServiceIds that don't resolve to real services, without writing", async () => {
      services.existingServiceIds.mockResolvedValue(new Set());

      await expect(
        svc.update("persona-1", { relatedServiceIds: ["missing"] }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(personas.update).not.toHaveBeenCalled();
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
