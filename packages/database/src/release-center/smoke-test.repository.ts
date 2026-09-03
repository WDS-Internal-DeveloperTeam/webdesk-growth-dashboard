import { getReleaseCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { SmokeTestEntity } from "./entities.js";

export interface SmokeTestListFilter {
  /** Required — smoke tests are always browsed within one release. */
  readonly releaseId: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** `create()`'s input, derived from `SmokeTestEntity` itself (not hand-typed) — code-review
 *  finding: a hand-typed input object gave no compile-time signal when the entity gained/renamed a
 *  field, unlike `ReleaseRepository.create()`'s own `Omit`-derived pattern. `ranAt` is a real `Date`
 *  here (the entity's own `string` is the post-mapping ISO representation) and is optional —
 *  omitted, the database's own `DEFAULT NOW()` applies. */
export type CreateSmokeTestInput = Omit<
  SmokeTestEntity,
  "id" | "createdAt" | "updatedAt" | "ranAt" | "notes"
> & {
  readonly ranAt?: Date;
  readonly notes?: string | null;
};

/** Create/list only (ADR-0016 — no `update()`/`remove()` method exists here at all), mirroring
 *  `ScanEvidenceRepository`'s own create/list-only shape. */
export class SmokeTestRepository {
  private readonly model = getReleaseCenterModels().SmokeTest;

  async create(input: CreateSmokeTestInput): Promise<SmokeTestEntity> {
    const instance = await this.model.create({
      releaseId: input.releaseId,
      projectId: input.projectId,
      environment: input.environment,
      name: input.name,
      result: input.result,
      ...(input.ranAt ? { ranAt: input.ranAt } : {}),
      notes: input.notes ?? null,
    });
    return toEntityWithIsoDates<SmokeTestEntity>(instance);
  }

  async list(filter: SmokeTestListFilter): Promise<readonly SmokeTestEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { releaseId: filter.releaseId },
      order: [
        ["ranAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<SmokeTestEntity>(row));
  }
}
