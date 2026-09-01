import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CaseStudyEntity,
  CaseStudyLibraryRecordEntity,
  CaseStudyLibraryRecordListFilter,
  CaseStudyLibraryRecordRepository,
  CaseStudyLibraryTestimonial,
  CaseStudyStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { CASE_STUDY_LIBRARY_RECORD_REPOSITORY } from "./case-study-library.constants.js";
import type {
  CreateCaseStudyLibraryRecordDto,
  UpdateCaseStudyLibraryRecordDto,
} from "./case-study-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { CaseStudiesService } from "../case-study-studio/case-studies.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PagesService } from "../page-inventory/pages.service.js";

/** A malformed (non-UUID) id can never resolve to a real page — filtered out before querying
 *  rather than sent to Postgres, whose `uuid` column type would otherwise reject it with a raw
 *  driver error the global exception filter turns into an opaque 500 instead of a clean 400 (same
 *  guard `CaseStudiesService.assertServiceIdsExist()`/`ClaimsService.assertServiceIdsExist()` both
 *  already use for the identical reason). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** D5 — a library record may only be created once the parent case study's own `status` reaches
 *  one of these — matching the canonical spec's own framing of this module as "published and
 *  unpublished case study records." */
const CREATABLE_FROM_STATUSES: ReadonlySet<CaseStudyStatus> = new Set([
  "published",
  "unpublished",
  "archived",
]);

/** A case study library record joined with its parent case study — this module's own record never
 *  duplicates any of the parent's fields (D1), so the API response nests the full
 *  already-permission-filtered `CaseStudyEntity` under `caseStudy` instead. */
export interface CaseStudyLibraryRecordWithCaseStudy extends CaseStudyLibraryRecordEntity {
  readonly caseStudy: CaseStudyEntity | null;
}

@Injectable()
export class CaseStudyLibraryService {
  constructor(
    @Inject(CASE_STUDY_LIBRARY_RECORD_REPOSITORY)
    private readonly records: CaseStudyLibraryRecordRepository,
    private readonly caseStudies: CaseStudiesService,
    private readonly pages: PagesService,
    private readonly auditService: AuditService,
  ) {}

  /** The Zod DTO's `.nullish()` testimonial fields (`author`/`role`) allow `undefined` (field
   *  omitted) as well as `null` (explicitly cleared) — `CaseStudyLibraryTestimonial` only accepts
   *  `string | null`, matching every other nullable field's own repository-layer convention, so
   *  `undefined` is normalized to `null` here rather than widening the entity's own type. */
  private normalizeTestimonials(
    testimonials:
      readonly { quote: string; author?: string | null; role?: string | null }[] | null | undefined,
  ): readonly CaseStudyLibraryTestimonial[] | null | undefined {
    if (testimonials === undefined || testimonials === null) {
      return testimonials;
    }
    return testimonials.map((testimonial) => ({
      quote: testimonial.quote,
      author: testimonial.author ?? null,
      role: testimonial.role ?? null,
    }));
  }

