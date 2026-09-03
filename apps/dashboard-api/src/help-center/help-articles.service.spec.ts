import type { HelpArticleEntity, HelpArticleRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { HelpArticlesService } from "./help-articles.service.js";

const NOW = new Date("2026-09-03T00:00:00.000Z");

function article(overrides: Partial<HelpArticleEntity> = {}): HelpArticleEntity {
  return {
    id: "article-1",
    category: "onboarding",
    title: "Getting started",
    content: "<p>Welcome</p>",
    isPublished: false,
    publishedAt: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("HelpArticlesService", () => {
  let articles: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: HelpArticlesService;

  beforeEach(() => {
    articles = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
    };
    auditService = { record: vi.fn() };
    svc = new HelpArticlesService(
      articles as unknown as HelpArticleRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("sanitizes content before storing it", async () => {
      articles.create.mockResolvedValue(article());

      await svc.create(
        {
          category: "faq",
          title: "FAQ",
          content: "<p>Safe</p><script>alert(1)</script>",
        },
        "actor-1",
      );

      const passedContent = articles.create.mock.calls[0]![0].content as string;
      expect(passedContent).not.toContain("<script>");
      expect(passedContent).toContain("<p>Safe</p>");
    });

    it("does not default isPublished itself, leaving that to the repository", async () => {
      articles.create.mockResolvedValue(article());

      await svc.create({ category: "onboarding", title: "T", content: "<p>C</p>" }, "actor-1");

      const passedInput = articles.create.mock.calls[0]![0] as { isPublished?: boolean };
      expect(passedInput.isPublished).toBeUndefined();
    });

    it("records a data_change audit event", async () => {
      articles.create.mockResolvedValue(article());

      await svc.create({ category: "onboarding", title: "T", content: "<p>C</p>" }, "actor-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the article does not exist", async () => {
      articles.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the underlying update finds no row, without pre-fetching", async () => {
      articles.update.mockResolvedValue(null);

      await expect(svc.update("article-1", { title: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(articles.findById).not.toHaveBeenCalled();
    });

    it("sanitizes content whenever it is provided in the patch", async () => {
      articles.update.mockResolvedValue(article({ content: "<p>New</p>" }));

      await svc.update("article-1", { content: "<p>New</p><script>x</script>" }, "actor-1");

      const patch = articles.update.mock.calls[0]![1] as Record<string, unknown>;
      expect(patch.content).toBe("<p>New</p>");
    });

    it("leaves content untouched (undefined) when the patch omits it", async () => {
      articles.update.mockResolvedValue(article());

      await svc.update("article-1", { title: "New" }, "actor-1");

      const patch = articles.update.mock.calls[0]![1] as Record<string, unknown>;
      expect(patch.content).toBeUndefined();
    });

    it("records a publish audit event whenever the patch requests isPublished: true", async () => {
      articles.update.mockResolvedValue(article({ isPublished: true }));

      await svc.update("article-1", { isPublished: true }, "actor-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "publish", action: "publish" }),
      );
    });

    it("records an unpublish audit event whenever the patch requests isPublished: false", async () => {
      articles.update.mockResolvedValue(article({ isPublished: false }));

      await svc.update("article-1", { isPublished: false }, "actor-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "unpublish", action: "unpublish" }),
      );
    });

    it("records a plain data_change audit event for an ordinary content edit", async () => {
      articles.update.mockResolvedValue(article({ title: "New" }));

      await svc.update("article-1", { title: "New" }, "actor-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "update" }),
      );
    });

    it("records the real patch as the audit afterState, not just isPublished", async () => {
      articles.update.mockResolvedValue(article({ title: "New" }));

      await svc.update("article-1", { title: "New" }, "actor-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ afterState: { title: "New" } }),
      );
    });

    it("does not throw when the audit write itself fails", async () => {
      articles.update.mockResolvedValue(article({ title: "New" }));
      auditService.record.mockRejectedValue(new Error("audit down"));

      await expect(svc.update("article-1", { title: "New" }, "actor-1")).resolves.toBeDefined();
    });
  });
});
