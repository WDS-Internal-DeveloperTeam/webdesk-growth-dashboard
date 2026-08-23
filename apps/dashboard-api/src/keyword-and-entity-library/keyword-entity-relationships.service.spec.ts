import type {
  EntityRecordEntity,
  EntityRepository,
  KeywordEntity,
  KeywordEntityRelationshipEntity,
  KeywordEntityRelationshipRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { KeywordsService } from "./keywords.service.js";
import { KeywordEntityRelationshipsService } from "./keyword-entity-relationships.service.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const FAKE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FAKE_ENTITY_ID = "22222222-2222-4222-8222-222222222222";

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

function entityRecord(overrides: Partial<EntityRecordEntity> = {}): EntityRecordEntity {
  return {
    id: FAKE_ENTITY_ID,
    projectId: FAKE_PROJECT_ID,
    publicId: "ENT-1",
    name: "Acme",
    entityType: null,
    description: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function relationship(
  overrides: Partial<KeywordEntityRelationshipEntity> = {},
): KeywordEntityRelationshipEntity {
  return {
    id: "rel-1",
    keywordId: "keyword-1",
    entityId: FAKE_ENTITY_ID,
    createdBy: "actor-1",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("KeywordEntityRelationshipsService", () => {
  let relationships: {
    create: ReturnType<typeof vi.fn>;
    listForKeyword: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let entities: { findByIds: ReturnType<typeof vi.fn> };
  let keywords: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: KeywordEntityRelationshipsService;

  beforeEach(() => {
    relationships = { create: vi.fn(), listForKeyword: vi.fn(), remove: vi.fn() };
    entities = { findByIds: vi.fn().mockResolvedValue([entityRecord()]) };
    keywords = { findById: vi.fn().mockResolvedValue(keyword()) };
    auditService = { record: vi.fn() };
    svc = new KeywordEntityRelationshipsService(
      relationships as unknown as KeywordEntityRelationshipRepository,
      entities as unknown as EntityRepository,
      keywords as unknown as KeywordsService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("confirms the parent keyword exists in the project before creating", async () => {
      relationships.create.mockResolvedValue(relationship());

      await svc.create("keyword-1", FAKE_PROJECT_ID, FAKE_ENTITY_ID, "actor-1");

      expect(keywords.findById).toHaveBeenCalledWith("keyword-1", FAKE_PROJECT_ID);
    });

    it("rejects an entityId that doesn't resolve to a real entity in the same project", async () => {
      entities.findByIds.mockResolvedValue([]);

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, FAKE_ENTITY_ID, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(relationships.create).not.toHaveBeenCalled();
    });

    it("scopes the entity existence check to the given projectId", async () => {
      relationships.create.mockResolvedValue(relationship());

      await svc.create("keyword-1", FAKE_PROJECT_ID, FAKE_ENTITY_ID, "actor-1");

      expect(entities.findByIds).toHaveBeenCalledWith([FAKE_ENTITY_ID], FAKE_PROJECT_ID);
    });

    it("creates the relationship and records an audit event scoped to the keyword's project", async () => {
      relationships.create.mockResolvedValue(relationship());

      const result = await svc.create("keyword-1", FAKE_PROJECT_ID, FAKE_ENTITY_ID, "actor-1");

      expect(result).toEqual(relationship());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create",
          entityType: "keyword_entity_relationship",
          projectId: FAKE_PROJECT_ID,
        }),
      );
    });

    it("translates a duplicate relationship into a clean 400, not a raw 500", async () => {
      relationships.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, FAKE_ENTITY_ID, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error unchanged", async () => {
      const dbError = new Error("connection reset");
      relationships.create.mockRejectedValue(dbError);

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, FAKE_ENTITY_ID, "actor-1"),
      ).rejects.toBe(dbError);
    });

    it("propagates NotFoundException (IDOR prevention) when the parent keyword is not in this project", async () => {
      keywords.findById.mockRejectedValue(new NotFoundException("Keyword not found"));

      await expect(
        svc.create("keyword-1", FAKE_PROJECT_ID, FAKE_ENTITY_ID, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(relationships.create).not.toHaveBeenCalled();
    });
  });

  describe("listForKeyword", () => {
    it("confirms the parent keyword exists in the project before listing", async () => {
      relationships.listForKeyword.mockResolvedValue([relationship()]);

      const result = await svc.listForKeyword("keyword-1", FAKE_PROJECT_ID);

      expect(keywords.findById).toHaveBeenCalledWith("keyword-1", FAKE_PROJECT_ID);
      expect(result).toEqual([relationship()]);
    });
  });

  describe("remove", () => {
    it("removes the relationship, scoped to keywordId (IDOR prevention), and records an audit event", async () => {
      relationships.remove.mockResolvedValue(true);

      await svc.remove("rel-1", "keyword-1", FAKE_PROJECT_ID, "actor-1");

      expect(relationships.remove).toHaveBeenCalledWith("rel-1", "keyword-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "keyword_entity_relationship" }),
      );
    });

    it("throws NotFoundException when nothing was removed", async () => {
      relationships.remove.mockResolvedValue(false);

      await expect(svc.remove("rel-1", "keyword-1", FAKE_PROJECT_ID, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
