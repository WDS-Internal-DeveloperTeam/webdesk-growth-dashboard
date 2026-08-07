import type { Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { EmergencyAdminCredentialEntity } from "./entities.js";

function toEntity(instance: Model): EmergencyAdminCredentialEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    userId: json.userId as string,
    passwordHash: json.passwordHash as string,
    totpSecretEncrypted: json.totpSecretEncrypted as string,
    totpEnrolledAt: json.totpEnrolledAt instanceof Date ? json.totpEnrolledAt.toISOString() : null,
    status: json.status as EmergencyAdminCredentialEntity["status"],
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/**
 * ADR-0009 — one row per emergency-admin `users` record. Rows are created
 * only by the operator-run provisioning script
 * (apps/dashboard-api/src/auth/scripts/provision-emergency-admin.ts), never
 * via an HTTP endpoint — "no self-service creation of an emergency-admin
 * account" (knowledge/05).
 */
export class EmergencyAdminCredentialRepository {
  private readonly model = getAuthModels().EmergencyAdminCredential;

  async findByUserId(userId: string): Promise<EmergencyAdminCredentialEntity | null> {
    const instance = await this.model.findOne({ where: { userId } });
    return instance ? toEntity(instance) : null;
  }

  async create(input: {
    userId: string;
    passwordHash: string;
    totpSecretEncrypted: string;
    totpEnrolledAt?: Date;
  }): Promise<EmergencyAdminCredentialEntity> {
    const instance = await this.model.create(input);
    return toEntity(instance);
  }

  async setStatus(id: string, status: "active" | "disabled"): Promise<void> {
    await this.model.update({ status }, { where: { id } });
  }
}
