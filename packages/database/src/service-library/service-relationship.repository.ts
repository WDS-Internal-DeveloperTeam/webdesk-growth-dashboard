import type { Transaction } from "sequelize";
import { getServiceLibraryModels } from "./models.js";

/** Manages the three join tables between `services` and its dimension tables
 *  (`service_deliverables`, `service_platforms`, `service_engagement_models`) — structurally
 *  identical `(service_id, other_id)` pairs, so one repository handles all three rather than three
 *  near-duplicate files. `replace*()` fully replaces a service's linked set in one transaction
 *  (delete all existing links, insert the new set) — the simplest correct semantics for an
 *  "edit this service's deliverables" form field, avoiding a proliferation of individual
 *  attach/detach endpoints for V1. */
export class ServiceRelationshipRepository {
  private get models() {
    return getServiceLibraryModels();
  }

  async replaceDeliverables(
    serviceId: string,
    deliverableIds: readonly string[],
    transaction: Transaction,
  ): Promise<void> {
    const model = this.models.ServiceDeliverable;
    await model.destroy({ where: { serviceId }, transaction });
    if (deliverableIds.length > 0) {
      await model.bulkCreate(
        deliverableIds.map((deliverableId) => ({ serviceId, deliverableId })),
        { transaction },
      );
    }
  }

  async replacePlatforms(
    serviceId: string,
    platformIds: readonly string[],
    transaction: Transaction,
  ): Promise<void> {
    const model = this.models.ServicePlatform;
    await model.destroy({ where: { serviceId }, transaction });
    if (platformIds.length > 0) {
      await model.bulkCreate(
        platformIds.map((platformId) => ({ serviceId, platformId })),
        { transaction },
      );
    }
  }

  async replaceEngagementModels(
    serviceId: string,
    engagementModelIds: readonly string[],
    transaction: Transaction,
  ): Promise<void> {
    const model = this.models.ServiceEngagementModel;
    await model.destroy({ where: { serviceId }, transaction });
    if (engagementModelIds.length > 0) {
      await model.bulkCreate(
        engagementModelIds.map((engagementModelId) => ({ serviceId, engagementModelId })),
        { transaction },
      );
    }
  }

  async listDeliverableIds(serviceId: string): Promise<readonly string[]> {
    const rows = await this.models.ServiceDeliverable.findAll({
      where: { serviceId },
      attributes: ["deliverableId"],
    });
    return rows.map((row) => row.get("deliverableId") as string);
  }

  async listPlatformIds(serviceId: string): Promise<readonly string[]> {
    const rows = await this.models.ServicePlatform.findAll({
      where: { serviceId },
      attributes: ["platformId"],
    });
    return rows.map((row) => row.get("platformId") as string);
  }

  async listEngagementModelIds(serviceId: string): Promise<readonly string[]> {
    const rows = await this.models.ServiceEngagementModel.findAll({
      where: { serviceId },
      attributes: ["engagementModelId"],
    });
    return rows.map((row) => row.get("engagementModelId") as string);
  }
}
