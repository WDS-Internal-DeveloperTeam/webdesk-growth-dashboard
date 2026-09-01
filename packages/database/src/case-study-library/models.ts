import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface CaseStudyLibraryModels {
  readonly CaseStudyLibraryRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, CaseStudyLibraryModels>();

export function getCaseStudyLibraryModels(
  sequelize: Sequelize = getConnection(),
): CaseStudyLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const CaseStudyLibraryRecord = sequelize.define(
    "CaseStudyLibraryRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      caseStudyId: { type: DataTypes.UUID, allowNull: false },
      relatedPageIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      technologies: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      testimonials: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "case_study_library_records", underscored: true, timestamps: true },
  );

  const models: CaseStudyLibraryModels = { CaseStudyLibraryRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  case-study-studio/models.ts's own `resetCaseStudyStudioModelsForTests`. */
export function resetCaseStudyLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
