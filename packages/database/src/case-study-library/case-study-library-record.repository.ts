import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getCaseStudyLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { CaseStudyLibraryRecordEntity, CaseStudyLibraryTestimonial } from "./entities.js";

/** The three array/JSONB fields additionally accept an explicit `null` — meaning "clear to
 *  empty" — matching the scalar-field null-to-clear convention, same shape as
 *  `CaseStudyArrayFieldOverrides`/`ProofClaimArrayFieldOverrides`. */
type CaseStudyLibraryRecordFieldOverrides = {
  readonly relatedPageIds?: readonly string[] | null;
  readonly technologies?: readonly string[] | null;
  readonly testimonials?: readonly CaseStudyLibraryTestimonial[] | null;
};

/** Every field a caller may set/change, i.e. `CaseStudyLibraryRecordEntity` minus its
 *  server-only-managed columns (`id`, `createdAt`, `updatedAt`) — derived, not hand-retyped,
 *  mirroring `CaseStudyContentFields`'s own precedent, so a future field added to
 *  `CaseStudyLibraryRecordEntity` is a compile error here until it's also handled by
 *  `create()`/`update()`. */
type CaseStudyLibraryRecordContentFields = Omit<
  CaseStudyLibraryRecordEntity,
  "id" | "createdAt" | "updatedAt" | "relatedPageIds" | "technologies" | "testimonials"
> &
  CaseStudyLibraryRecordFieldOverrides;

/** `update()`'s patch shape: every content field is optional (a partial edit); `publicId` and
 *  `caseStudyId` are excluded — both immutable after create (a library record's identity IS the
 *  case study it extends; re-pointing it at a different case study would be a delete+create). */
type CaseStudyLibraryRecordUpdateFields = Omit<
  CaseStudyLibraryRecordContentFields,
  "publicId" | "caseStudyId"
>;

export interface CaseStudyLibraryRecordListFilter {
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// Mirrors CaseStudyRepository's/ServiceRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 *  Case Study Studio's own precedent (D1). */
export class CaseStudyLibraryRecordRepository {
  private readonly model = getCaseStudyLibraryModels().CaseStudyLibraryRecord;

  async create(
    input: Partial<CaseStudyLibraryRecordContentFields> &
      Pick<CaseStudyLibraryRecordContentFields, "publicId" | "caseStudyId">,
  ): Promise<CaseStudyLibraryRecordEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      caseStudyId: input.caseStudyId,
      relatedPageIds: input.relatedPageIds ?? [],
      technologies: input.technologies ?? [],
      testimonials: input.testimonials ?? [],
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<CaseStudyLibraryRecordEntity>(instance);
  }

  async findById(id: string): Promise<CaseStudyLibraryRecordEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<CaseStudyLibraryRecordEntity>(instance) : null;
  }

  async findByCaseStudyId(caseStudyId: string): Promise<CaseStudyLibraryRecordEntity | null> {
    const instance = await this.model.findOne({ where: { caseStudyId } });
    return instance ? toEntityWithIsoDates<CaseStudyLibraryRecordEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<CaseStudyLibraryRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<CaseStudyLibraryRecordEntity>(instance) : null;
  }

  /** `search` matches on `technologies` (array-contains-like, via a cast to text) and each
   *  testimonial's `quote` (JSONB text search) — the only free-text content this table owns. */
  async list(
    filter: CaseStudyLibraryRecordListFilter = {},
  ): Promise<readonly CaseStudyLibraryRecordEntity[]> {
    const where: Record<string | symbol, unknown> = {};
    if (filter.search) {
      const pattern = `%${escapeLikePattern(filter.search)}%`;
      where[Op.or] = [
        this.model.sequelize!.where(
          this.model.sequelize!.cast(this.model.sequelize!.col("technologies"), "text"),
          { [Op.iLike]: pattern },
        ),
        this.model.sequelize!.where(
          this.model.sequelize!.cast(this.model.sequelize!.col("testimonials"), "text"),
          { [Op.iLike]: pattern },
        ),
      ];
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching every sibling module's own established precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<CaseStudyLibraryRecordEntity>(row));
  }

  /** The three array/JSONB columns are NOT NULL — an explicit `null` in the patch means "clear to
   *  empty", not "store null"; `undefined` (the key omitted entirely) is left untouched, mirroring
   *  `CaseStudyRepository.update()`'s own normalization exactly. A single atomic
   *  `UPDATE ... RETURNING`. */
  async update(
    id: string,
    patch: Partial<CaseStudyLibraryRecordUpdateFields>,
  ): Promise<CaseStudyLibraryRecordEntity | null> {
    const normalized: Record<string, unknown> = { ...patch };
    if (patch.relatedPageIds !== undefined) {
      normalized.relatedPageIds = patch.relatedPageIds ?? [];
    }
    if (patch.technologies !== undefined) {
      normalized.technologies = patch.technologies ?? [];
    }
    if (patch.testimonials !== undefined) {
      normalized.testimonials = patch.testimonials ?? [];
    }

    const [affectedCount, affectedRows] = await this.model.update(normalized, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<CaseStudyLibraryRecordEntity>(affectedRows[0]);
  }
}

export type { CaseStudyLibraryTestimonial };
