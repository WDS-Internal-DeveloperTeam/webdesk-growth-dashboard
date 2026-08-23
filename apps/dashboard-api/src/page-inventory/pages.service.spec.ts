import type { PageEntity, PageRepository } from "@webdesk/database";
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
import type { RoadmapItemsService } from "../projects/roadmap-items.service.js";
import { PagesService } from "./pages.service.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const FAKE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FAKE_ROADMAP_PHASE_ID = "22222222-2222-4222-8222-222222222222";

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `PagesService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
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

describe("PagesService", () => {
  let pages: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let roadmapItems: { existsInProject: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: PagesService;

  beforeEach(() => {
    pages = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    // Defaults to "the project exists" so tests that don't care about this check (the majority)
    // don't need to stub it themselves.
    projects = { findById: vi.fn().mockResolvedValue({ id: FAKE_PROJECT_ID }) };
    // Defaults to "no roadmap phase given, never queried" — tests that pass a real
    // roadmapPhaseId stub this themselves.
    roadmapItems = { existsInProject: vi.fn().mockResolvedValue(true) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new PagesService(
      pages as unknown as PageRepository,
      projects as unknown as ProjectService,
      roadmapItems as unknown as RoadmapItemsService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a page after validating the publicId is free and the project exists", async () => {
      pages.findByPublicId.mockResolvedValue(null);
      pages.create.mockResolvedValue(page());

      const result = await svc.create(
        FAKE_PROJECT_ID,
        { publicId: "PAGE-HOME", pageName: "Home" },
        "actor-1",
      );

      expect(result).toEqual(page());
      expect(projects.findById).toHaveBeenCalledWith(FAKE_PROJECT_ID);
      expect(pages.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: FAKE_PROJECT_ID, publicId: "PAGE-HOME" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          entityType: "page",
          projectId: FAKE_PROJECT_ID,
        }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      pages.findByPublicId.mockResolvedValue(page());

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "PAGE-HOME", pageName: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(pages.create).not.toHaveBeenCalled();
    });

    it("propagates a NotFoundException when the project does not exist, without creating", async () => {
      pages.findByPublicId.mockResolvedValue(null);
      projects.findById.mockRejectedValue(new NotFoundException("Project not found"));

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "PAGE-X", pageName: "X" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(pages.create).not.toHaveBeenCalled();
    });

    it("validates roadmapPhaseId against the real roadmap_items table, scoped to the page's own project", async () => {
      pages.findByPublicId.mockResolvedValue(null);
      pages.create.mockResolvedValue(page({ roadmapPhaseId: FAKE_ROADMAP_PHASE_ID }));
      roadmapItems.existsInProject.mockResolvedValue(true);

      await svc.create(
        FAKE_PROJECT_ID,
        {
          publicId: "PAGE-X",
          pageName: "X",
          roadmapPhaseId: FAKE_ROADMAP_PHASE_ID,
        },
        "actor-1",
      );

      expect(roadmapItems.existsInProject).toHaveBeenCalledWith(
        FAKE_ROADMAP_PHASE_ID,
        FAKE_PROJECT_ID,
      );
      expect(pages.create).toHaveBeenCalled();
    });

    it("rejects a roadmapPhaseId that doesn't resolve to a real roadmap item in the same project, without creating", async () => {
      pages.findByPublicId.mockResolvedValue(null);
      roadmapItems.existsInProject.mockResolvedValue(false);

      await expect(
        svc.create(
          FAKE_PROJECT_ID,
          {
            publicId: "PAGE-X",
            pageName: "X",
            roadmapPhaseId: FAKE_ROADMAP_PHASE_ID,
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(pages.create).not.toHaveBeenCalled();
    });

    it("does not query roadmapItems.existsInProject when roadmapPhaseId is omitted", async () => {
      pages.findByPublicId.mockResolvedValue(null);
      pages.create.mockResolvedValue(page());

      await svc.create(FAKE_PROJECT_ID, { publicId: "PAGE-X", pageName: "X" }, "actor-1");

      expect(roadmapItems.existsInProject).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      pages.findByPublicId.mockResolvedValue(null);
      pages.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "PAGE-RACE", pageName: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      pages.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      pages.create.mockRejectedValue(dbError);

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "PAGE-X", pageName: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the page does not exist", async () => {
      pages.findById.mockResolvedValue(null);
      await expect(svc.findById("missing", FAKE_PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it("returns the page when it exists and belongs to the given projectId", async () => {
      pages.findById.mockResolvedValue(page());
      await expect(svc.findById("page-1", FAKE_PROJECT_ID)).resolves.toEqual(page());
    });

    it("throws NotFoundException (IDOR prevention) when the page belongs to a different project", async () => {
      pages.findById.mockResolvedValue(page({ projectId: FAKE_PROJECT_ID }));
      await expect(svc.findById("page-1", "22222222-2222-4222-8222-222222222299")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      pages.list.mockResolvedValue([page()]);
      const result = await svc.list({ projectId: FAKE_PROJECT_ID, workflowStage: "draft" });
      expect(pages.list).toHaveBeenCalledWith({
        projectId: FAKE_PROJECT_ID,
        workflowStage: "draft",
      });
      expect(result).toEqual([page()]);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      pages.findById.mockResolvedValue(page());
    });

    it("pre-fetches the page before updating, 404ing cleanly before any write is attempted", async () => {
      pages.findById.mockResolvedValue(null);

      await expect(
        svc.update("missing", FAKE_PROJECT_ID, { pageName: "New" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(pages.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException (IDOR prevention) when the page belongs to a different project", async () => {
      pages.findById.mockResolvedValue(page({ projectId: FAKE_PROJECT_ID }));

      await expect(
        svc.update(
          "page-1",
          "22222222-2222-4222-8222-222222222299",
          { pageName: "New" },
          "actor-1",
        ),
      ).rejects.toThrow(NotFoundException);
      expect(pages.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the repository update finds nothing to update (a TOCTOU race after a successful pre-fetch)", async () => {
      // The initial findById() (in beforeEach) resolves the page; the fresh re-read after a
      // failed write resolves null — the "row is genuinely gone" branch of the disambiguation
      // logic below, not the "workflowStage changed concurrently" branch (see the dedicated
      // ConflictException test for that one).
      pages.findById.mockResolvedValueOnce(page()).mockResolvedValueOnce(null);
      pages.update.mockResolvedValue(null);

      await expect(
        svc.update("page-1", FAKE_PROJECT_ID, { pageName: "New" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("validates roadmapPhaseId scoped to the page's own current project, not any caller-supplied project", async () => {
      pages.findById.mockResolvedValue(page({ projectId: FAKE_PROJECT_ID }));
      pages.update.mockResolvedValue(page());

      await svc.update(
        "page-1",
        FAKE_PROJECT_ID,
        { roadmapPhaseId: FAKE_ROADMAP_PHASE_ID },
        "actor-1",
      );

      expect(roadmapItems.existsInProject).toHaveBeenCalledWith(
        FAKE_ROADMAP_PHASE_ID,
        FAKE_PROJECT_ID,
      );
    });

    it("rejects an invalid roadmapPhaseId on update, without writing", async () => {
      roadmapItems.existsInProject.mockResolvedValue(false);

      await expect(
        svc.update("page-1", FAKE_PROJECT_ID, { roadmapPhaseId: FAKE_ROADMAP_PHASE_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(pages.update).not.toHaveBeenCalled();
    });

    it.each(["archived", "superseded"] as const)(
      "rejects an edit to a %s page without writing (code-review finding — the guard was missing entirely)",
      async (terminalStage) => {
        pages.findById.mockResolvedValue(
          page({ workflowStage: terminalStage, projectId: FAKE_PROJECT_ID }),
        );

        await expect(
          svc.update("page-1", FAKE_PROJECT_ID, { pageName: "New" }, "actor-1"),
        ).rejects.toThrow(BadRequestException);
        expect(pages.update).not.toHaveBeenCalled();
      },
    );

    it("passes the page's own current workflowStage as a CAS guard to the repository write", async () => {
      pages.findById.mockResolvedValue(
        page({ workflowStage: "draft", projectId: FAKE_PROJECT_ID }),
      );
      pages.update.mockResolvedValue(page({ workflowStage: "draft" }));

      await svc.update("page-1", FAKE_PROJECT_ID, { pageName: "New" }, "actor-1");

      expect(pages.update).toHaveBeenCalledWith(
        "page-1",
        expect.objectContaining({ pageName: "New" }),
        "draft",
      );
    });

    it(
      "throws ConflictException (not a silent success) when the CAS write loses a race against " +
        "a concurrent changeWorkflowStage() transition (security-review finding)",
      async () => {
        pages.findById
          .mockResolvedValueOnce(page({ workflowStage: "draft", projectId: FAKE_PROJECT_ID }))
          .mockResolvedValueOnce(page({ workflowStage: "archived", projectId: FAKE_PROJECT_ID }));
        pages.update.mockResolvedValue(null);

        await expect(
          svc.update("page-1", FAKE_PROJECT_ID, { pageName: "New" }, "actor-1"),
        ).rejects.toThrow(ConflictException);
      },
    );

    it("throws NotFoundException, not ConflictException, when the row is genuinely gone rather than concurrently transitioned", async () => {
      pages.findById
        .mockResolvedValueOnce(page({ workflowStage: "draft", projectId: FAKE_PROJECT_ID }))
        .mockResolvedValueOnce(null);
      pages.update.mockResolvedValue(null);

      await expect(
        svc.update("page-1", FAKE_PROJECT_ID, { pageName: "New" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("never accepts workflowStage through the general update patch", async () => {
      pages.update.mockResolvedValue(page({ pageName: "Renamed" }));

      // TypeScript's own UpdatePageDto type already excludes workflowStage; this proves the
      // service layer doesn't forward whatever extra keys a patch object might carry.
      await svc.update("page-1", FAKE_PROJECT_ID, { pageName: "Renamed" }, "actor-1");

      const [, patchArg] = pages.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("workflowStage");
    });

    it("returns the repository's updated entity and records an audit event", async () => {
      pages.update.mockResolvedValue(page({ pageName: "Renamed" }));

      const result = await svc.update(
        "page-1",
        FAKE_PROJECT_ID,
        { pageName: "Renamed" },
        "actor-1",
      );

      expect(result.pageName).toBe("Renamed");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "page" }),
      );
    });
  });

  describe("changeWorkflowStage", () => {
    it("is a no-op returning the current entity when the requested stage matches the current one", async () => {
      pages.findById.mockResolvedValue(page({ workflowStage: "draft" }));
      const result = await svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, "draft", "actor-1");
      expect(result.workflowStage).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("throws NotFoundException (IDOR prevention) when the page belongs to a different project", async () => {
      pages.findById.mockResolvedValue(
        page({ workflowStage: "draft", projectId: FAKE_PROJECT_ID }),
      );

      await expect(
        svc.changeWorkflowStage(
          "page-1",
          "22222222-2222-4222-8222-222222222299",
          "submitted",
          "actor-1",
        ),
      ).rejects.toThrow(NotFoundException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      pages.findById.mockResolvedValue(page({ workflowStage: "draft" }));
      await expect(
        svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, "approved", "actor-1"),
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
      pages.findById.mockResolvedValue(page({ workflowStage: from, projectId: FAKE_PROJECT_ID }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pages.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: page({ workflowStage: to }),
      });

      await svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, to, "actor-1");

      // Asserts the page's own projectId (the 4th positional arg) is threaded through — the exact
      // gap this fix closes: without it, a caller holding only a project-scoped grant was denied
      // on every transition (code-review finding, `module-page-inventory`).
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "page_inventory",
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
        pages.findById.mockResolvedValue(page({ workflowStage: from, projectId: FAKE_PROJECT_ID }));
        authorizationService.assertAllowed.mockResolvedValue(undefined);
        pages.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: page({ workflowStage: to }),
        });

        await svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, to, "actor-1");

        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          "actor-1",
          "page_inventory",
          "submit",
          FAKE_PROJECT_ID,
        );
      },
    );

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      pages.findById.mockResolvedValueOnce(page({ workflowStage: "archived" }));
      await expect(
        svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, "draft", "actor-1"),
      ).rejects.toThrow(BadRequestException);

      pages.findById.mockResolvedValueOnce(page({ workflowStage: "superseded" }));
      await expect(
        svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, "draft", "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      pages.findById.mockResolvedValue(page({ workflowStage: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: page_inventory:approve"),
      );

      await expect(
        svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, "approved", "actor-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(pages.updateStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      pages.findById.mockResolvedValue(page({ workflowStage: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pages.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(
        svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, "submitted", "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      pages.findById.mockResolvedValue(page({ workflowStage: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pages.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: page({ workflowStage: "archived" }),
      });

      await expect(
        svc.changeWorkflowStage("page-1", FAKE_PROJECT_ID, "submitted", "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      pages.findById.mockResolvedValue(page({ workflowStage: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pages.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: page({ workflowStage: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeWorkflowStage(
        "page-1",
        FAKE_PROJECT_ID,
        "submitted",
        "actor-1",
      );

      expect(result.workflowStage).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
