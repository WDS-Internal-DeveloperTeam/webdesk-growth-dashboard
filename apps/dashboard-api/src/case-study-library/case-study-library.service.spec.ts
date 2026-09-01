import type {
  CaseStudyEntity,
  CaseStudyLibraryRecordEntity,
  CaseStudyLibraryRecordRepository,
} from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { CaseStudiesService } from "../case-study-studio/case-studies.service.js";
import type { PagesService } from "../page-inventory/pages.service.js";
import { CaseStudyLibraryService } from "./case-study-library.service.js";

const NOW = new Date("2026-09-01T00:00:00.000Z");
const FAKE_PAGE_ID = "11111111-1111-4111-8111-111111111111";

function uniqueConstraintError(fields: Record<string, unknown> = {}): Error & {
  fields: Record<string, unknown>;
} {
  const error = new Error("Validation error") as Error & { fields: Record<string, unknown> };
  error.name = "SequelizeUniqueConstraintError";
  error.fields = fields;
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
    status: "published",
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

function libraryRecord(
  overrides: Partial<CaseStudyLibraryRecordEntity> = {},
): CaseStudyLibraryRecordEntity {
  return {
    id: "csl-1",
    publicId: "CSL-ACME-001",
    caseStudyId: "cs-1",
    relatedPageIds: [],
    technologies: [],
    testimonials: [],
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("CaseStudyLibraryService", () => {
  let records: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByCaseStudyId: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let caseStudies: { findById: ReturnType<typeof vi.fn> };
  let pages: { existingPageIds: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: CaseStudyLibraryService;

  beforeEach(() => {
    records = {
      create: vi.fn(),
      findById: vi.fn(),
      findByCaseStudyId: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
    };
    caseStudies = { findById: vi.fn() };
    pages = { existingPageIds: vi.fn().mockResolvedValue(new Set()) };
    auditService = { record: vi.fn() };
    svc = new CaseStudyLibraryService(
      records as unknown as CaseStudyLibraryRecordRepository,
      caseStudies as unknown as CaseStudiesService,
      pages as unknown as PagesService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a library record once the parent case study is published, joining the parent into the response", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(libraryRecord());

      const result = await svc.create({ publicId: "CSL-ACME-001", caseStudyId: "cs-1" }, "actor-1");

      expect(result).toEqual({ ...libraryRecord(), caseStudy: caseStudy({ status: "published" }) });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "case_study_library_record" }),
      );
    });

    it.each(["published", "unpublished", "archived"] as const)(
      "accepts creation when the parent case study status is %s",
      async (status) => {
        caseStudies.findById.mockResolvedValue(caseStudy({ status }));
        records.findByCaseStudyId.mockResolvedValue(null);
        records.findByPublicId.mockResolvedValue(null);
        records.create.mockResolvedValue(libraryRecord());

        await expect(
          svc.create({ publicId: "CSL-1", caseStudyId: "cs-1" }, "actor-1"),
        ).resolves.toBeDefined();
      },
    );

    it.each([
      "intake",
      "upload",
      "completeness_review",
      "ready_for_claude",
      "missing_information",
      "draft",
      "search_review",
      "fact_confidentiality_review",
      "internal_approval",
      "client_approval",
      "scheduled",
    ] as const)(
      "rejects creation with a clean 400 when the parent case study status is %s (D5)",
      async (status) => {
        caseStudies.findById.mockResolvedValue(caseStudy({ status }));
        records.findByCaseStudyId.mockResolvedValue(null);
        records.findByPublicId.mockResolvedValue(null);

        await expect(
          svc.create({ publicId: "CSL-1", caseStudyId: "cs-1" }, "actor-1"),
        ).rejects.toThrow(BadRequestException);
        expect(records.create).not.toHaveBeenCalled();
      },
    );

    it("rejects with 409 when a library record already exists for the case study (D1)", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(libraryRecord());
      records.findByPublicId.mockResolvedValue(null);

      await expect(
        svc.create({ publicId: "CSL-2", caseStudyId: "cs-1" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate publicId with 400", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(libraryRecord());

      await expect(
        svc.create({ publicId: "CSL-ACME-001", caseStudyId: "cs-1" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("converts a publicId TOCTOU unique-constraint race into a clean 400, matching the deterministic pre-check's own status code", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(null);
      records.create.mockRejectedValue(uniqueConstraintError({ public_id: "CSL-ACME-001" }));

      await expect(
        svc.create({ publicId: "CSL-ACME-001", caseStudyId: "cs-1" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("converts a caseStudyId TOCTOU unique-constraint race into a 400 naming the actual collision, not the publicId one", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(null);
      records.create.mockRejectedValue(uniqueConstraintError({ case_study_id: "cs-1" }));

      await expect(
        svc.create({ publicId: "CSL-ACME-001", caseStudyId: "cs-1" }, "actor-1"),
      ).rejects.toThrow(/library record already exists for case study cs-1/);
    });

    it("propagates a NotFoundException when the parent case study doesn't exist", async () => {
      caseStudies.findById.mockRejectedValue(new NotFoundException("Case study not found"));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(null);

      await expect(
        svc.create({ publicId: "CSL-1", caseStudyId: "does-not-exist" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("validates relatedPageIds against real pages, rejecting a missing one with 400", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(null);
      pages.existingPageIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          { publicId: "CSL-1", caseStudyId: "cs-1", relatedPageIds: [FAKE_PAGE_ID] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("skips the page-existence query entirely for a malformed (non-UUID) id, rejecting it directly", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(null);

      await expect(
        svc.create(
          { publicId: "CSL-1", caseStudyId: "cs-1", relatedPageIds: ["not-a-uuid"] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(pages.existingPageIds).not.toHaveBeenCalled();
    });

    it("normalizes a testimonial's omitted author/role to null before writing", async () => {
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "published" }));
      records.findByCaseStudyId.mockResolvedValue(null);
      records.findByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(libraryRecord());

      await svc.create(
        {
          publicId: "CSL-1",
          caseStudyId: "cs-1",
          testimonials: [{ quote: "Great!" }],
        },
        "actor-1",
      );

      expect(records.create).toHaveBeenCalledWith(
        expect.objectContaining({
          testimonials: [{ quote: "Great!", author: null, role: null }],
        }),
      );
    });
  });

  describe("findById", () => {
    it("returns the record joined with its parent case study", async () => {
      records.findById.mockResolvedValue(libraryRecord());
      caseStudies.findById.mockResolvedValue(caseStudy());

      const result = await svc.findById("csl-1");
      expect(result.caseStudy).toEqual(caseStudy());
    });

    it("throws NotFoundException for a missing record", async () => {
      records.findById.mockResolvedValue(null);
      await expect(svc.findById("does-not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("resolves each record's parent case study, degrading a failed lookup to null (failure isolation)", async () => {
      records.list.mockResolvedValue([
        libraryRecord({ id: "csl-1", caseStudyId: "cs-1" }),
        libraryRecord({ id: "csl-2", caseStudyId: "cs-missing" }),
      ]);
      caseStudies.findById.mockImplementation(async (id: string) => {
        if (id === "cs-missing") {
          throw new NotFoundException("Case study not found");
        }
        return caseStudy({ id });
      });

      const result = await svc.list({});
      expect(result[0]?.caseStudy?.id).toBe("cs-1");
      expect(result[1]?.caseStudy).toBeNull();
    });
  });

  describe("update", () => {
    it("edits content fields and audits the change", async () => {
      records.findById.mockResolvedValue(libraryRecord());
      records.update.mockResolvedValue(libraryRecord({ technologies: ["React"] }));
      caseStudies.findById.mockResolvedValue(caseStudy());

      const result = await svc.update("csl-1", { technologies: ["React"] }, "actor-1");
      expect(result.technologies).toEqual(["React"]);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "case_study_library_record" }),
      );
    });

    it("throws NotFoundException for a missing record", async () => {
      records.findById.mockResolvedValue(null);
      await expect(
        svc.update("does-not-exist", { technologies: ["x"] }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(records.update).not.toHaveBeenCalled();
    });

    it("validates relatedPageIds on update too, rejecting a missing one with 400", async () => {
      records.findById.mockResolvedValue(libraryRecord());
      pages.existingPageIds.mockResolvedValue(new Set());

      await expect(
        svc.update("csl-1", { relatedPageIds: [FAKE_PAGE_ID] }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(records.update).not.toHaveBeenCalled();
    });

    it("rejects an edit with 400 once the parent case study is archived, matching CaseStudiesService's own terminal-state guard", async () => {
      records.findById.mockResolvedValue(libraryRecord());
      caseStudies.findById.mockResolvedValue(caseStudy({ status: "archived" }));

      await expect(svc.update("csl-1", { technologies: ["React"] }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(records.update).not.toHaveBeenCalled();
    });
  });
});
