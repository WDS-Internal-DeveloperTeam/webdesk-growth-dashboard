import { Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getServiceLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  ServiceApprovalStatus,
  ServiceConfidentiality,
  ServiceEntity,
  ServicePublicationStatus,
} from "./entities.js";

export interface ServiceListFilter {
  readonly categoryId?: string;
  readonly approvalStatus?: ServiceApprovalStatus;
  readonly publicationStatus?: ServicePublicationStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateServiceStatusResult =
  | { readonly outcome: "updated"; readonly entity: ServiceEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ServiceEntity };

// Mirrors ProjectRepository.list()'s own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, not tied
 *  to a `projects` row (task package D4). */
export class ServiceRepository {
  private readonly model = getServiceLibraryModels().Service;

  async create(input: {
    publicId: string;
    canonicalName: string;
    publicName?: string | null;
    categoryId: string;
    parentServiceId?: string | null;
    shortPublicDescription?: string | null;
    audience?: string | null;
    problems?: string | null;
    capabilities?: string | null;
    outcomes?: string | null;
    exclusions?: string | null;
    internalDescription?: string | null;
    icpIds?: readonly string[];
    relatedPageIds?: readonly string[];
    relatedCaseStudyIds?: readonly string[];
    confidentiality?: ServiceConfidentiality;
    ownerUserId?: string | null;
    createdBy?: string | null;
  }): Promise<ServiceEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      canonicalName: input.canonicalName,
      publicName: input.publicName ?? null,
      categoryId: input.categoryId,
      parentServiceId: input.parentServiceId ?? null,
      shortPublicDescription: input.shortPublicDescription ?? null,
      audience: input.audience ?? null,
      problems: input.problems ?? null,
      capabilities: input.capabilities ?? null,
      outcomes: input.outcomes ?? null,
      exclusions: input.exclusions ?? null,
      internalDescription: input.internalDescription ?? null,
      icpIds: input.icpIds ?? [],
      relatedPageIds: input.relatedPageIds ?? [],
      relatedCaseStudyIds: input.relatedCaseStudyIds ?? [],
      confidentiality: input.confidentiality ?? "internal",
      publicationStatus: "draft",
      approvalStatus: "draft",
      ownerUserId: input.ownerUserId ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ServiceEntity>(instance);
  }

  async findById(id: string): Promise<ServiceEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ServiceEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ServiceEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ServiceEntity>(instance) : null;
  }

  /** Existence check for a set of service ids, mirroring the dimension repositories' own
   *  `findByIds()` (e.g. `DeliverableRepository.findByIds()`) — added so another module
   *  (Persona Library's `relatedServiceIds`) can validate real, existing services without
   *  duplicating this query. */
  async findByIds(ids: readonly string[]): Promise<readonly ServiceEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({ where: { id: ids } });
    return rows.map((row) => toEntityWithIsoDates<ServiceEntity>(row));
  }

  async list(filter: ServiceListFilter = {}): Promise<readonly ServiceEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.publicationStatus) {
      where.publicationStatus = filter.publicationStatus;
    }
    if (filter.search) {
      where.canonicalName = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [["updatedAt", "DESC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ServiceEntity>(row));
  }

  /** Content/relationship/publication update — `approvalStatus` is deliberately never accepted
   *  here (task package D5); only `updateStatus()` may change it. `transaction`, when given, lets
   *  the calling service update this row and replace the join-table relationships as one atomic
   *  unit (mirrors `ProjectRepository.update()`'s own `transaction` parameter). */
  async update(
    id: string,
    patch: Partial<{
      canonicalName: string;
      publicName: string | null;
      categoryId: string;
      parentServiceId: string | null;
      shortPublicDescription: string | null;
      audience: string | null;
      problems: string | null;
      capabilities: string | null;
      outcomes: string | null;
      exclusions: string | null;
      internalDescription: string | null;
      icpIds: readonly string[];
      relatedPageIds: readonly string[];
      relatedCaseStudyIds: readonly string[];
      confidentiality: ServiceConfidentiality;
      publicationStatus: ServicePublicationStatus;
      ownerUserId: string | null;
      updatedBy: string | null;
    }>,
    transaction?: Transaction,
  ): Promise<ServiceEntity | null> {
    const instance = await this.model.findByPk(id, { transaction });
    if (!instance) {
      return null;
    }
    await instance.update(patch, { transaction });
    return toEntityWithIsoDates<ServiceEntity>(instance);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `BusinessKnowledgeRecordRepository.updateStatus()`'s own conditional-`UPDATE` pattern, which
   *  itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent approvers from
   *  both reading the same `expectedCurrentStatus` and both "succeeding". */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ServiceApprovalStatus,
    nextStatus: ServiceApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdateServiceStatusResult> {
    const [affectedCount] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus } },
    );
    if (affectedCount > 0) {
      const instance = await this.model.findByPk(id);
      // Can't be missing: the UPDATE above just matched this exact id.
      return { outcome: "updated", entity: toEntityWithIsoDates<ServiceEntity>(instance!) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ServiceEntity>(current) };
  }
}
