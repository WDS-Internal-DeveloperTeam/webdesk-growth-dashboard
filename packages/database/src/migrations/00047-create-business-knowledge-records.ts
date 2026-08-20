import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Business Knowledge Center (`docs/task-packages/module-business-knowledge-center.md`) — one
 * generic table for all 10 "primary record" types the canonical spec names (D2), rather than 10
 * bespoke tables the spec gives no field-level basis for differentiating. Organization-wide, not
 * project-scoped (D3) — no `project_id` column.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("business_knowledge_records", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    record_type: {
      type: DataTypes.ENUM(
        "company_profile",
        "persona_icp",
        "marketing_profile",
        "vto",
        "service_taxonomy",
        "engagement_model",
        "approved_messaging",
        "competitor",
        "geographic_scope",
        "strategic_priority",
      ),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("mandatory", "advisory", "draft", "deprecated", "restricted"),
      allowNull: false,
      defaultValue: "draft",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addIndex("business_knowledge_records", ["record_type"], {
    name: "business_knowledge_records_record_type_idx",
  });
  await context.addIndex("business_knowledge_records", ["status"], {
    name: "business_knowledge_records_status_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("business_knowledge_records", {});
  await context.sequelize.query(
    `DROP TYPE IF EXISTS "enum_business_knowledge_records_record_type";`,
  );
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_business_knowledge_records_status";`);
}
