import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface OperationalContactsModels {
  readonly OperationalContact: ModelStatic<Model>;
  readonly IncidentSeverityPolicy: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, OperationalContactsModels>();

export function getOperationalContactsModels(
  sequelize: Sequelize = getConnection(),
): OperationalContactsModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const OperationalContact = sequelize.define(
    "OperationalContact",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      contactUserId: { type: DataTypes.UUID, allowNull: true },
      contactName: { type: DataTypes.STRING(255), allowNull: true },
      contactEmail: { type: DataTypes.STRING(255), allowNull: true },
      contactPhone: { type: DataTypes.STRING(64), allowNull: true },
      area: { type: DataTypes.STRING(64), allowNull: false },
      role: { type: DataTypes.ENUM("primary", "backup"), allowNull: false },
      escalationPriority: { type: DataTypes.INTEGER, allowNull: false },
      channelPreference: { type: DataTypes.STRING(32), allowNull: true },
      severityApplicability: { type: DataTypes.JSONB, allowNull: true },
      workingHoursStart: { type: DataTypes.TIME, allowNull: true },
      workingHoursEnd: { type: DataTypes.TIME, allowNull: true },
      timeZone: { type: DataTypes.STRING(64), allowNull: true },
      effectiveStartDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      effectiveEndDate: { type: DataTypes.DATE, allowNull: true },
      activeStatus: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      verificationStatus: {
        type: DataTypes.ENUM("unverified", "verified", "failed"),
        allowNull: false,
        defaultValue: "unverified",
      },
    },
    {
      tableName: "operational_contacts",
      underscored: true,
      timestamps: true,
    },
  );

  const IncidentSeverityPolicy = sequelize.define(
    "IncidentSeverityPolicy",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      severity: {
        type: DataTypes.ENUM("critical", "high", "medium", "low"),
        allowNull: false,
      },
      responseTargetValue: { type: DataTypes.INTEGER, allowNull: true },
      responseTargetUnit: {
        type: DataTypes.ENUM("minutes", "hours", "business_days"),
        allowNull: true,
      },
      responseTargetDescription: { type: DataTypes.TEXT, allowNull: false },
      isFixedDuration: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "incident_severity_policies",
      underscored: true,
      timestamps: true,
    },
  );

  const models: OperationalContactsModels = { OperationalContact, IncidentSeverityPolicy };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetOperationalContactsModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
