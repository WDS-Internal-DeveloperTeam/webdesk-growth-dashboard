import type {
  PageEntity,
  PageRepository,
  PageUrlEntity,
  PageUrlRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { PageUrlsService } from "./page-urls.service.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const FAKE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function pageUrl(overrides: Partial<PageUrlEntity> = {}): PageUrlEntity {
  return {
    id: "url-1",
    pageId: "page-1",
    projectId: FAKE_PROJECT_ID,
    url: "https://example.com/home",
    isCanonical: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function page(overrides: Partial<PageEntity> = {}): PageEntity {
  return {
    id: "page-1",
    projectId: FAKE_PROJECT_ID,
    publicId: "PAGE-HOME",
    pageName: "Home",
    pageType: null,
    existingOrProposed: "proposed",
    indexStatus: "unknown",
    template: null,
    roadmapPhaseId: null,
    workflowStage: "draft",
    targetKeyword: null,
    designVersion: null,
    repositoryFiles: null,
    wordpressPageId: null,
    wordpressPostId: null,
    lastScanAt: null,
    lastDeploymentAt: null,
    classification: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("PageUrlsService", () => {
  let pageUrls: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByPage: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let pages: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: PageUrlsService;

  beforeEach(() => {
    pageUrls = {
      create: vi.fn(),
      findById: vi.fn(),
      listByPage: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    // Defaults to "the parent page exists" so tests that don't care about this check (the
    // majority) don't need to stub it themselves.
    pages = { findById: vi.fn().mockResolvedValue(page()) };
    auditService = { record: vi.fn() };
    svc = new PageUrlsService(
      pageUrls as unknown as PageUrlRepository,
      pages as unknown as PageRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a URL under the given page, denormalizing projectId from the parent page, and records an audit event", async () => {
      pageUrls.create.mockResolvedValue(pageUrl());

      const result = await svc.create("page-1", { url: "https://example.com/home" }, "actor-1");

      expect(result).toEqual(pageUrl());
      expect(pageUrls.create).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: "page-1", projectId: FAKE_PROJECT_ID }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          entityType: "page_url",
          projectId: FAKE_PROJECT_ID,
        }),
      );
    });

    it("throws NotFoundException (not a raw FK-constraint 500) when the parent page doesn't exist", async () => {
      pages.findById.mockResolvedValue(null);

      await expect(
        svc.create("missing-page", { url: "https://example.com/x" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(pageUrls.create).not.toHaveBeenCalled();
    });

    it("translates a partial-unique-index violation (duplicate canonical URL in the project) into a clean 400", async () => {
      pageUrls.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create("page-1", { url: "https://example.com/dup" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      const dbError = new Error("connection reset");
      pageUrls.create.mockRejectedValue(dbError);

      await expect(svc.create("page-1", { url: "https://example.com/x" }, "actor-1")).rejects.toBe(
        dbError,
      );
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the URL does not exist", async () => {
      pageUrls.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the URL when it exists", async () => {
      pageUrls.findById.mockResolvedValue(pageUrl());
      await expect(svc.findById("url-1")).resolves.toEqual(pageUrl());
    });
  });

  describe("listByPage", () => {
    it("delegates straight through to the repository", async () => {
      pageUrls.listByPage.mockResolvedValue([pageUrl()]);
      const result = await svc.listByPage("page-1");
      expect(pageUrls.listByPage).toHaveBeenCalledWith("page-1");
      expect(result).toEqual([pageUrl()]);
    });
  });

  describe("update", () => {
    it("updates a URL scoped to its page and records an audit event", async () => {
      pageUrls.update.mockResolvedValue(pageUrl({ url: "https://example.com/revised" }));

      const result = await svc.update(
        "url-1",
        "page-1",
        { url: "https://example.com/revised" },
        "actor-1",
      );

      expect(result.url).toBe("https://example.com/revised");
      expect(pageUrls.update).toHaveBeenCalledWith("url-1", "page-1", {
        url: "https://example.com/revised",
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "page_url" }),
      );
    });

    it("throws NotFoundException when the repository reports nothing was updated (wrong page or missing id)", async () => {
      pageUrls.update.mockResolvedValue(null);

      await expect(
        svc.update("url-1", "different-page", { url: "https://example.com/x" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("translates a partial-unique-index violation on update into a clean 400", async () => {
      pageUrls.update.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.update("url-1", "page-1", { url: "https://example.com/dup" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    it("removes a URL belonging to the given page and records an audit event", async () => {
      pageUrls.findById.mockResolvedValue(pageUrl({ pageId: "page-1" }));
      pageUrls.remove.mockResolvedValue(true);

      await svc.remove("url-1", "page-1", "actor-1");

      expect(pageUrls.remove).toHaveBeenCalledWith("url-1", "page-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "page_url" }),
      );
    });

    it("throws NotFoundException (IDOR prevention) when the URL belongs to a different page", async () => {
      pageUrls.findById.mockResolvedValue(pageUrl({ pageId: "page-1" }));

      await expect(svc.remove("url-1", "different-page", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(pageUrls.remove).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the URL does not exist at all", async () => {
      pageUrls.findById.mockResolvedValue(null);

      await expect(svc.remove("missing", "page-1", "actor-1")).rejects.toThrow(NotFoundException);
    });
  });
});
