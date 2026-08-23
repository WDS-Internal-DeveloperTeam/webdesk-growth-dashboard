import type {
  KeywordEntity,
  PageKeywordAssignmentEntity,
  PageKeywordAssignmentRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { PagesService } from "../page-inventory/pages.service.js";
import type { KeywordsService } from "./keywords.service.js";
import { PageKeywordAssignmentsService } from "./page-keyword-assignments.service.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const FAKE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FAKE_PAGE_ID = "33333333-3333-4333-8333-333333333333";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function keyword(overrides: Partial<KeywordEntity> = {}): KeywordEntity {
  return {
    id: "keyword-1",
    projectId: FAKE_PROJECT_ID,
    publicId: "KW-1",
    queryText: "best seo tools",
    keywordType: null,
    intent: null,
    funnelStage: null,
    country: null,
    searchVolume: null,
    difficultyScore: null,
    source: null,
    researchDate: null,
    cannibalizationNotes: null,
    confidence: null,
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function assignment(
  overrides: Partial<PageKeywordAssignmentEntity> = {},
): PageKeywordAssignmentEntity {
  return {
    id: "assignment-1",
    keywordId: "keyword-1",
    pageId: FAKE_PAGE_ID,
    assignmentNote: null,
    createdBy: "actor-1",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("PageKeywordAssignmentsService", () => {
  let assignments: {
    create: ReturnType<typeof vi.fn>;
    listForKeyword: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let keywords: { findById: ReturnType<typeof vi.fn> };
  let pages: { existsInProject: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: PageKeywordAssignmentsService;

  beforeEach(() => {
    assignments = { create: vi.fn(), listForKeyword: vi.fn(), remove: vi.fn() };
    keywords = { findById: vi.fn().mockResolvedValue(keyword()) };
    pages = { existsInProject: vi.fn().mockResolvedValue(true) };
    auditService = { record: vi.fn() };
    svc = new PageKeywordAssignmentsService(
      assignments as unknown as PageKeywordAssignmentRepository,
      keywords as unknown as KeywordsService,
      pages as unknown as PagesService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("confirms the parent keyword exists in the project before creating", async () => {
      assignments.create.mockResolvedValue(assignment());

      await svc.create("keyword-1", FAKE_PROJECT_ID, { pageId: FAKE_PAGE_ID }, "actor-1");

      expect(keywords.findById).toHaveBeenCalledWith("keyword-1", FAKE_PROJECT_ID);
    });

    it("validates pageId against Page Inventory's own PagesService.existsInProject(), scoped to the project", async () => {
      assignments.create.mockResolvedValue(assignment());

      await svc.create("keyword-1", FAKE_PROJECT_ID, { pageId: FAKE_PAGE_ID }, "actor-1");

      expect(pages.existsInProject).toHaveBeenCalledWith(FAKE_PAGE_ID, FAKE_PROJECT_ID);
    });

    it("rejects a pageId that doesn't resolve to a real page in the same project", async () => {
      pages.existsInProject.mockResolvedValue(false);

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, { pageId: FAKE_PAGE_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(assignments.create).not.toHaveBeenCalled();
    });

    it("creates the assignment and records an audit event scoped to the keyword's project", async () => {
      assignments.create.mockResolvedValue(assignment());

      const result = await svc.create(
        "keyword-1",
        FAKE_PROJECT_ID,
        { pageId: FAKE_PAGE_ID, assignmentNote: "primary target" },
        "actor-1",
      );

      expect(result).toEqual(assignment());
      expect(assignments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          keywordId: "keyword-1",
          pageId: FAKE_PAGE_ID,
          assignmentNote: "primary target",
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          entityType: "page_keyword_assignment",
          projectId: FAKE_PROJECT_ID,
        }),
      );
    });

    it("translates a duplicate assignment into a clean 400, not a raw 500", async () => {
      assignments.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, { pageId: FAKE_PAGE_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error unchanged", async () => {
      const dbError = new Error("connection reset");
      assignments.create.mockRejectedValue(dbError);

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, { pageId: FAKE_PAGE_ID }, "actor-1"),
      ).rejects.toBe(dbError);
    });

    it("propagates NotFoundException (IDOR prevention) when the parent keyword is not in this project", async () => {
      keywords.findById.mockRejectedValue(new NotFoundException("Keyword not found"));

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, { pageId: FAKE_PAGE_ID }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(assignments.create).not.toHaveBeenCalled();
    });
  });

  describe("listForKeyword", () => {
    it("confirms the parent keyword exists in the project before listing", async () => {
      assignments.listForKeyword.mockResolvedValue([assignment()]);

      const result = await svc.listForKeyword("keyword-1", FAKE_PROJECT_ID);

      expect(keywords.findById).toHaveBeenCalledWith("keyword-1", FAKE_PROJECT_ID);
      expect(result).toEqual([assignment()]);
    });
  });

  describe("remove", () => {
    it("removes the assignment, scoped to keywordId (IDOR prevention), and records an audit event", async () => {
      assignments.remove.mockResolvedValue(true);

      await svc.remove("assignment-1", "keyword-1", FAKE_PROJECT_ID, "actor-1");

      expect(assignments.remove).toHaveBeenCalledWith("assignment-1", "keyword-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "page_keyword_assignment" }),
      );
    });

    it("throws NotFoundException when nothing was removed", async () => {
      assignments.remove.mockResolvedValue(false);

      await expect(
        svc.remove("assignment-1", "keyword-1", FAKE_PROJECT_ID, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
