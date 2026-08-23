import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  EntityRepository,
  KeywordEntityRelationshipEntity,
  KeywordEntityRelationshipRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  ENTITY_REPOSITORY,
  KEYWORD_ENTITY_RELATIONSHIP_REPOSITORY,
} from "./keyword-and-entity-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { KeywordsService } from "./keywords.service.js";

/** Same malformed-id guard `PersonasService.assertServiceIdsExist()` uses before ever reaching
 *  Postgres (`dashboard-api` never imports `sequelize` directly per ADR-0006 — a raw non-UUID
 *  value would otherwise crash the `uuid`-typed `id` column with a 500 instead of a clean 400). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Keyword <-> entity relationship CRUD — a genuine many-to-many join, no content fields of its
 * own to edit in place, only create/list/remove (task package D1). Gated on `edit` at the module-
 * permission level, no separate approval workflow for relationships (task package D9).
 */
@Injectable()
export class KeywordEntityRelationshipsService {
  constructor(
    @Inject(KEYWORD_ENTITY_RELATIONSHIP_REPOSITORY)
    private readonly relationships: KeywordEntityRelationshipRepository,
    @Inject(ENTITY_REPOSITORY) private readonly entities: EntityRepository,
    private readonly keywords: KeywordsService,
    private readonly auditService: AuditService,
  ) {}

  /** Verifies the parent keyword exists AND belongs to the given `projectId` (IDOR prevention),
   *  and that `entityId` resolves to a real entity in the SAME project (cross-entity existence
   *  validation, task package D1) — mirrors `PersonasService.assertServiceIdsExist()`'s own
   *  shape, including the malformed-UUID guard. */
  async create(
    keywordId: string,
    projectId: string,
    entityId: string,
    actorUserId: string,
  ): Promise<KeywordEntityRelationshipEntity> {
    const keyword = await this.keywords.findById(keywordId, projectId);

    if (!UUID_PATTERN.test(entityId)) {
      throw new BadRequestException(`entityId not found: ${entityId}`);
    }
    const found = await this.entities.findByIds([entityId], projectId);
    if (found.length === 0) {
      throw new BadRequestException(`entityId not found: ${entityId}`);
    }

    let created: KeywordEntityRelationshipEntity;
    try {
      created = await this.relationships.create(keywordId, entityId, actorUserId);
    } catch (error) {
      // keyword_entity_relationships_unique is a real unique index (migration 00060) — a
      // duplicate relationship submission is caught here, not left as a raw 500.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`This entity is already linked to this keyword: ${entityId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: keyword.projectId,
      entityType: "keyword_entity_relationship",
      entityId: created.id,
      action: "create",
      afterState: { keywordId, entityId },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention) via `KeywordsService.findById()`. */
  async listForKeyword(
    keywordId: string,
    projectId: string,
  ): Promise<readonly KeywordEntityRelationshipEntity[]> {
    await this.keywords.findById(keywordId, projectId);
    return this.relationships.listForKeyword(keywordId);
  }

  /** `keywordId`-scoped (IDOR prevention), same as create's parent check. */
  async remove(
    id: string,
    keywordId: string,
    projectId: string,
    actorUserId: string,
  ): Promise<void> {
    const keyword = await this.keywords.findById(keywordId, projectId);

    const removed = await this.relationships.remove(id, keywordId);
    if (!removed) {
      throw new NotFoundException(`Keyword-entity relationship not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: keyword.projectId,
      entityType: "keyword_entity_relationship",
      entityId: id,
      action: "delete",
      beforeState: { keywordId },
      retentionCategory: "audit-7y",
    });
  }
}
