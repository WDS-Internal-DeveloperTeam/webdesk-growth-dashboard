import { getPageInventoryModels } from "../page-inventory/models.js";
import { toEntityWithIsoDates } from "../page-inventory/entity-mapping.js";
import type { PageEntity } from "../page-inventory/entities.js";
import type { PageLifecycleStage } from "./entities.js";

export type UpdateLifecycleStageResult =
  | { readonly outcome: "updated"; readonly entity: PageEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: PageEntity };

/**
 * The page DELIVERY lifecycle (`05_Workflow_State_Machines.md §3`, task package D4/D5).
 *
 * Physically these are `pages` columns, so the Sequelize model lives in Page Inventory — but the
 * lifecycle itself is Page Workspace's concept, so the transition logic lives here and in
 * `PageLifecycleService`, leaving Page Inventory's own repository untouched. Reading the model
 * across the module boundary (rather than duplicating a second `pages` model) keeps one
 * definition of the table.
 */
export class PageLifecycleRepository {
  private readonly model = getPageInventoryModels().Page;

  async findById(id: string, projectId: string): Promise<PageEntity | null> {
    const instance = await this.model.findOne({ where: { id, projectId } });
    return instance ? toEntityWithIsoDates<PageEntity>(instance) : null;
  }

  /**
   * Atomic compare-and-swap on `(id, projectId, lifecycleStage)`, the same pattern every other
   * status transition in this codebase uses. Two reviewers who both read the same
   * `expectedCurrentStage` cannot both succeed — the loser gets `conflict`, which the service
   * surfaces as a real 409 rather than a silent overwrite.
   *
   * `lifecyclePreviousStage` is written in the same statement so it can never drift from the
   * stage it describes: entering `paused`/`blocked` stamps where the page came from, and any
   * other transition clears it.
   */
  async updateLifecycleStage(
    id: string,
    projectId: string,
    expectedCurrentStage: PageLifecycleStage,
    nextStage: PageLifecycleStage,
    nextPreviousStage: PageLifecycleStage | null,
    actorUserId: string | null,
  ): Promise<UpdateLifecycleStageResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      {
        lifecycleStage: nextStage,
        lifecyclePreviousStage: nextPreviousStage,
        updatedBy: actorUserId,
      },
      { where: { id, projectId, lifecycleStage: expectedCurrentStage }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toEntityWithIsoDates<PageEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id, projectId } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<PageEntity>(current) };
  }
}
