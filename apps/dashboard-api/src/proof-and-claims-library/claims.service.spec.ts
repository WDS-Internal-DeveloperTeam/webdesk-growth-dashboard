import type { ProofClaimEntity, ProofClaimRepository } from "@webdesk/database";
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
import { ClaimsService } from "./claims.service.js";

const NOW = new Date("2026-08-22T00:00:00.000Z");
// A well-formed UUID for tests that need a relatedServiceIds entry to actually reach
// services.existingServiceIds() — assertServiceIdsExist() filters out non-UUID-shaped entries
// before querying, so a plain string like "service-1" would never be looked up at all.
const FAKE_SERVICE_ID = "11111111-1111-4111-8111-111111111111";

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `ClaimsService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function claim(overrides: Partial<ProofClaimEntity> = {}): ProofClaimEntity {
  return {
    id: "claim-1",
    publicId: "PROOF-99-UPTIME",
    claim: "99.9% uptime SLA",
    claimType: null,
    beforeValue: null,
    afterValue: null,
    verificationStatus: "unverified",
    approvedWording: null,
    restrictions: null,
    expiryReviewDate: null,
    relatedServiceIds: [],
    relatedCaseStudyIds: [],
    relatedPageIds: [],
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ClaimsService", () => {
  let claims: {
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
  let svc: ClaimsService;

  beforeEach(() => {
    claims = {
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
    svc = new ClaimsService(
      claims as unknown as ProofClaimRepository,
      services as unknown as ServicesService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a proof claim after validating the publicId is free", async () => {
      claims.findByPublicId.mockResolvedValue(null);
      claims.create.mockResolvedValue(claim());

      const result = await svc.create(
        { publicId: "PROOF-99-UPTIME", claim: "99.9% uptime SLA" },
        "actor-1",
      );

      expect(result).toEqual(claim());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "proof_claim" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      claims.findByPublicId.mockResolvedValue(claim());

      await expect(
        svc.create({ publicId: "PROOF-99-UPTIME", claim: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(claims.create).not.toHaveBeenCalled();
    });

    it("passes plain-text fields through unchanged (no sanitization for this backend-only pass)", async () => {
      claims.findByPublicId.mockResolvedValue(null);
      claims.create.mockResolvedValue(claim());

      await svc.create(
        {
          publicId: "PROOF-X",
          claim: "X",
          approvedWording: "<script>alert(1)</script>",
        },
        "actor-1",
      );

      const [writtenInput] = claims.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.approvedWording).toBe("<script>alert(1)</script>");
    });

    it("validates relatedServiceIds against the real services table before creating", async () => {
      claims.findByPublicId.mockResolvedValue(null);
      claims.create.mockResolvedValue(claim());
      services.existingServiceIds.mockResolvedValue(new Set([FAKE_SERVICE_ID]));

      await svc.create(
        { publicId: "PROOF-X", claim: "X", relatedServiceIds: [FAKE_SERVICE_ID] },
        "actor-1",
      );

      expect(services.existingServiceIds).toHaveBeenCalledWith([FAKE_SERVICE_ID]);
      expect(claims.create).toHaveBeenCalled();
    });

    it("treats a malformed (non-UUID) relatedServiceIds entry as not-found, without querying it", async () => {
      claims.findByPublicId.mockResolvedValue(null);

      await expect(
        svc.create(
          { publicId: "PROOF-X", claim: "X", relatedServiceIds: ["not-even-a-uuid"] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      // A malformed id must never be sent to services.existingServiceIds() — Postgres's uuid column type
      // would reject it with a raw driver error instead of this clean 400.
      expect(services.existingServiceIds).not.toHaveBeenCalled();
    });

    it("rejects relatedServiceIds that don't resolve to real services, without creating", async () => {
      claims.findByPublicId.mockResolvedValue(null);
      // Well-formed UUID, but findByIds() reports it doesn't exist as a real service.
      services.existingServiceIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          { publicId: "PROOF-X", claim: "X", relatedServiceIds: [FAKE_SERVICE_ID] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(claims.create).not.toHaveBeenCalled();
    });

    it("does not validate relatedCaseStudyIds/relatedPageIds (unvalidated identifier lists)", async () => {
      claims.findByPublicId.mockResolvedValue(null);
      claims.create.mockResolvedValue(claim());

      await svc.create(
        {
          publicId: "PROOF-X",
          claim: "X",
          relatedCaseStudyIds: ["not-a-real-case-study"],
          relatedPageIds: ["not-a-real-page"],
        },
        "actor-1",
      );

      expect(services.existingServiceIds).not.toHaveBeenCalled();
      expect(claims.create).toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      claims.findByPublicId.mockResolvedValue(null);
      claims.create.mockRejectedValue(uniqueConstraintError());

      await expect(svc.create({ publicId: "PROOF-RACE", claim: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      claims.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      claims.create.mockRejectedValue(dbError);

      await expect(svc.create({ publicId: "PROOF-X", claim: "X" }, "actor-1")).rejects.toBe(
        dbError,
      );
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the proof claim does not exist", async () => {
      claims.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the proof claim when it exists", async () => {
      claims.findById.mockResolvedValue(claim());
      await expect(svc.findById("claim-1")).resolves.toEqual(claim());
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      claims.list.mockResolvedValue([claim()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(claims.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([claim()]);
    });
  });

  describe("update", () => {
    it("does not pre-fetch the claim before updating (no wasted read)", async () => {
      claims.update.mockResolvedValue(claim({ claim: "Renamed" }));

      await svc.update("claim-1", { claim: "Renamed" }, "actor-1");

      expect(claims.findById).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the repository update finds nothing to update", async () => {
      claims.update.mockResolvedValue(null);

      await expect(svc.update("missing", { claim: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("never accepts approvalStatus through the general update patch", async () => {
      claims.update.mockResolvedValue(claim({ claim: "Renamed" }));

      // TypeScript's own UpdateProofClaimDto type already excludes approvalStatus; this proves
      // the service layer doesn't forward whatever extra keys a patch object might carry.
      await svc.update("claim-1", { claim: "Renamed" }, "actor-1");

      const [, patchArg] = claims.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
    });

    it("returns the repository's updated entity and records an audit event", async () => {
      claims.update.mockResolvedValue(claim({ claim: "Renamed" }));

      const result = await svc.update("claim-1", { claim: "Renamed" }, "actor-1");

      expect(result.claim).toBe("Renamed");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "proof_claim" }),
      );
    });

    it("validates relatedServiceIds against the real services table before writing", async () => {
      services.existingServiceIds.mockResolvedValue(new Set([FAKE_SERVICE_ID]));
      claims.update.mockResolvedValue(claim());

      await svc.update("claim-1", { relatedServiceIds: [FAKE_SERVICE_ID] }, "actor-1");

      expect(services.existingServiceIds).toHaveBeenCalledWith([FAKE_SERVICE_ID]);
      expect(claims.update).toHaveBeenCalled();
    });

    it("rejects relatedServiceIds that don't resolve to real services, without writing", async () => {
      services.existingServiceIds.mockResolvedValue(new Set());

      await expect(
        svc.update("claim-1", { relatedServiceIds: ["missing"] }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(claims.update).not.toHaveBeenCalled();
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      claims.findById.mockResolvedValue(claim({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("claim-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      claims.findById.mockResolvedValue(claim({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("claim-1", "approved", "actor-1")).rejects.toThrow(
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
      claims.findById.mockResolvedValue(claim({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      claims.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: claim({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("claim-1", to, "actor-1");

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
        claims.findById.mockResolvedValue(claim({ approvalStatus: from }));
        authorizationService.assertAllowed.mockResolvedValue(undefined);
        claims.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: claim({ approvalStatus: to }),
        });

        await svc.changeApprovalStatus("claim-1", to, "actor-1");

        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          "actor-1",
          "service_persona_proof",
          "submit",
        );
      },
    );

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      claims.findById.mockResolvedValueOnce(claim({ approvalStatus: "archived" }));
      await expect(svc.changeApprovalStatus("claim-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      claims.findById.mockResolvedValueOnce(claim({ approvalStatus: "superseded" }));
      await expect(svc.changeApprovalStatus("claim-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      claims.findById.mockResolvedValue(claim({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: service_persona_proof:approve"),
      );

      await expect(svc.changeApprovalStatus("claim-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(claims.updateStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      claims.findById.mockResolvedValue(claim({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      claims.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("claim-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      claims.findById.mockResolvedValue(claim({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      claims.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: claim({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("claim-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      claims.findById.mockResolvedValue(claim({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      claims.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: claim({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("claim-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
