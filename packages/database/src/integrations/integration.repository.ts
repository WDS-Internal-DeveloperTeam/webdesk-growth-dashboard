import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getIntegrationsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  IntegrationEntity,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationVerificationResult,
} from "./entities.js";

/** Every field a caller may set/change on create, i.e. `IntegrationEntity` minus its
 *  server-only-managed columns — derived, not hand-retyped, mirroring
 *  `BrandLibraryRecordContentFields`'s own precedent. */
type IntegrationContentFields = Omit<
  IntegrationEntity,
  | "id"
  | "status"
  | "lastVerifiedAt"
  | "lastVerifiedByUserId"
  | "lastVerificationResult"
  | "lastVerificationNotes"
  | "isActive"
  | "createdAt"
  | "updatedAt"
>;

/** `update()`'s patch shape — `publicId`/`provider` are excluded (both immutable after create,
 *  mirroring every sibling module's own `publicId`/discriminator-field create-only contract). */
type IntegrationUpdateFields = Omit<IntegrationContentFields, "publicId" | "provider">;

export interface IntegrationListFilter {
  readonly provider?: IntegrationProvider;
  readonly status?: IntegrationStatus;
  readonly isActive?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class IntegrationRepository {
  private readonly model = getIntegrationsModels().Integration;

  async create(
    input: Partial<IntegrationContentFields> &
      Pick<IntegrationContentFields, "publicId" | "provider" | "displayName">,
  ): Promise<IntegrationEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      provider: input.provider,
      displayName: input.displayName,
      configReference: input.configReference ?? null,
      notes: input.notes ?? null,
      status: "not_configured",
      isActive: true,
    });
    return toEntityWithIsoDates<IntegrationEntity>(instance);
  }

  async findById(id: string): Promise<IntegrationEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<IntegrationEntity>(instance) : null;
  }

  /** Narrow, read-only existence check for the sub-resource FK-existence checks
   *  (`integration_environments`/`secret_metadata` `create()`) — deliberately does not expose the
   *  full entity, mirroring `ServicesService.existingServiceIds()`'s own narrow-delegating-method
   *  precedent. */
  async existsById(id: string): Promise<boolean> {
    const count = await this.model.count({ where: { id } });
    return count > 0;
  }

  async findByPublicId(publicId: string): Promise<IntegrationEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<IntegrationEntity>(instance) : null;
  }

  async list(filter: IntegrationListFilter = {}): Promise<readonly IntegrationEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.provider) {
      where.provider = filter.provider;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.search) {
      where.displayName = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching every sibling module's own already-fixed bug class.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<IntegrationEntity>(row));
  }

  /** Content update — `status`/`lastVerified*`/`isActive` are deliberately never accepted here;
   *  only `recordVerification()`/`setActive()` may change those. */
  async update(
    id: string,
    patch: Partial<IntegrationUpdateFields>,
  ): Promise<IntegrationEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<IntegrationEntity>(affectedRows[0]);
  }

  /** Records a manual verification result (D1 — no real outbound call, an operator-recorded
   *  attestation). `status` is derived by the service layer, not this method, and passed in
   *  explicitly so the repository stays a pure data-access boundary. */
  async recordVerification(
    id: string,
    input: {
      status: IntegrationStatus;
      result: IntegrationVerificationResult;
      notes: string | null;
      verifiedByUserId: string;
    },
  ): Promise<IntegrationEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(
      {
        status: input.status,
        lastVerifiedAt: new Date(),
        lastVerifiedByUserId: input.verifiedByUserId,
        lastVerificationResult: input.result,
        lastVerificationNotes: input.notes,
      },
      { where: { id }, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<IntegrationEntity>(affectedRows[0]);
  }

  async setActive(id: string, isActive: boolean): Promise<IntegrationEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(
      { isActive },
      { where: { id }, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<IntegrationEntity>(affectedRows[0]);
  }
}
