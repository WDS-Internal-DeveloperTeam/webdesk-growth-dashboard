import { Inject, Injectable } from "@nestjs/common";
import type {
  DeliverableEntity,
  DeliverableRepository,
  EngagementModelEntity,
  EngagementModelRepository,
  PlatformTechnologyEntity,
  PlatformTechnologyRepository,
  ServiceCategoryEntity,
  ServiceCategoryRepository,
} from "@webdesk/database";
import {
  DELIVERABLE_REPOSITORY,
  ENGAGEMENT_MODEL_REPOSITORY,
  PLATFORM_TECHNOLOGY_REPOSITORY,
  SERVICE_CATEGORY_REPOSITORY,
} from "./service-library.constants.js";

/** Read-only in this pass (task package §3/§7) — authoring categories/deliverables/platforms/
 *  engagement models is deferred unless a real need surfaces; a service is a real service
 *  regardless of a discovered dimension row, so V1 ships without a UI or API to create them. */
@Injectable()
export class ServiceLibraryDimensionsService {
  constructor(
    @Inject(SERVICE_CATEGORY_REPOSITORY) private readonly categories: ServiceCategoryRepository,
    @Inject(DELIVERABLE_REPOSITORY) private readonly deliverables: DeliverableRepository,
    @Inject(PLATFORM_TECHNOLOGY_REPOSITORY)
    private readonly platforms: PlatformTechnologyRepository,
    @Inject(ENGAGEMENT_MODEL_REPOSITORY)
    private readonly engagementModels: EngagementModelRepository,
  ) {}

  async listCategories(): Promise<readonly ServiceCategoryEntity[]> {
    return this.categories.list();
  }

  async listDeliverables(): Promise<readonly DeliverableEntity[]> {
    return this.deliverables.list();
  }

  async listPlatforms(): Promise<readonly PlatformTechnologyEntity[]> {
    return this.platforms.list();
  }

  async listEngagementModels(): Promise<readonly EngagementModelEntity[]> {
    return this.engagementModels.list();
  }
}
