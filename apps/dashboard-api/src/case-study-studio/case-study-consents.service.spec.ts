import type {
  CaseStudyConsentEntity,
  CaseStudyConsentRepository,
  CaseStudyEntity,
  CaseStudyRepository,
} from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { CaseStudyConsentsService } from "./case-study-consents.service.js";

const NOW = new Date("2026-08-31T00:00:00.000Z");

function consent(overrides: Partial<CaseStudyConsentEntity> = {}): CaseStudyConsentEntity {
  return {
    id: "csc-1",
    caseStudyId: "cs-1",
    consentType: "client_publication",
    consentEvidenceReference: null,
    grantedBy: null,
    grantedAt: null,
    notes: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function caseStudyStub(overrides: Partial<CaseStudyEntity> = {}): CaseStudyEntity {
  return { id: "cs-1", ...overrides } as CaseStudyEntity;
}

describe("CaseStudyConsentsService", () => {
  let caseStudyConsents: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByCaseStudy: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let caseStudies: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: CaseStudyConsentsService;

  beforeEach(() => {
    caseStudyConsents = {
      create: vi.fn(),
      findById: vi.fn(),
      listByCaseStudy: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    caseStudies = { findById: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new CaseStudyConsentsService(
      caseStudyConsents as unknown as CaseStudyConsentRepository,
      caseStudies as unknown as CaseStudyRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("404s when the parent case study doesn't exist", async () => {
      caseStudies.findById.mockResolvedValue(null);

      await expect(
        svc.create("missing-cs", { consentType: "testimonial" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(caseStudyConsents.create).not.toHaveBeenCalled();
    });

    it("creates a consent record and converts a datetime string to a Date for the repository", async () => {
      caseStudies.findById.mockResolvedValue(caseStudyStub());
      caseStudyConsents.create.mockResolvedValue(consent());

      await svc.create(
        "cs-1",
        { consentType: "client_publication", grantedAt: "2026-08-30T12:00:00.000Z" },
        "actor-1",
      );

      const [writtenInput] = caseStudyConsents.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.grantedAt).toBeInstanceOf(Date);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "case_study_consent" }),
      );
    });
  });

  describe("update / remove (IDOR scoping)", () => {
    it("404s update() when caseStudyConsents.update() reports no match", async () => {
      caseStudyConsents.update.mockResolvedValue(null);

      await expect(svc.update("csc-1", "wrong-cs", { notes: "x" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("404s remove() when the consent belongs to a different case study", async () => {
      caseStudyConsents.findById.mockResolvedValue(consent({ caseStudyId: "other-cs" }));

      await expect(svc.remove("csc-1", "cs-1", "actor-1")).rejects.toThrow(NotFoundException);
      expect(caseStudyConsents.remove).not.toHaveBeenCalled();
    });

    it("removes a real consent record scoped correctly", async () => {
      caseStudyConsents.findById.mockResolvedValue(consent({ caseStudyId: "cs-1" }));
      caseStudyConsents.remove.mockResolvedValue(true);

      await svc.remove("csc-1", "cs-1", "actor-1");

      expect(caseStudyConsents.remove).toHaveBeenCalledWith("csc-1", "cs-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "case_study_consent" }),
      );
    });
  });
});
