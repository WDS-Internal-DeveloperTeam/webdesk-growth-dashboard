import type { InternalLinkEntity, InternalLinkRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { PagesService } from "../page-inventory/pages.service.js";
import type { ProjectService } from "../projects/project.service.js";
import type { UsersService } from "../users/users.service.js";
import { InternalLinksService } from "./internal-links.service.js";

const NOW = new Date("2026-08-24T00:00:00.000Z");
const FAKE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_PAGE_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_PAGE_ID = "33333333-3333-4333-8333-333333333333";
const APPROVER_ID = "44444444-4444-4444-8444-444444444444";

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `InternalLinksService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly. */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function link(overrides: Partial<InternalLinkEntity> = {}): InternalLinkEntity {
  return {
    id: "link-1",
    projectId: FAKE_PROJECT_ID,
    publicId: "LINK-HOME-TO-PRICING",
    sourcePageId: SOURCE_PAGE_ID,
    targetPageId: TARGET_PAGE_ID,
    relationship: null,
    anchor: null,
    context: null,
    linkType: null,
    priority: null,
    status: "proposed",
    detector: null,
    assignedApproverUserId: null,
    relatedStrategyRecordId: null,
    implementedAt: null,
    verifiedAt: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("InternalLinksService", () => {
  let links: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let pages: { existsInProject: ReturnType<typeof vi.fn> };
  let usersService: { findById: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: InternalLinksService;

  beforeEach(() => {
    links = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    projects = { findById: vi.fn().mockResolvedValue({ id: FAKE_PROJECT_ID }) };
    pages = { existsInProject: vi.fn().mockResolvedValue(true) };
    usersService = { findById: vi.fn().mockResolvedValue({ id: APPROVER_ID }) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new InternalLinksService(
      links as unknown as InternalLinkRepository,
      projects as unknown as ProjectService,
      pages as unknown as PagesService,
      usersService as unknown as UsersService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const validInput = {
      publicId: "LINK-HOME-TO-PRICING",
      sourcePageId: SOURCE_PAGE_ID,
      targetPageId: TARGET_PAGE_ID,
    };

    it("creates a link after validating publicId, project, and both pages", async () => {
      links.findByPublicId.mockResolvedValue(null);
      links.create.mockResolvedValue(link());

      const result = await svc.create(FAKE_PROJECT_ID, validInput, "actor-1");

      expect(result).toEqual(link());
      expect(projects.findById).toHaveBeenCalledWith(FAKE_PROJECT_ID);
      expect(pages.existsInProject).toHaveBeenCalledWith(SOURCE_PAGE_ID, FAKE_PROJECT_ID);
      expect(pages.existsInProject).toHaveBeenCalledWith(TARGET_PAGE_ID, FAKE_PROJECT_ID);
      expect(links.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: FAKE_PROJECT_ID, publicId: validInput.publicId }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          entityType: "internal_link",
          projectId: FAKE_PROJECT_ID,
        }),
      );
    });

    it("rejects sourcePageId === targetPageId before any database call", async () => {
      await expect(
        svc.create(FAKE_PROJECT_ID, { ...validInput, targetPageId: SOURCE_PAGE_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(links.findByPublicId).not.toHaveBeenCalled();
      expect(pages.existsInProject).not.toHaveBeenCalled();
    });

    it("rejects sourcePageId === targetPageId even when the two differ only by UUID casing", async () => {
      // Zod's .uuid() accepts mixed-case UUIDs unchanged, so a bare `===` would let two
      // differently-cased representations of the identical page id through.
      await expect(
        svc.create(
          FAKE_PROJECT_ID,
          { ...validInput, targetPageId: SOURCE_PAGE_ID.toUpperCase() },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(pages.existsInProject).not.toHaveBeenCalled();
    });

    it("rejects a duplicate publicId", async () => {
      links.findByPublicId.mockResolvedValue(link());

      await expect(svc.create(FAKE_PROJECT_ID, validInput, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(links.create).not.toHaveBeenCalled();
    });

    it("propagates a NotFoundException when the project does not exist, without creating", async () => {
      links.findByPublicId.mockResolvedValue(null);
      projects.findById.mockRejectedValue(new NotFoundException("Project not found"));

      await expect(svc.create(FAKE_PROJECT_ID, validInput, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(links.create).not.toHaveBeenCalled();
    });

    it("rejects a well-formed but nonexistent sourcePageId with 400, not a raw 500", async () => {
      links.findByPublicId.mockResolvedValue(null);
      pages.existsInProject.mockImplementation((pageId: string) =>
        Promise.resolve(pageId !== SOURCE_PAGE_ID),
      );

      await expect(svc.create(FAKE_PROJECT_ID, validInput, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(links.create).not.toHaveBeenCalled();
    });

    it("rejects a well-formed but nonexistent targetPageId with 400, not a raw 500", async () => {
      links.findByPublicId.mockResolvedValue(null);
      pages.existsInProject.mockImplementation((pageId: string) =>
        Promise.resolve(pageId !== TARGET_PAGE_ID),
      );

      await expect(svc.create(FAKE_PROJECT_ID, validInput, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(links.create).not.toHaveBeenCalled();
    });

    it("validates assignedApproverUserId existence when provided", async () => {
      links.findByPublicId.mockResolvedValue(null);
      usersService.findById.mockRejectedValue(new NotFoundException("User not found"));

      await expect(
        svc.create(
          FAKE_PROJECT_ID,
          { ...validInput, assignedApproverUserId: APPROVER_ID },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(links.create).not.toHaveBeenCalled();
    });

    it("does not call usersService.findById when no assignedApproverUserId is provided", async () => {
      links.findByPublicId.mockResolvedValue(null);
      links.create.mockResolvedValue(link());

      await svc.create(FAKE_PROJECT_ID, validInput, "actor-1");

      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      links.findByPublicId.mockResolvedValue(null);
      links.create.mockRejectedValue(uniqueConstraintError());

      await expect(svc.create(FAKE_PROJECT_ID, validInput, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      links.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      links.create.mockRejectedValue(dbError);

      await expect(svc.create(FAKE_PROJECT_ID, validInput, "actor-1")).rejects.toBe(dbError);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the link does not exist", async () => {
      links.findById.mockResolvedValue(null);
      await expect(svc.findById("missing", FAKE_PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it("returns the link when it exists and belongs to the given projectId", async () => {
      links.findById.mockResolvedValue(link());
      await expect(svc.findById("link-1", FAKE_PROJECT_ID)).resolves.toEqual(link());
    });

    it("throws NotFoundException (IDOR prevention) when the link belongs to a different project", async () => {
      links.findById.mockResolvedValue(link({ projectId: FAKE_PROJECT_ID }));
      await expect(svc.findById("link-1", "99999999-9999-4999-8999-999999999999")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      links.list.mockResolvedValue([link()]);
      const result = await svc.list({ projectId: FAKE_PROJECT_ID, status: "proposed" });
      expect(links.list).toHaveBeenCalledWith({ projectId: FAKE_PROJECT_ID, status: "proposed" });
      expect(result).toEqual([link()]);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      links.findById.mockResolvedValue(link());
    });

    it("pre-fetches the link before updating, 404ing cleanly before any write is attempted", async () => {
      links.findById.mockResolvedValue(null);

      await expect(
        svc.update("missing", FAKE_PROJECT_ID, { anchor: "new" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(links.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException (IDOR prevention) when the link belongs to a different project", async () => {
      links.findById.mockResolvedValue(link({ projectId: FAKE_PROJECT_ID }));

      await expect(
        svc.update("link-1", "99999999-9999-4999-8999-999999999999", { anchor: "new" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(links.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the repository update finds nothing to update (a TOCTOU race after a successful pre-fetch)", async () => {
      links.findById.mockResolvedValueOnce(link()).mockResolvedValueOnce(null);
      links.update.mockResolvedValue(null);

      await expect(
        svc.update("link-1", FAKE_PROJECT_ID, { anchor: "new" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException (not a silent success) when the CAS write loses a race against a concurrent changeStatus() transition", async () => {
      links.findById
        .mockResolvedValueOnce(link({ status: "proposed" }))
        .mockResolvedValueOnce(link({ status: "approved" }));
      links.update.mockResolvedValue(null);

      await expect(
        svc.update("link-1", FAKE_PROJECT_ID, { anchor: "new" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("rejects an update that would make sourcePageId === targetPageId", async () => {
      links.findById.mockResolvedValue(
        link({ sourcePageId: SOURCE_PAGE_ID, targetPageId: TARGET_PAGE_ID }),
      );

      await expect(
        svc.update("link-1", FAKE_PROJECT_ID, { targetPageId: SOURCE_PAGE_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(links.update).not.toHaveBeenCalled();
    });

    it("rejects an update that would make sourcePageId === targetPageId even by casing alone", async () => {
      links.findById.mockResolvedValue(
        link({ sourcePageId: SOURCE_PAGE_ID, targetPageId: TARGET_PAGE_ID }),
      );

      await expect(
        svc.update(
          "link-1",
          FAKE_PROJECT_ID,
          { targetPageId: SOURCE_PAGE_ID.toUpperCase() },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(links.update).not.toHaveBeenCalled();
    });

    it("passes the link's own current status as a CAS guard to the repository write", async () => {
      links.findById.mockResolvedValue(link({ status: "proposed" }));
      links.update.mockResolvedValue(link({ status: "proposed" }));

      await svc.update("link-1", FAKE_PROJECT_ID, { anchor: "new" }, "actor-1");

      expect(links.update).toHaveBeenCalledWith(
        "link-1",
        expect.objectContaining({ anchor: "new" }),
        "proposed",
      );
    });

    it("never accepts status through the general update patch", async () => {
      links.update.mockResolvedValue(link({ anchor: "renamed" }));

      await svc.update("link-1", FAKE_PROJECT_ID, { anchor: "renamed" }, "actor-1");

      const [, patchArg] = links.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("status");
    });

    it("re-validates sourcePageId only when it's actually changing", async () => {
      links.findById.mockResolvedValue(link({ sourcePageId: SOURCE_PAGE_ID }));
      links.update.mockResolvedValue(link());

      // Same value as current — no re-validation call expected.
      await svc.update("link-1", FAKE_PROJECT_ID, { sourcePageId: SOURCE_PAGE_ID }, "actor-1");
      expect(pages.existsInProject).not.toHaveBeenCalled();

      const newSourcePageId = "55555555-5555-4555-8555-555555555555";
      await svc.update("link-1", FAKE_PROJECT_ID, { sourcePageId: newSourcePageId }, "actor-1");
      expect(pages.existsInProject).toHaveBeenCalledWith(newSourcePageId, FAKE_PROJECT_ID);
    });

    it("rejects re-assigning to a nonexistent sourcePageId with 400", async () => {
      links.findById.mockResolvedValue(link({ sourcePageId: SOURCE_PAGE_ID }));
      pages.existsInProject.mockResolvedValue(false);

      await expect(
        svc.update(
          "link-1",
          FAKE_PROJECT_ID,
          { sourcePageId: "55555555-5555-4555-8555-555555555555" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(links.update).not.toHaveBeenCalled();
    });

    it("re-validates targetPageId only when it's actually changing", async () => {
      links.findById.mockResolvedValue(link({ targetPageId: TARGET_PAGE_ID }));
      links.update.mockResolvedValue(link());

      // Same value as current — no re-validation call expected.
      await svc.update("link-1", FAKE_PROJECT_ID, { targetPageId: TARGET_PAGE_ID }, "actor-1");
      expect(pages.existsInProject).not.toHaveBeenCalled();

      const newTargetPageId = "66666666-6666-4666-8666-666666666666";
      await svc.update("link-1", FAKE_PROJECT_ID, { targetPageId: newTargetPageId }, "actor-1");
      expect(pages.existsInProject).toHaveBeenCalledWith(newTargetPageId, FAKE_PROJECT_ID);
    });

    it("rejects re-assigning to a nonexistent targetPageId with 400", async () => {
      links.findById.mockResolvedValue(link({ targetPageId: TARGET_PAGE_ID }));
      pages.existsInProject.mockResolvedValue(false);

      await expect(
        svc.update(
          "link-1",
          FAKE_PROJECT_ID,
          { targetPageId: "66666666-6666-4666-8666-666666666666" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(links.update).not.toHaveBeenCalled();
    });

    it("re-validates assignedApproverUserId only when it's actually changing", async () => {
      links.findById.mockResolvedValue(link({ assignedApproverUserId: APPROVER_ID }));
      links.update.mockResolvedValue(link());

      await svc.update(
        "link-1",
        FAKE_PROJECT_ID,
        { assignedApproverUserId: APPROVER_ID },
        "actor-1",
      );
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it("returns the repository's updated entity and records an audit event", async () => {
      links.update.mockResolvedValue(link({ anchor: "renamed" }));

      const result = await svc.update("link-1", FAKE_PROJECT_ID, { anchor: "renamed" }, "actor-1");

      expect(result.anchor).toBe("renamed");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "internal_link" }),
      );
    });
  });

  describe("changeStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      links.findById.mockResolvedValue(link({ status: "proposed" }));
      const result = await svc.changeStatus("link-1", FAKE_PROJECT_ID, "proposed", "actor-1");
      expect(result.status).toBe("proposed");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("throws NotFoundException (IDOR prevention) when the link belongs to a different project", async () => {
      links.findById.mockResolvedValue(link({ status: "proposed", projectId: FAKE_PROJECT_ID }));

      await expect(
        svc.changeStatus("link-1", "99999999-9999-4999-8999-999999999999", "approved", "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist (e.g. proposed -> implemented, skipping approved)", async () => {
      links.findById.mockResolvedValue(link({ status: "proposed" }));
      await expect(
        svc.changeStatus("link-1", FAKE_PROJECT_ID, "implemented", "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ["proposed", "approved", "approve"],
      ["approved", "implemented", "submit"],
      ["implemented", "verified", "review"],
      ["approved", "proposed", "approve"],
      ["implemented", "approved", "submit"],
      ["verified", "implemented", "review"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      links.findById.mockResolvedValue(link({ status: from, projectId: FAKE_PROJECT_ID }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      links.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: link({ status: to }),
      });

      await svc.changeStatus("link-1", FAKE_PROJECT_ID, to, "actor-1");

      // Asserts the link's own projectId (the 4th positional arg) is threaded through — without
      // it, a caller holding only a project-scoped grant would be denied on every transition.
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "keyword_internal_links",
        action,
        FAKE_PROJECT_ID,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      links.findById.mockResolvedValue(link({ status: "proposed" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: keyword_internal_links:approve"),
      );

      await expect(
        svc.changeStatus("link-1", FAKE_PROJECT_ID, "approved", "actor-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(links.updateStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      links.findById.mockResolvedValue(link({ status: "proposed" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      links.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(
        svc.changeStatus("link-1", FAKE_PROJECT_ID, "approved", "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      links.findById.mockResolvedValue(link({ status: "proposed" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      links.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: link({ status: "approved" }),
      });

      await expect(
        svc.changeStatus("link-1", FAKE_PROJECT_ID, "approved", "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      links.findById.mockResolvedValue(link({ status: "approved" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      links.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: link({ status: "implemented" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeStatus("link-1", FAKE_PROJECT_ID, "implemented", "actor-1");

      expect(result.status).toBe("implemented");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
