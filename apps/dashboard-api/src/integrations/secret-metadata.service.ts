import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  IntegrationRepository,
  SecretMetadataEntity,
  SecretMetadataListFilter,
  SecretMetadataRepository,
} from "@webdesk/database";
import { INTEGRATION_REPOSITORY, SECRET_METADATA_REPOSITORY } from "./integrations.constants.js";
import type { CreateSecretMetadataDto, UpdateSecretMetadataDto } from "./integrations.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : new Date(value);
}

/** Tracks which secret exists for an integration, never the value (D-schema, the module
 *  registry's own seeded confidentiality note). Full CRUD, real delete — pure metadata, no
 *  compliance/audit reason to retain a deleted row — but deletion is itself an `edit`-gated,
 *  audited action. */
@Injectable()
export class SecretMetadataService {
  constructor(
    @Inject(INTEGRATION_REPOSITORY) private readonly integrations: IntegrationRepository,
    @Inject(SECRET_METADATA_REPOSITORY)
    private readonly secrets: SecretMetadataRepository,
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
    input: CreateSecretMetadataDto,
    actorUserId: string,
  ): Promise<SecretMetadataEntity> {
    await this.assertIntegrationExists(integrationId);

    const created = await this.secrets.create({
      integrationId,
      secretName: input.secretName,
      storageLocation: input.storageLocation,
      lastRotatedAt: toDate(input.lastRotatedAt) ?? null,
      rotationDueAt: toDate(input.rotationDueAt) ?? null,
      notes: input.notes,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "secret_metadata",
      entityId: created.id,
      action: "create",
      afterState: { integrationId, secretName: created.secretName },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async listByIntegration(
    integrationId: string,
    filter: SecretMetadataListFilter = {},
  ): Promise<readonly SecretMetadataEntity[]> {
    await this.assertIntegrationExists(integrationId);
    return this.secrets.listByIntegration(integrationId, filter);
  }

  async findById(id: string, integrationId: string): Promise<SecretMetadataEntity> {
    const secret = await this.secrets.findById(id, integrationId);
    if (!secret) {
      throw new NotFoundException(`Secret metadata not found: ${id}`);
    }
    return secret;
  }

  async update(
    id: string,
    integrationId: string,
    patch: UpdateSecretMetadataDto,
    actorUserId: string,
  ): Promise<SecretMetadataEntity> {
    const updated = await this.secrets.update(id, integrationId, {
      ...patch,
      lastRotatedAt: toDate(patch.lastRotatedAt),
      rotationDueAt: toDate(patch.rotationDueAt),
    });
    if (!updated) {
      throw new NotFoundException(`Secret metadata not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "secret_metadata",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async remove(id: string, integrationId: string, actorUserId: string): Promise<void> {
    const removed = await this.secrets.remove(id, integrationId);
    if (!removed) {
      throw new NotFoundException(`Secret metadata not found: ${id}`);
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "secret_metadata",
        entityId: id,
        action: "delete",
        afterState: { integrationId },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Secret metadata ${id} deletion committed, but recording its audit event failed:`,
        error,
      );
    }
  }
}
