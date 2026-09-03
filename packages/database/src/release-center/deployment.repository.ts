import { getReleaseCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { DeploymentEntity } from "./entities.js";

export interface DeploymentListFilter {
  /** Required — deployments are always browsed within one release. */
  readonly releaseId: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** `create()`'s input, derived from `DeploymentEntity` itself (not hand-typed) — code-review
 *  finding: a hand-typed input object gave no compile-time signal when the entity gained/renamed a
 *  field, unlike `ReleaseRepository.create()`'s own `Omit`-derived pattern. `deployedAt` is a real
 *  `Date` here (the entity's own `string` is the post-mapping ISO representation), and is optional
 *  — omitted, the database's own `DEFAULT NOW()` applies. */
export type CreateDeploymentInput = Omit<
  DeploymentEntity,
  "id" | "createdAt" | "updatedAt" | "deployedByUserId" | "deployedAt" | "notes"
> & {
  readonly deployedByUserId?: string | null;
  readonly deployedAt?: Date;
  readonly notes?: string | null;
};

/** An append-only history of every deploy attempt (ADR-0016 — no `update()`/`remove()` method
 *  exists here at all), mirroring `ScanEvidenceRepository`'s own create/list-only shape. Real
 *  re-deploys are possible even after `releases.stagingDeployedAt`/`productionDeployedAt` are first
 *  stamped — those columns record only the FIRST success; this table records every attempt. */
export class DeploymentRepository {
  private readonly model = getReleaseCenterModels().Deployment;

  async create(input: CreateDeploymentInput): Promise<DeploymentEntity> {
    const instance = await this.model.create({
      releaseId: input.releaseId,
      projectId: input.projectId,
      environment: input.environment,
      outcome: input.outcome,
      deployedByUserId: input.deployedByUserId ?? null,
      ...(input.deployedAt ? { deployedAt: input.deployedAt } : {}),
      notes: input.notes ?? null,
    });
    return toEntityWithIsoDates<DeploymentEntity>(instance);
  }

  async list(filter: DeploymentListFilter): Promise<readonly DeploymentEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { releaseId: filter.releaseId },
      order: [
        ["deployedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<DeploymentEntity>(row));
  }
}
