import type { Transaction } from "sequelize";
import { getPageWorkspaceModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PageArtifactEntity, PageArtifactType } from "./entities.js";

/**
 * `page_artifacts` — the stable logical identity for one tab's artifact on one page.
 *
 * Every read and write is scoped by `projectId` in the WHERE clause, not just by primary key
 * (task package D11). This is real IDOR prevention at the persistence layer, matching the
 * pattern `ClaimSourceRepository`/`PageUrlRepository` already established: a caller authorized on
 * project A can never reach project B's artifact by guessing its id, even though `id` is a
 * globally unique primary key.
 */
export class PageArtifactRepository {
  private readonly model = getPageWorkspaceModels().PageArtifact;

  async create(
    input: {
      readonly pageId: string;
      readonly projectId: string;
      readonly artifactType: PageArtifactType;
      readonly createdBy: string | null;
    },
    transaction?: Transaction,
  ): Promise<PageArtifactEntity> {
    const instance = await this.model.create(
      {
        pageId: input.pageId,
        projectId: input.projectId,
        artifactType: input.artifactType,
        currentVersionId: null,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      },
      transaction ? { transaction } : {},
    );
    return toEntityWithIsoDates<PageArtifactEntity>(instance);
  }

  async findById(id: string, projectId: string): Promise<PageArtifactEntity | null> {
    const instance = await this.model.findOne({ where: { id, projectId } });
    return instance ? toEntityWithIsoDates<PageArtifactEntity>(instance) : null;
  }

  async findByPageAndType(
    pageId: string,
    artifactType: PageArtifactType,
    projectId: string,
  ): Promise<PageArtifactEntity | null> {
    const instance = await this.model.findOne({ where: { pageId, artifactType, projectId } });
    return instance ? toEntityWithIsoDates<PageArtifactEntity>(instance) : null;
  }

  async listForPage(pageId: string, projectId: string): Promise<readonly PageArtifactEntity[]> {
    const rows = await this.model.findAll({
      where: { pageId, projectId },
      order: [["artifactType", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<PageArtifactEntity>(row));
  }

  /** Points the artifact at its newest version. Called inside the same transaction as the version
   *  insert, so an artifact can never be left pointing at a version that was rolled back. */
  async setCurrentVersion(
    id: string,
    projectId: string,
    currentVersionId: string,
    updatedBy: string | null,
    transaction?: Transaction,
  ): Promise<PageArtifactEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(
      { currentVersionId, updatedBy },
      {
        where: { id, projectId },
        returning: true,
        ...(transaction ? { transaction } : {}),
      },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<PageArtifactEntity>(affectedRows[0]);
  }
}
