import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface PersonaLibraryModels {
  readonly Persona: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, PersonaLibraryModels>();

export function getPersonaLibraryModels(
  sequelize: Sequelize = getConnection(),
): PersonaLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Persona = sequelize.define(
    "Persona",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      buyerType: { type: DataTypes.STRING(255), allowNull: true },
      companySize: { type: DataTypes.STRING(255), allowNull: true },
      roles: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
      industries: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
      geography: { type: DataTypes.STRING(255), allowNull: true },
      goals: { type: DataTypes.TEXT, allowNull: true },
      pains: { type: DataTypes.TEXT, allowNull: true },
      triggers: { type: DataTypes.TEXT, allowNull: true },
      objections: { type: DataTypes.TEXT, allowNull: true },
      decisionCriteria: { type: DataTypes.TEXT, allowNull: true },
      relatedServiceIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      badFitSignals: { type: DataTypes.TEXT, allowNull: true },
      messagingTrack: { type: DataTypes.TEXT, allowNull: true },
      ctaPreferences: { type: DataTypes.TEXT, allowNull: true },
      approvalStatus: {
        type: DataTypes.ENUM(
          "draft",
          "submitted",
          "under_review",
          "approved",
          "revision_requested",
          "rejected",
          "superseded",
          "archived",
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "personas", underscored: true, timestamps: true },
  );

  const models: PersonaLibraryModels = { Persona };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  service-library/models.ts's own `resetServiceLibraryModelsForTests`. */
export function resetPersonaLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
