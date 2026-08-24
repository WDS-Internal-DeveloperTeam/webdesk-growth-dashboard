import type { EntityRecordEntity, EntityRepository } from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { ProjectService } from "../projects/project.service.js";
import { EntitiesService } from "./entities.service.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const FAKE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function entityRecord(overrides: Partial<EntityRecordEntity> = {}): EntityRecordEntity {
  return {
    id: "entity-1",
    projectId: FAKE_PROJECT_ID,
    publicId: "ENT-ACME",
    name: "Acme Corp",
    entityType: "Organization",
    description: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("EntitiesService", () => {
  let entities: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    findByIds: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: EntitiesService;

  beforeEach(() => {
    entities = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      findByIds: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    projects = { findById: vi.fn().mockResolvedValue({ id: FAKE_PROJECT_ID }) };
    auditService = { record: vi.fn() };
    svc = new EntitiesService(
      entities as unknown as EntityRepository,
      projects as unknown as ProjectService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates an entity after validating the publicId is free and the project exists", async () => {
      entities.findByPublicId.mockResolvedValue(null);
      entities.create.mockResolvedValue(entityRecord());

      const result = await svc.create(
        FAKE_PROJECT_ID,
        { publicId: "ENT-ACME", name: "Acme Corp" },
        "actor-1",
      );

      expect(result).toEqual(entityRecord());
      expect(projects.findById).toHaveBeenCalledWith(FAKE_PROJECT_ID);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "entity" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      entities.findByPublicId.mockResolvedValue(entityRecord());

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "ENT-ACME", name: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(entities.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      entities.findByPublicId.mockResolvedValue(null);
      entities.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "ENT-RACE", name: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      entities.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      entities.create.mockRejectedValue(dbError);

      await expect(
        svc.create(FAKE_PROJECT_ID, { publicId: "ENT-X", name: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });

    it("sanitizes description before writing, stripping a disallowed tag (dashboard-web UI build, 2026-08-24)", async () => {
      entities.findByPublicId.mockResolvedValue(null);
      entities.create.mockResolvedValue(entityRecord());

      await svc.create(
        FAKE_PROJECT_ID,
        {
          publicId: "ENT-X",
          name: "Acme Corp",
          description: "<script>alert(1)</script><p>A real organization entity</p>",
        },
        "actor-1",
      );

      const [writtenInput] = entities.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.description).toBe("<p>A real organization entity</p>");
    });

    it("passes a null description through unchanged rather than coercing it into an empty string", async () => {
      entities.findByPublicId.mockResolvedValue(null);
      entities.create.mockResolvedValue(entityRecord());

      await svc.create(
        FAKE_PROJECT_ID,
        { publicId: "ENT-X", name: "X", description: null },
        "actor-1",
      );

      const [writtenInput] = entities.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.description).toBeNull();
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the entity does not exist", async () => {
      entities.findById.mockResolvedValue(null);
      await expect(svc.findById("missing", FAKE_PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException (IDOR prevention) when the entity belongs to a different project", async () => {
      entities.findById.mockResolvedValue(entityRecord({ projectId: FAKE_PROJECT_ID }));
      await expect(
        svc.findById("entity-1", "22222222-2222-4222-8222-222222222299"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("scopes the filter to the given projectId", async () => {
      entities.list.mockResolvedValue([entityRecord()]);
      const result = await svc.list(FAKE_PROJECT_ID, { entityType: "Organization" });
      expect(entities.list).toHaveBeenCalledWith({
        entityType: "Organization",
        projectId: FAKE_PROJECT_ID,
      });
      expect(result).toEqual([entityRecord()]);
    });
  });

  describe("update", () => {
    it("pre-fetches the entity before updating, 404ing cleanly (including on a project mismatch) before any write", async () => {
      entities.findById.mockResolvedValue(null);

      await expect(
        svc.update("missing", FAKE_PROJECT_ID, { name: "New" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(entities.update).not.toHaveBeenCalled();
    });

    it("returns the repository's updated entity and records an audit event", async () => {
      entities.findById.mockResolvedValue(entityRecord());
      entities.update.mockResolvedValue(entityRecord({ name: "Renamed" }));

      const result = await svc.update("entity-1", FAKE_PROJECT_ID, { name: "Renamed" }, "actor-1");

      expect(result.name).toBe("Renamed");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "entity" }),
      );
    });

    it("throws NotFoundException when the repository update finds nothing (TOCTOU race)", async () => {
      entities.findById.mockResolvedValue(entityRecord());
      entities.update.mockResolvedValue(null);

      await expect(
        svc.update("entity-1", FAKE_PROJECT_ID, { name: "New" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("sanitizes a real (non-null) description value on update, stripping a disallowed tag (dashboard-web UI build, 2026-08-24)", async () => {
      entities.findById.mockResolvedValue(entityRecord({ description: "old" }));
      entities.update.mockResolvedValue(entityRecord());

      await svc.update(
        "entity-1",
        FAKE_PROJECT_ID,
        { description: "<script>alert(1)</script><p>Updated description</p>" },
        "actor-1",
      );

      const [, patchArg] = entities.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg.description).toBe("<p>Updated description</p>");
    });

    it("skips re-sanitizing description when it's identical to the stored value", async () => {
      entities.findById.mockResolvedValue(entityRecord({ description: "<p>Bold</p>" }));
      entities.update.mockResolvedValue(entityRecord());

      await svc.update(
        "entity-1",
        FAKE_PROJECT_ID,
        { name: "Renamed", description: "<p>Bold</p>" },
        "actor-1",
      );

      const [, patchArg] = entities.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg.description).toBe("<p>Bold</p>");
    });
  });

  describe("remove", () => {
    it("removes the entity, scoped to projectId (IDOR prevention), and records an audit event", async () => {
      entities.findById.mockResolvedValue(entityRecord());
      entities.remove.mockResolvedValue(true);

      await svc.remove("entity-1", FAKE_PROJECT_ID, "actor-1");

      expect(entities.remove).toHaveBeenCalledWith("entity-1", FAKE_PROJECT_ID);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "entity" }),
      );
    });

    it("throws NotFoundException (IDOR prevention) when the entity belongs to a different project", async () => {
      entities.findById.mockResolvedValue(entityRecord({ projectId: FAKE_PROJECT_ID }));

      await expect(
        svc.remove("entity-1", "22222222-2222-4222-8222-222222222299", "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(entities.remove).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the repository remove finds nothing (TOCTOU race)", async () => {
      entities.findById.mockResolvedValue(entityRecord());
      entities.remove.mockResolvedValue(false);

      await expect(svc.remove("entity-1", FAKE_PROJECT_ID, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
