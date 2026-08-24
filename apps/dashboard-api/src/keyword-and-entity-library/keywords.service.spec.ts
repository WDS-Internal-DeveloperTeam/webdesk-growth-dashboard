import type { KeywordEntity, KeywordRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { ProjectService } from "../projects/project.service.js";
import { KeywordsService } from "./keywords.service.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const FAKE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `KeywordsService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly. */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function keyword(overrides: Partial<KeywordEntity> = {}): KeywordEntity {
  return {
    id: "keyword-1",
    projectId: FAKE_PROJECT_ID,
    publicId: "KW-SEO-TOOLS",
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

describe("KeywordsService", () => {
  let keywords: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: KeywordsService;

  beforeEach(() => {
    keywords = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    projects = { findById: vi.fn().mockResolvedValue({ id: FAKE_PROJECT_ID }) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new KeywordsService(
      keywords as unknown as KeywordRepository,
      projects as unknown as ProjectService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a keyword after validating the publicId is free and the project exists", async () => {
      keywords.findByPublicId.mockResolvedValue(null);
      keywords.create.mockResolvedValue(keyword());

      const result = await svc.create(
        FAKE_PROJECT_ID,
        { publicId: "KW-SEO-TOOLS", queryText: "best seo tools" },
        "actor-1",
      );

      expect(result).toEqual(keyword());
      expect(projects.findById).toHaveBeenCalledWith(FAKE_PROJECT_ID);
      expect(keywords.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: FAKE_PROJECT_ID, publicId: "KW-SEO-TOOLS" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          entityType: "keyword",
          projectId: FAKE_PROJECT_ID,
        }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      keywords.findByPublicId.mockResolvedValue(keyword());

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "KW-SEO-TOOLS", queryText: "x" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(keywords.create).not.toHaveBeenCalled();
    });

    it("propagates a NotFoundException when the project does not exist, without creating", async () => {
      keywords.findByPublicId.mockResolvedValue(null);
      projects.findById.mockRejectedValue(new NotFoundException("Project not found"));

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "KW-X", queryText: "x" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(keywords.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      keywords.findByPublicId.mockResolvedValue(null);
      keywords.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "KW-RACE", queryText: "x" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      keywords.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      keywords.create.mockRejectedValue(dbError);

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "KW-X", queryText: "x" }, "actor-1"),
      ).rejects.toBe(dbError);
    });

    it("sanitizes cannibalizationNotes before writing, stripping a disallowed tag (dashboard-web UI build, 2026-08-24)", async () => {
      keywords.findByPublicId.mockResolvedValue(null);
      keywords.create.mockResolvedValue(keyword());

      await svc.create(
        FAKE_PROJECT_ID,
        {
          publicId: "KW-X",
          queryText: "best seo tools",
          cannibalizationNotes: "<script>alert(1)</script><p>Competes with /blog/seo-tools</p>",
        },
        "actor-1",
      );

      const [writtenInput] = keywords.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.cannibalizationNotes).toBe("<p>Competes with /blog/seo-tools</p>");
    });

    it("passes a null cannibalizationNotes through unchanged rather than coercing it into an empty string", async () => {
      keywords.findByPublicId.mockResolvedValue(null);
      keywords.create.mockResolvedValue(keyword());

      await svc.create(
        FAKE_PROJECT_ID,
        { publicId: "KW-X", queryText: "x", cannibalizationNotes: null },
        "actor-1",
      );

      const [writtenInput] = keywords.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.cannibalizationNotes).toBeNull();
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the keyword does not exist", async () => {
      keywords.findById.mockResolvedValue(null);
      await expect(svc.findById("missing", FAKE_PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it("returns the keyword when it exists and belongs to the given projectId", async () => {
      keywords.findById.mockResolvedValue(keyword());
      await expect(svc.findById("keyword-1", FAKE_PROJECT_ID)).resolves.toEqual(keyword());
    });

    it("throws NotFoundException (IDOR prevention) when the keyword belongs to a different project", async () => {
      keywords.findById.mockResolvedValue(keyword({ projectId: FAKE_PROJECT_ID }));
      await expect(
        svc.findById("keyword-1", "22222222-2222-4222-8222-222222222299"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      keywords.list.mockResolvedValue([keyword()]);
      const result = await svc.list({ projectId: FAKE_PROJECT_ID, approvalStatus: "draft" });
      expect(keywords.list).toHaveBeenCalledWith({
        projectId: FAKE_PROJECT_ID,
        approvalStatus: "draft",
      });
      expect(result).toEqual([keyword()]);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      keywords.findById.mockResolvedValue(keyword());
    });

    it("pre-fetches the keyword before updating, 404ing cleanly before any write is attempted", async () => {
      keywords.findById.mockResolvedValue(null);

      await expect(
        svc.update("missing", FAKE_PROJECT_ID, { queryText: "new" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(keywords.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException (IDOR prevention) when the keyword belongs to a different project", async () => {
      keywords.findById.mockResolvedValue(keyword({ projectId: FAKE_PROJECT_ID }));

      await expect(
        svc.update(
          "keyword-1",
          "22222222-2222-4222-8222-222222222299",
          { queryText: "new" },
          "actor-1",
        ),
      ).rejects.toThrow(NotFoundException);
      expect(keywords.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the repository update finds nothing to update (a TOCTOU race after a successful pre-fetch)", async () => {
      keywords.findById.mockResolvedValueOnce(keyword()).mockResolvedValueOnce(null);
      keywords.update.mockResolvedValue(null);

      await expect(
        svc.update("keyword-1", FAKE_PROJECT_ID, { queryText: "new" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(["archived", "superseded"] as const)(
      "rejects an edit to a %s keyword without writing",
      async (terminalStatus) => {
        keywords.findById.mockResolvedValue(
          keyword({ approvalStatus: terminalStatus, projectId: FAKE_PROJECT_ID }),
        );

        await expect(
          svc.update("keyword-1", FAKE_PROJECT_ID, { queryText: "new" }, "actor-1"),
        ).rejects.toThrow(BadRequestException);
        expect(keywords.update).not.toHaveBeenCalled();
      },
    );

    it("passes the keyword's own current approvalStatus as a CAS guard to the repository write", async () => {
      keywords.findById.mockResolvedValue(
        keyword({ approvalStatus: "draft", projectId: FAKE_PROJECT_ID }),
      );
      keywords.update.mockResolvedValue(keyword({ approvalStatus: "draft" }));

      await svc.update("keyword-1", FAKE_PROJECT_ID, { queryText: "new" }, "actor-1");

      expect(keywords.update).toHaveBeenCalledWith(
        "keyword-1",
        expect.objectContaining({ queryText: "new" }),
        "draft",
      );
    });

    it("throws ConflictException (not a silent success) when the CAS write loses a race against a concurrent changeApprovalStatus() transition", async () => {
      keywords.findById
        .mockResolvedValueOnce(keyword({ approvalStatus: "draft", projectId: FAKE_PROJECT_ID }))
        .mockResolvedValueOnce(keyword({ approvalStatus: "archived", projectId: FAKE_PROJECT_ID }));
      keywords.update.mockResolvedValue(null);

      await expect(
        svc.update("keyword-1", FAKE_PROJECT_ID, { queryText: "new" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("never accepts approvalStatus through the general update patch", async () => {
      keywords.update.mockResolvedValue(keyword({ queryText: "renamed" }));

      await svc.update("keyword-1", FAKE_PROJECT_ID, { queryText: "renamed" }, "actor-1");

      const [, patchArg] = keywords.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
    });

    it("returns the repository's updated entity and records an audit event", async () => {
      keywords.update.mockResolvedValue(keyword({ queryText: "renamed" }));

      const result = await svc.update(
        "keyword-1",
        FAKE_PROJECT_ID,
        { queryText: "renamed" },
        "actor-1",
      );

      expect(result.queryText).toBe("renamed");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "keyword" }),
      );
    });

    it("sanitizes a real (non-null) cannibalizationNotes value on update, stripping a disallowed tag (dashboard-web UI build, 2026-08-24)", async () => {
      keywords.findById.mockResolvedValue(
        keyword({
          approvalStatus: "draft",
          projectId: FAKE_PROJECT_ID,
          cannibalizationNotes: "old",
        }),
      );
      keywords.update.mockResolvedValue(keyword());

      await svc.update(
        "keyword-1",
        FAKE_PROJECT_ID,
        { cannibalizationNotes: "<script>alert(1)</script><p>Updated note</p>" },
        "actor-1",
      );

      const [, patchArg] = keywords.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg.cannibalizationNotes).toBe("<p>Updated note</p>");
    });

    it("skips re-sanitizing cannibalizationNotes when it's identical to the stored value", async () => {
      keywords.findById.mockResolvedValue(
        keyword({
          approvalStatus: "draft",
          projectId: FAKE_PROJECT_ID,
          cannibalizationNotes: "<p>Bold</p>",
        }),
      );
      keywords.update.mockResolvedValue(keyword());

      await svc.update(
        "keyword-1",
        FAKE_PROJECT_ID,
        { queryText: "renamed", cannibalizationNotes: "<p>Bold</p>" },
        "actor-1",
      );

      const [, patchArg] = keywords.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg.cannibalizationNotes).toBe("<p>Bold</p>");
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      keywords.findById.mockResolvedValue(keyword({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus(
        "keyword-1",
        FAKE_PROJECT_ID,
        "draft",
        "actor-1",
      );
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("throws NotFoundException (IDOR prevention) when the keyword belongs to a different project", async () => {
      keywords.findById.mockResolvedValue(
        keyword({ approvalStatus: "draft", projectId: FAKE_PROJECT_ID }),
      );

      await expect(
        svc.changeApprovalStatus(
          "keyword-1",
          "22222222-2222-4222-8222-222222222299",
          "submitted",
          "actor-1",
        ),
      ).rejects.toThrow(NotFoundException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      keywords.findById.mockResolvedValue(keyword({ approvalStatus: "draft" }));
      await expect(
        svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, "approved", "actor-1"),
      ).rejects.toThrow(BadRequestException);
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
      keywords.findById.mockResolvedValue(
        keyword({ approvalStatus: from, projectId: FAKE_PROJECT_ID }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      keywords.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: keyword({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, to, "actor-1");

      // Asserts the keyword's own projectId (the 4th positional arg) is threaded through — without
      // it, a caller holding only a project-scoped grant would be denied on every transition
      // (the identical gap Page Inventory's own code review found and fixed once already).
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "keyword_internal_links",
        action,
        FAKE_PROJECT_ID,
      );
    });

    it.each([
      ["submitted", "draft"],
      ["revision_requested", "draft"],
      ["rejected", "draft"],
    ] as const)(
      "requires the 'submit' action for %s -> draft (the submitter/editor drives the revise loop, not the approver)",
      async (from, to) => {
        keywords.findById.mockResolvedValue(
          keyword({ approvalStatus: from, projectId: FAKE_PROJECT_ID }),
        );
        authorizationService.assertAllowed.mockResolvedValue(undefined);
        keywords.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: keyword({ approvalStatus: to }),
        });

        await svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, to, "actor-1");

        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          "actor-1",
          "keyword_internal_links",
          "submit",
          FAKE_PROJECT_ID,
        );
      },
    );

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      keywords.findById.mockResolvedValueOnce(keyword({ approvalStatus: "archived" }));
      await expect(
        svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, "draft", "actor-1"),
      ).rejects.toThrow(BadRequestException);

      keywords.findById.mockResolvedValueOnce(keyword({ approvalStatus: "superseded" }));
      await expect(
        svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, "draft", "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      keywords.findById.mockResolvedValue(keyword({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: keyword_internal_links:approve"),
      );

      await expect(
        svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, "approved", "actor-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(keywords.updateStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      keywords.findById.mockResolvedValue(keyword({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      keywords.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(
        svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, "submitted", "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      keywords.findById.mockResolvedValue(keyword({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      keywords.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: keyword({ approvalStatus: "archived" }),
      });

      await expect(
        svc.changeApprovalStatus("keyword-1", FAKE_PROJECT_ID, "submitted", "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      keywords.findById.mockResolvedValue(keyword({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      keywords.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: keyword({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus(
        "keyword-1",
        FAKE_PROJECT_ID,
        "submitted",
        "actor-1",
      );

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
