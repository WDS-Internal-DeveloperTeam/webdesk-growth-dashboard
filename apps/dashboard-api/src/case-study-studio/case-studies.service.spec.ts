import type { CaseStudyEntity, CaseStudyRepository } from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { ServicesService } from "../service-library/services.service.js";
import type { ClaimsService } from "../proof-and-claims-library/claims.service.js";
import type { UsersService } from "../users/users.service.js";
import { CaseStudiesService } from "./case-studies.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// reviews.service.spec.ts's own established pattern for the identical mocking need.
vi.mock("@webdesk/database", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest's importOriginal<T>() needs the actual module's type inline; no top-level type-only equivalent exists for this generic parameter.
  const actual = await importOriginal<typeof import("@webdesk/database")>();
  return {
    ...actual,
    withTransaction: vi.fn((fn: (transaction: unknown) => unknown) =>
      fn({ fakeTransaction: true }),
    ),
  };
});

const NOW = new Date("2026-08-31T00:00:00.000Z");
const FAKE_SERVICE_ID = "11111111-1111-4111-8111-111111111111";
const FAKE_CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const FAKE_USER_ID = "33333333-3333-4333-8333-333333333333";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function caseStudy(overrides: Partial<CaseStudyEntity> = {}): CaseStudyEntity {
  return {
    id: "cs-1",
    publicId: "CS-ACME-001",
    clientName: "Acme Corp",
    projectTitle: "Website Relaunch",
    industry: null,
    platform: null,
    visibility: "internal_only",
    embargoDate: null,
    challenge: null,
    solution: null,
    implementation: null,
    results: null,
    relatedServiceIds: [],
    relatedClaimIds: [],
    assignedReviewerUserId: null,
    clientApprovalRequired: false,
    status: "intake",
    scheduledPublishAt: null,
    publishedAt: null,
    unpublishReason: null,
    version: 1,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("CaseStudiesService", () => {
  let caseStudies: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let caseStudyApprovals: {
    create: ReturnType<typeof vi.fn>;
    listByCaseStudy: ReturnType<typeof vi.fn>;
  };
  let services: { existingServiceIds: ReturnType<typeof vi.fn> };
  let claims: { existingClaimIds: ReturnType<typeof vi.fn> };
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: CaseStudiesService;

  beforeEach(() => {
    caseStudies = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    caseStudyApprovals = { create: vi.fn(), listByCaseStudy: vi.fn() };
    services = { existingServiceIds: vi.fn().mockResolvedValue(new Set()) };
    claims = { existingClaimIds: vi.fn().mockResolvedValue(new Set()) };
    usersService = { assertUserExists: vi.fn().mockResolvedValue(undefined) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new CaseStudiesService(
      caseStudies as unknown as CaseStudyRepository,
      caseStudyApprovals as never,
      services as unknown as ServicesService,
      claims as unknown as ClaimsService,
      usersService as unknown as UsersService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a case study after validating the publicId is free", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      caseStudies.create.mockResolvedValue(caseStudy());

      const result = await svc.create(
        { publicId: "CS-ACME-001", clientName: "Acme Corp", projectTitle: "Website Relaunch" },
        "actor-1",
      );

      expect(result).toEqual(caseStudy());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "case_study" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      caseStudies.findByPublicId.mockResolvedValue(caseStudy());

      await expect(
        svc.create(
          { publicId: "CS-ACME-001", clientName: "Acme Corp", projectTitle: "X" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(caseStudies.create).not.toHaveBeenCalled();
    });

    it("sanitizes the four narrative fields before writing, stripping a disallowed tag", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      caseStudies.create.mockResolvedValue(caseStudy());

      await svc.create(
        {
          publicId: "CS-X",
          clientName: "Acme",
          projectTitle: "X",
          challenge: "<script>alert(1)</script><p>Legacy CMS</p>",
          solution: null,
        },
        "actor-1",
      );

      const [writtenInput] = caseStudies.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.challenge).toBe("<p>Legacy CMS</p>");
      expect(writtenInput.solution).toBeNull();
    });

    it("validates relatedServiceIds against the real services table before creating", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      caseStudies.create.mockResolvedValue(caseStudy());
      services.existingServiceIds.mockResolvedValue(new Set([FAKE_SERVICE_ID]));

      await svc.create(
        {
          publicId: "CS-X",
          clientName: "Acme",
          projectTitle: "X",
          relatedServiceIds: [FAKE_SERVICE_ID],
        },
        "actor-1",
      );

      expect(services.existingServiceIds).toHaveBeenCalledWith([FAKE_SERVICE_ID]);
      expect(caseStudies.create).toHaveBeenCalled();
    });

    it("rejects relatedServiceIds that don't resolve to real services", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      services.existingServiceIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          {
            publicId: "CS-X",
            clientName: "Acme",
            projectTitle: "X",
            relatedServiceIds: [FAKE_SERVICE_ID],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(caseStudies.create).not.toHaveBeenCalled();
    });

    it("treats a malformed (non-UUID) relatedServiceIds entry as not-found, without querying it", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);

      await expect(
        svc.create(
          {
            publicId: "CS-X",
            clientName: "Acme",
            projectTitle: "X",
            relatedServiceIds: ["not-a-uuid"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(services.existingServiceIds).not.toHaveBeenCalled();
    });

    it("validates relatedClaimIds against the real proof_claims table (D2)", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      caseStudies.create.mockResolvedValue(caseStudy());
      claims.existingClaimIds.mockResolvedValue(new Set([FAKE_CLAIM_ID]));

      await svc.create(
        {
          publicId: "CS-X",
          clientName: "Acme",
          projectTitle: "X",
          relatedClaimIds: [FAKE_CLAIM_ID],
        },
        "actor-1",
      );

      expect(claims.existingClaimIds).toHaveBeenCalledWith([FAKE_CLAIM_ID]);
      expect(caseStudies.create).toHaveBeenCalled();
    });

    it("rejects relatedClaimIds that don't resolve to real claims", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      claims.existingClaimIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          {
            publicId: "CS-X",
            clientName: "Acme",
            projectTitle: "X",
            relatedClaimIds: [FAKE_CLAIM_ID],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("validates assignedReviewerUserId exists", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      usersService.assertUserExists.mockRejectedValue(new BadRequestException("nope"));

      await expect(
        svc.create(
          {
            publicId: "CS-X",
            clientName: "Acme",
            projectTitle: "X",
            assignedReviewerUserId: FAKE_USER_ID,
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(caseStudies.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      caseStudies.findByPublicId.mockResolvedValue(null);
      caseStudies.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "CS-RACE", clientName: "Acme", projectTitle: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException for a missing case study", async () => {
      caseStudies.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("rejects editing an archived case study (D8 terminal-state guard)", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "archived" }));

      await expect(svc.update("cs-1", { clientName: "New Name" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(caseStudies.update).not.toHaveBeenCalled();
    });

    it("allows editing an unpublished case study — only archived is terminal (D8)", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "unpublished" }));
      caseStudies.update.mockResolvedValue(caseStudy({ status: "unpublished", clientName: "New" }));

      const result = await svc.update("cs-1", { clientName: "New" }, "actor-1");
      expect(result.clientName).toBe("New");
      expect(caseStudies.update).toHaveBeenCalled();
    });

    it("skips re-sanitizing an unchanged rich-text field", async () => {
      const current = caseStudy({ challenge: "<p>Same</p>" });
      caseStudies.findById.mockResolvedValue(current);
      caseStudies.update.mockResolvedValue(current);

      await svc.update("cs-1", { challenge: "<p>Same</p>" }, "actor-1");

      const [, writtenPatch] = caseStudies.update.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(writtenPatch.challenge).toBe("<p>Same</p>");
    });
  });

  describe("changeStatus", () => {
    it("no-ops when the requested status equals the current status", async () => {
      const current = caseStudy({ status: "draft" });
      caseStudies.findById.mockResolvedValue(current);

      const result = await svc.changeStatus("cs-1", { status: "draft" }, "actor-1");
      expect(result).toEqual(current);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(caseStudies.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects an invalid transition", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "intake" }));

      await expect(svc.changeStatus("cs-1", { status: "published" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("performs a valid submit transition and checks the submit action", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "intake" }));
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "upload" }),
      });

      const result = await svc.changeStatus("cs-1", { status: "upload" }, "actor-1");

      expect(result.status).toBe("upload");
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "case_studies",
        "submit",
      );
    });

    it("blocks internal_approval -> client_approval when clientApprovalRequired is false", async () => {
      caseStudies.findById.mockResolvedValue(
        caseStudy({ status: "internal_approval", clientApprovalRequired: false }),
      );

      await expect(
        svc.changeStatus("cs-1", { status: "client_approval" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(caseStudies.updateStatus).not.toHaveBeenCalled();
    });

    it("blocks internal_approval -> scheduled when clientApprovalRequired is true", async () => {
      caseStudies.findById.mockResolvedValue(
        caseStudy({ status: "internal_approval", clientApprovalRequired: true }),
      );

      await expect(svc.changeStatus("cs-1", { status: "scheduled" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("allows internal_approval -> client_approval when clientApprovalRequired is true, and records a case_study_approvals row", async () => {
      caseStudies.findById.mockResolvedValue(
        caseStudy({ status: "internal_approval", clientApprovalRequired: true }),
      );
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "client_approval" }),
      });

      await svc.changeStatus(
        "cs-1",
        { status: "client_approval", notes: "<p>Looks good</p>" },
        "actor-1",
      );

      expect(caseStudyApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          caseStudyId: "cs-1",
          approvalType: "internal",
          decision: "approved",
          decidedByUserId: "actor-1",
        }),
        { fakeTransaction: true },
      );
    });

    it("allows internal_approval -> scheduled when clientApprovalRequired is false", async () => {
      caseStudies.findById.mockResolvedValue(
        caseStudy({ status: "internal_approval", clientApprovalRequired: false }),
      );
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "scheduled" }),
      });

      const result = await svc.changeStatus("cs-1", { status: "scheduled" }, "actor-1");
      expect(result.status).toBe("scheduled");
    });

    it("records a revision_requested decision on an approval-stage -> missing_information transition", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "client_approval" }));
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "missing_information" }),
      });

      await svc.changeStatus("cs-1", { status: "missing_information" }, "actor-1");

      expect(caseStudyApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({ approvalType: "client", decision: "revision_requested" }),
        expect.anything(),
      );
    });

    it("records a rejected decision on an approval-stage -> archived transition", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "internal_approval" }));
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "archived" }),
      });

      await svc.changeStatus("cs-1", { status: "archived" }, "actor-1");

      expect(caseStudyApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({ approvalType: "internal", decision: "rejected" }),
        expect.anything(),
      );
    });

    it("does not record a case_study_approvals row for a non-approval-stage transition", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "intake" }));
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "upload" }),
      });

      await svc.changeStatus("cs-1", { status: "upload" }, "actor-1");

      expect(caseStudyApprovals.create).not.toHaveBeenCalled();
    });

    it("requires a non-empty unpublishReason on published -> unpublished (D5)", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));

      await expect(svc.changeStatus("cs-1", { status: "unpublished" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(caseStudies.updateStatus).not.toHaveBeenCalled();
    });

    it("accepts published -> unpublished when unpublishReason is provided, and stamps it", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "unpublished", unpublishReason: "Client requested pause" }),
      });

      const result = await svc.changeStatus(
        "cs-1",
        { status: "unpublished", unpublishReason: "Client requested pause" },
        "actor-1",
      );

      expect(result.unpublishReason).toBe("Client requested pause");
      expect(caseStudies.updateStatus).toHaveBeenCalledWith(
        "cs-1",
        "published",
        "unpublished",
        "actor-1",
        expect.objectContaining({ unpublishReason: "Client requested pause" }),
        expect.anything(),
      );
    });

    it("stamps publishedAt on scheduled -> published", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "scheduled" }));
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "published" }),
      });

      await svc.changeStatus("cs-1", { status: "published" }, "actor-1");

      expect(caseStudies.updateStatus).toHaveBeenCalledWith(
        "cs-1",
        "scheduled",
        "published",
        "actor-1",
        expect.objectContaining({ publishedAt: expect.any(Date) }),
        expect.anything(),
      );
    });

    // Code-review fix: publishedAt must be a "stamp once, never overwrite" write, not a plain
    // unconditional assignment — a republish (unpublished -> published) must preserve the
    // record's original first-publish date, not silently overwrite it with the new decision time.
    it("preserves the original publishedAt on a republish (unpublished -> published)", async () => {
      const originalPublishedAt = "2026-01-01T00:00:00.000Z";
      caseStudies.findById.mockResolvedValue(
        caseStudy({ status: "unpublished", publishedAt: originalPublishedAt }),
      );
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "published", publishedAt: originalPublishedAt }),
      });

      await svc.changeStatus("cs-1", { status: "published" }, "actor-1");

      expect(caseStudies.updateStatus).toHaveBeenCalledWith(
        "cs-1",
        "unpublished",
        "published",
        "actor-1",
        expect.objectContaining({ publishedAt: new Date(originalPublishedAt) }),
        expect.anything(),
      );
    });

    // Code-review fix: unpublishReason must be cleared on every transition back to `published` —
    // it previously stayed stale after a republish, since only the published -> unpublished
    // transition ever set it and nothing ever reset it.
    it("clears unpublishReason on a republish (unpublished -> published)", async () => {
      caseStudies.findById.mockResolvedValue(
        caseStudy({ status: "unpublished", unpublishReason: "Client requested a pause" }),
      );
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: caseStudy({ status: "published", unpublishReason: null }),
      });

      await svc.changeStatus("cs-1", { status: "published" }, "actor-1");

      expect(caseStudies.updateStatus).toHaveBeenCalledWith(
        "cs-1",
        "unpublished",
        "published",
        "actor-1",
        expect.objectContaining({ unpublishReason: null }),
        expect.anything(),
      );
    });

    it("throws NotFoundException when the CAS write reports not_found", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "intake" }));
      caseStudies.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeStatus("cs-1", { status: "upload" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the CAS write reports a concurrent change", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "intake" }));
      caseStudies.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: caseStudy({ status: "draft" }),
      });

      await expect(svc.changeStatus("cs-1", { status: "upload" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("denies the transition when the caller lacks the required RBAC action", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "intake" }));
      authorizationService.assertAllowed.mockRejectedValue(new Error("Forbidden"));

      await expect(svc.changeStatus("cs-1", { status: "upload" }, "actor-1")).rejects.toThrow();
      expect(caseStudies.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("listApprovals", () => {
    it("404s for a missing case study before listing", async () => {
      caseStudies.findById.mockResolvedValue(null);
      await expect(svc.listApprovals("missing")).rejects.toThrow(NotFoundException);
    });

    it("lists approvals for an existing case study", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy());
      caseStudyApprovals.listByCaseStudy.mockResolvedValue([]);

      await svc.listApprovals("cs-1");
      expect(caseStudyApprovals.listByCaseStudy).toHaveBeenCalledWith("cs-1");
    });
  });
});