  /** Mirrors `CaseStudiesService.assertServiceIdsExist()`'s own already-reviewed shape — a
   *  byte-for-byte copy is accepted, tracked debt across this codebase; a real fix means a shared
   *  `@webdesk/validation` helper, out of proportion for a new module's own first build. */
  private async assertPageIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const wellFormedIds = ids.filter((id) => UUID_PATTERN.test(id));
    const foundIds =
      wellFormedIds.length > 0
        ? await this.pages.existingPageIds(wellFormedIds)
        : new Set<string>();
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`relatedPageIds not found: ${missing.join(", ")}`);
    }
  }

  async create(
    input: CreateCaseStudyLibraryRecordDto,
    actorUserId: string,
  ): Promise<CaseStudyLibraryRecordWithCaseStudy> {
    // caseStudies.findById() throws NotFoundException (propagates) if the parent doesn't exist —
    // let it. Independent checks run concurrently, matching ServicesService.create()'s/
    // CaseStudiesService.create()'s own established pattern.
    const [caseStudy, existingRecord, existingPublicId] = await Promise.all([
      this.caseStudies.findById(input.caseStudyId),
      this.records.findByCaseStudyId(input.caseStudyId),
      this.records.findByPublicId(input.publicId),
      this.assertPageIdsExist(input.relatedPageIds),
    ]);

    if (!CREATABLE_FROM_STATUSES.has(caseStudy.status)) {
      throw new BadRequestException(
        `Case study ${input.caseStudyId} must be published, unpublished, or archived before a ` +
          `library record can be created for it (current status: ${caseStudy.status})`,
      );
    }
    if (existingRecord) {
      throw new ConflictException(
        `A library record already exists for case study ${input.caseStudyId}`,
      );
    }
    if (existingPublicId) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: CaseStudyLibraryRecordEntity;
    try {
      created = await this.records.create({
        ...input,
        testimonials: this.normalizeTestimonials(input.testimonials),
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId/caseStudyId uniqueness checks above are TOCTOU (two concurrent creates can
      // both pass them before either INSERT commits) — the real unique indexes catch the race
      // loser, but without this catch it would otherwise surface as a raw 500 instead of a clean
      // 409/400, mirroring every sibling create()'s own established pattern.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new ConflictException(
          `publicId already in use, or a library record already exists for case study ` +
            `${input.caseStudyId}`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_library_record",
      entityId: created.id,
      action: "create",
      afterState: { caseStudyId: created.caseStudyId },
      retentionCategory: "audit-7y",
    });

    return { ...created, caseStudy };
  }

  private async findEntityById(id: string): Promise<CaseStudyLibraryRecordEntity> {
    const record = await this.records.findById(id);
    if (!record) {
      throw new NotFoundException(`Case study library record not found: ${id}`);
    }
    return record;
  }

  async findById(id: string): Promise<CaseStudyLibraryRecordWithCaseStudy> {
    const record = await this.findEntityById(id);
    const caseStudy = await this.caseStudies.findById(record.caseStudyId);
    return { ...record, caseStudy };
  }

  /**
   * List enrichment strategy (judgment call — `CaseStudiesService` has no batch `findByIds()`
   * today, unlike `ServicesService.existingServiceIds()`/`PagesService.existingPageIds()`, since
   * those only ever need a bare `Set<string>` of found ids, not full enriched entities). Resolving
   * one at a time via `Promise.allSettled`, degrading a single failed lookup to `null` rather than
   * crashing the whole list, is less code than adding a new batch method to `CaseStudiesService`
   * for a single caller, and matches this codebase's own standing feedback about failure isolation
   * on enrichment fetches (e.g. `getUsersByIds()`'s `Promise.allSettled` precedent in
   * `dashboard-web`). Every `case_study_id` here is backed by a real DB-level FK with `RESTRICT`
   * on delete, so a genuinely missing parent should never happen in practice — this is
   * defense-in-depth, not an expected path.
   */
  async list(
    filter: CaseStudyLibraryRecordListFilter,
  ): Promise<readonly CaseStudyLibraryRecordWithCaseStudy[]> {
    const records = await this.records.list(filter);
    const settled = await Promise.allSettled(
      records.map((record) => this.caseStudies.findById(record.caseStudyId)),
    );
    return records.map((record, index) => {
      const result = settled[index];
      return {
        ...record,
        caseStudy: result?.status === "fulfilled" ? result.value : null,
      };
    });
  }

  /** Content update — no status of its own to guard (D1: this record has no independent lifecycle,
   *  it always reads the parent case study's status). */
  async update(
    id: string,
    patch: UpdateCaseStudyLibraryRecordDto,
    actorUserId: string,
  ): Promise<CaseStudyLibraryRecordWithCaseStudy> {
    const [current] = await Promise.all([
      this.findEntityById(id),
      this.assertPageIdsExist(patch.relatedPageIds),
    ]);

    const updated = await this.records.update(id, {
      ...patch,
      testimonials: this.normalizeTestimonials(patch.testimonials),
      updatedBy: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Case study library record not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_library_record",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    const caseStudy = await this.caseStudies.findById(current.caseStudyId);
    return { ...updated, caseStudy };
  }
}
