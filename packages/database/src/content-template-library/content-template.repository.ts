import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getContentTemplateLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ContentTemplateApprovalStatus, ContentTemplateEntity } from "./entities.js";

/** Every field a caller may set/change on create, i.e. `ContentTemplateEntity` minus its
 *  server-only-managed columns (`id`, `approvalStatus`, `version`, `isPublished`, `publishedAt`,
 *  `createdAt`, `updatedAt`) — derived, not hand-retyped, mirroring `PersonaContentFields`'s own
 *  precedent, so a future field added to `ContentTemplateEntity` is a compile error here until
 *  it's also handled by `create()`/`update()`, not a silent gap. */
type ContentTemplateContentFields = Omit<
  ContentTemplateEntity,
  "id" | "approvalStatus" | "version" | "isPublished" | "publishedAt" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` is
 *  excluded (immutable after create). Unlike `PersonaUpdateFields`, no array-field
 *  null-to-empty-array override is needed — `requiredSections`/`optionalSections` are genuinely
 *  nullable columns here (task package §3), so an explicit `null` in the patch is stored as
 *  `null` directly, the same convention every scalar nullable field already follows; `undefined`
 *  (the key omitted) still leaves the column unchanged. */
type ContentTemplateUpdateFields = Omit<ContentTemplateContentFields, "publicId">;

export interface ContentTemplateListFilter {
  readonly approvalStatus?: ContentTemplateApprovalStatus;
  readonly isPublished?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateContentTemplateStatusResult =
  | { readonly outcome: "updated"; readonly entity: ContentTemplateEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ContentTemplateEntity };

export type UpdateContentTemplatePublishStateResult =
  | { readonly outcome: "updated"; readonly entity: ContentTemplateEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ContentTemplateEntity };

// Mirrors PersonaRepository's/ServiceRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping
// pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 *  Persona Library's/Service Library's own precedent. */
export class ContentTemplateRepository {
  private readonly model = getContentTemplateLibraryModels().ContentTemplate;

  async create(
    input: Partial<ContentTemplateContentFields> &
      Pick<ContentTemplateContentFields, "publicId" | "pageType">,
  ): Promise<ContentTemplateEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      pageType: input.pageType,
      purpose: input.purpose ?? null,
      requiredSections: input.requiredSections ?? null,
      optionalSections: input.optionalSections ?? null,
      proofRules: input.proofRules ?? null,
      seoAeoGeoRequirements: input.seoAeoGeoRequirements ?? null,
      schema: input.schema ?? null,
      ctaRules: input.ctaRules ?? null,
      contentDepthGuidance: input.contentDepthGuidance ?? null,
      approvalStatus: "draft",
      version: 1,
      isPublished: false,
      publishedAt: null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ContentTemplateEntity>(instance);
  }

  async findById(id: string): Promise<ContentTemplateEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ContentTemplateEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ContentTemplateEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ContentTemplateEntity>(instance) : null;
  }

  async list(filter: ContentTemplateListFilter = {}): Promise<readonly ContentTemplateEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }
    if (filter.search) {
      where.pageType = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching PersonaRepository's/ServiceRepository's own
      // precedent (an already-fixed bug class in this codebase's history).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ContentTemplateEntity>(row));
  }

  /**
   * Content update — `approvalStatus`/`isPublished`/`publishedAt` are deliberately never
   * accepted here (D2/D4); only `updateApprovalStatus()`/`updatePublishState()` may change those.
   * `version` is server-managed: incremented by 1 as part of the same `UPDATE` statement via a
   * Postgres-evaluated `version + 1` literal (D5), with `returning: true` getting the post-update
   * row (including the server-computed `version`) back from the `UPDATE` itself rather than a
   * second round trip — mirrors `PersonaRepository.update()`'s own identical pattern.
   *
   * `expectedApprovalStatus` is an optional CAS guard, mirroring `PageRepository.update()`'s own
   * `expectedWorkflowStage` parameter (a previously-fixed bug class in this codebase, originating
   * from `WebsiteStrategyRecordRepository.updateInPlace()`'s `expectedApprovalStatus`): without
   * it, `ContentTemplatesService.update()`'s own terminal-state check reads `approvalStatus` into
   * application memory, but the actual write here would still be unconditional — a concurrent
   * `updateApprovalStatus()` transition landing between that read and this write could let an
   * edit silently succeed against what is now an archived/superseded row (code-review finding).
   */
  async update(
    id: string,
    patch: Partial<ContentTemplateUpdateFields>,
    expectedApprovalStatus?: ContentTemplateApprovalStatus,
  ): Promise<ContentTemplateEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      where.approvalStatus = expectedApprovalStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(
      { ...patch, version: literal("version + 1") },
      { where, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ContentTemplateEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `PersonaRepository.updateStatus()`'s/`ServiceRepository.updateStatus()`'s own conditional-
   *  `UPDATE` pattern exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`.
   *  Prevents two concurrent approvers from both reading the same `expectedCurrentStatus` and
   *  both "succeeding". Does not touch `version` — only content edits via `update()` increment it
   *  (D4/D5), and does not touch `isPublished`/`publishedAt` — orthogonal (D2). */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: ContentTemplateApprovalStatus,
    nextStatus: ContentTemplateApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdateContentTemplateStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<ContentTemplateEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ContentTemplateEntity>(current) };
  }

  /**
   * Atomic compare-and-swap on `(id, isPublished)` — mirrors `InternalLinkRepository.updateStatus()`'s
   * own conditional-`UPDATE`-plus-conditional-`COALESCE`-stamp pattern exactly (D2), itself
   * mirroring `IdempotencyKeyRepository.reserve()`. Prevents a concurrent double-publish or
   * double-unpublish from both reading the same `expectedIsPublished` and both "succeeding".
   *
   * When `nextIsPublished === true`, `publishedAt` is stamped in the SAME atomic `UPDATE` via
   * `COALESCE("published_at", NOW())` — "stamp once, never overwrite" (D2): a later
   * unpublish-then-republish cycle does NOT reset `publishedAt` to the later time. When
   * `nextIsPublished === false`, `publishedAt` is left untouched entirely (no assignment at all,
   * not even a no-op one), preserving it as permanent history of the first publish.
   *
   * `expectedApprovalStatus` is an optional second CAS guard, passed only by `publish()` (D2's
   * "only an `approved` template may be published" rule) — `unpublish()` never passes it, since
   * D2 gives unpublish no status restriction. Without it, `publish()`'s own upfront
   * `approvalStatus === "approved"` check reads the status into application memory, but this
   * write was still unconditional on it — a concurrent `updateApprovalStatus()` transition (e.g.
   * `approved -> archived`) landing between that read and this write could let the publish still
   * succeed, since `isPublished` alone was still `false` (code-review finding): the template would
   * end up `archived`/`superseded` yet `isPublished: true`, the exact state the migration's own
   * doc comment says the application layer must prevent.
   */
  async updatePublishState(
    id: string,
    expectedIsPublished: boolean,
    nextIsPublished: boolean,
    updatedBy: string | null,
    expectedApprovalStatus?: ContentTemplateApprovalStatus,
  ): Promise<UpdateContentTemplatePublishStateResult> {
    const values: Record<string, unknown> = { isPublished: nextIsPublished, updatedBy };
    if (nextIsPublished) {
      values.publishedAt = literal('COALESCE("published_at", NOW())');
    }

    const where: Record<string, unknown> = { id, isPublished: expectedIsPublished };
    if (expectedApprovalStatus) {
      where.approvalStatus = expectedApprovalStatus;
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where,
      returning: true,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<ContentTemplateEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ContentTemplateEntity>(current) };
  }
}
