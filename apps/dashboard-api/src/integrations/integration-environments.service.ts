import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  IntegrationEnvironmentEntity,
  IntegrationEnvironmentListFilter,
  IntegrationEnvironmentRepository,
  IntegrationRepository,
} from "@webdesk/database";
import {
  INTEGRATION_ENVIRONMENT_REPOSITORY,
  INTEGRATION_REPOSITORY,
} from "./integrations.constants.js";
import type {
  CreateIntegrationEnvironmentDto,
  UpdateIntegrationEnvironmentDto,
} from "./integrations.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/** A real one-to-many sub-resource — full CRUD, real delete (D-schema: a config row, not a
 *  historical record needing retention), mirroring `ProjectEnvironmentsService`'s own structure. */
@Injectable()
export class IntegrationEnvironmentsService {
  constructor(
    @Inject(INTEGRATION_REPOSITORY) private readonly integrations: IntegrationRepository,
    @Inject(INTEGRATION_ENVIRONMENT_REPOSITORY)
    private readonly environments: IntegrationEnvironmentRepository,
    private readonly auditService: AuditService,
  ) {}

  private async assertIntegrationExists(integrationId: string): Promise<void> {
    const exists = await this.integrations.existsById(integrationId);
    if (!exists) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }
  }

  async create(
    integrationId: string,
    input: CreateIntegrationEnvironmentDto,
    actorUserId: string,
  ): Promise<IntegrationEnvironmentEntity> {
    await this.assertIntegrationExists(integrationId);

    const created = await this.environments.create({ integrationId, ...input });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "integration_environment",
      entityId: created.id,
      action: "create",
      afterState: { integrationId, environmentName: created.environmentName },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async listByIntegration(
    integrationId: string,
    filter: IntegrationEnvironmentListFilter = {},
  ): Promise<readonly IntegrationEnvironmentEntity[]> {
    await this.assertIntegrationExists(integrationId);
    return this.environments.listByIntegration(integrationId, filter);
  }

  async findById(id: string, integrationId: string): Promise<IntegrationEnvironmentEntity> {
    const environment = await this.environments.findById(id, integrationId);
    if (!environment) {
      throw new NotFoundException(`Integration environment not found: ${id}`);
    }
    return environment;
  }

  async update(
    id: string,
    integrationId: string,
    patch: UpdateIntegrationEnvironmentDto,
    actorUserId: string,
  ): Promise<IntegrationEnvironmentEntity> {
    const updated = await this.environments.update(id, integrationId, patch);
    if (!updated) {
      throw new NotFoundException(`Integration environment not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "integration_environment",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async remove(id: string, integrationId: string, actorUserId: string): Promise<void> {
    const removed = await this.environments.remove(id, integrationId);
    if (!removed) {
      throw new NotFoundException(`Integration environment not found: ${id}`);
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "integration_environment",
        entityId: id,
        action: "delete",
        afterState: { integrationId },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Integration environment ${id} deletion committed, but recording its audit event failed:`,
        error,
      );
    }
  }
}
