import { getReleaseCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ReleaseArtifactEntity } from "./entities.js";

export interface ReleaseArtifactListFilter {
  /** Required — artifacts are always browsed within one release. */
  readonly releaseId: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** `create()`'s input, derived from `ReleaseArtifactEntity` itself (not hand-typed) — code-review
 *  finding: a hand-typed input object gave no compile-time signal when the entity gained/renamed a
 *  field, unlike `ReleaseRepository.create()`'s own `Omit`-derived pattern. */
export type CreateReleaseArtifactInput = Omit<
  ReleaseArtifactEntity,
  "id" | "createdAt" | "updatedAt" | "prUrl" | "createdBy"
> &
  Partial<Pick<ReleaseArtifactEntity, "prUrl" | "createdBy">>;

/** A real one-to-many child of `releases` ("repositories and SHAs, PRs") — mirrors
 *  `CaseStudyConsentRepository`'s own "scoped to parent id" create/list/delete shape (no `update()`
 *  — the task package names create/list/delete only). */
export class ReleaseArtifactRepository {
  private readonly model = getReleaseCenterModels().ReleaseArtifact;

  async create(input: CreateReleaseArtifactInput): Promise<ReleaseArtifactEntity> {
    const instance = await this.model.create({
      releaseId: input.releaseId,
      projectId: input.projectId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      prUrl: input.prUrl ?? null,
      createdBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ReleaseArtifactEntity>(instance);
  }

  async findById(id: string): Promise<ReleaseArtifactEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ReleaseArtifactEntity>(instance) : null;
  }

  async list(filter: ReleaseArtifactListFilter): Promise<readonly ReleaseArtifactEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { releaseId: filter.releaseId },
      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ReleaseArtifactEntity>(row));
  }

  /** `releaseId`-scoped (IDOR prevention) — an artifact from a different release, accessed via
   *  this release's own route, is treated as not found rather than silently removed. */
  async remove(id: string, releaseId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, releaseId } });
    return count > 0;
  }
}
