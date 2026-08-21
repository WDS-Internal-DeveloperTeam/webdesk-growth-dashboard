import type { Model, ModelStatic, Transaction } from "sequelize";
import { getServiceLibraryModels } from "./models.js";

/** Manages the three join tables between `services` and its dimension tables
 *  (`service_deliverables`, `service_platforms`, `service_engagement_models`) — structurally
 *  identical `(service_id, other_id)` pairs, so one repository handles all three via two shared
 *  generic helpers (`replaceJoinRows`/`listJoinIds`) rather than six hand-copied methods
 *  (code-review finding, `module-service-library`). `replace*()` fully replaces a service's
 *  linked set in one transaction (delete all existing links, insert the new set) — the simplest
 *  correct semantics for an "edit this service's deliverables" form field, avoiding a
 *  proliferation of individual attach/detach endpoints for V1. */
export class ServiceRelationshipRepository {
  private get models() {
    return getServiceLibraryModels();
  }

  /** `skipDestroy` lets a caller that already knows the join rows can't exist yet (a service just
   *  inserted in the same transaction) skip a guaranteed-no-op `DELETE` (code-review finding). */
  private async replaceJoinRows(
    model: ModelStatic<Model>,
    serviceId: string,
    otherIdField: string,
    ids: readonly string[],
    transaction: Transaction,
    skipDestroy = false,
  ): Promise<void> {
    if (!skipDestroy) {
      await model.destroy({ where: { serviceId }, transaction });
    }
    if (ids.length > 0) {
      await model.bulkCreate(
        ids.map((otherId) => ({ serviceId, [otherIdField]: otherId })),
        { transaction },
      );
    }
  }

  private async listJoinIds(
    model: ModelStatic<Model>,
    serviceId: string,
    otherIdField: string,
  ): Promise<readonly string[]> {
    const rows = await model.findAll({ where: { serviceId }, attributes: [otherIdField] });
    return rows.map((row) => row.get(otherIdField) as string);
  }

  async replaceDeliverables(
    serviceId: string,
    deliverableIds: readonly string[],
    transaction: Transaction,
    options?: { readonly skipDestroy?: boolean },
  ): Promise<void> {
    await this.replaceJoinRows(
      this.models.ServiceDeliverable,
      serviceId,
      "deliverableId",
      deliverableIds,
      transaction,
      options?.skipDestroy,
    );
  }

  async replacePlatforms(
    serviceId: string,
    platformIds: readonly string[],
    transaction: Transaction,
    options?: { readonly skipDestroy?: boolean },
  ): Promise<void> {
    await this.replaceJoinRows(
      this.models.ServicePlatform,
      serviceId,
      "platformId",
      platformIds,
      transaction,
      options?.skipDestroy,
    );
  }

  async replaceEngagementModels(
    serviceId: string,
    engagementModelIds: readonly string[],
    transaction: Transaction,
    options?: { readonly skipDestroy?: boolean },
  ): Promise<void> {
    await this.replaceJoinRows(
      this.models.ServiceEngagementModel,
      serviceId,
      "engagementModelId",
      engagementModelIds,
      transaction,
      options?.skipDestroy,
    );
  }

  async listDeliverableIds(serviceId: string): Promise<readonly string[]> {
    return this.listJoinIds(this.models.ServiceDeliverable, serviceId, "deliverableId");
  }

  async listPlatformIds(serviceId: string): Promise<readonly string[]> {
    return this.listJoinIds(this.models.ServicePlatform, serviceId, "platformId");
  }

  async listEngagementModelIds(serviceId: string): Promise<readonly string[]> {
    return this.listJoinIds(this.models.ServiceEngagementModel, serviceId, "engagementModelId");
  }
}
