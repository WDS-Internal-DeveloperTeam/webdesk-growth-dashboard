import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Service Library module foundation (`docs/task-packages/module-service-library.md` §5). A
 * real normalized relational schema — the opposite of Business Knowledge Center's own single
 * generic table — because `04_Data_Model_and_Ownership.md:109-118` explicitly names this shape
 * (task package D3), unlike BKC's spec, which gave no basis for splitting its record types.
 *
 * `icp_ids`/`related_page_ids`/`related_case_study_ids` on `services` are unvalidated string
 * arrays, not foreign keys — `persona_library`/`case_study_library`/`page_inventory` don't exist
 * yet (task package D1, resolved directly with the project owner: build now, link for real once
 * those modules exist).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("service_categories", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    parent_category_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "service_categories", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    public_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    internal_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("service_categories", ["public_id"], {
    name: "service_categories_public_id_unique",
    unique: true,
  });
  await context.addIndex("service_categories", ["parent_category_id"], {
    name: "service_categories_parent_idx",
  });

  await context.createTable("deliverables", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("deliverables", ["public_id"], {
    name: "deliverables_public_id_unique",
    unique: true,
  });

  await context.createTable("platforms_technologies", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    platform_type: { type: DataTypes.STRING(64), allowNull: true },
    certified_partnership: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("platforms_technologies", ["public_id"], {
    name: "platforms_technologies_public_id_unique",
    unique: true,
  });

  await context.createTable("engagement_models", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    preferred: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    approval_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("engagement_models", ["public_id"], {
    name: "engagement_models_public_id_unique",
    unique: true,
  });

  await context.createTable("services", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned (task package D7,
     *  mirroring `projects.public_id`'s own comment). */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    canonical_name: { type: DataTypes.STRING(255), allowNull: false },
    public_name: { type: DataTypes.STRING(255), allowNull: true },
    category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "service_categories", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    parent_service_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "services", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    short_public_description: { type: DataTypes.TEXT, allowNull: true },
    audience: { type: DataTypes.TEXT, allowNull: true },
    problems: { type: DataTypes.TEXT, allowNull: true },
    capabilities: { type: DataTypes.TEXT, allowNull: true },
    outcomes: { type: DataTypes.TEXT, allowNull: true },
    exclusions: { type: DataTypes.TEXT, allowNull: true },
    internal_description: { type: DataTypes.TEXT, allowNull: true },
    /** Unvalidated identifier lists, not foreign keys — task package D1. */
    icp_ids: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    related_page_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    related_case_study_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    confidentiality: {
      type: DataTypes.ENUM("public", "internal", "restricted"),
      allowNull: false,
      defaultValue: "internal",
    },
    /** Ungoverned data field, no dedicated transition endpoint — no `P` grant exists anywhere in
     *  `service_persona_proof` (task package D5). */
    publication_status: {
      type: DataTypes.ENUM("draft", "published", "unpublished"),
      allowNull: false,
      defaultValue: "draft",
    },
    /** Governed via a dedicated status-transition endpoint, sourced from
     *  `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle (task package D5). */
    approval_status: {
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
    owner_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
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
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("services", ["public_id"], {
    name: "services_public_id_unique",
    unique: true,
  });
  await context.addIndex("services", ["category_id"], { name: "services_category_idx" });
  await context.addIndex("services", ["approval_status"], {
    name: "services_approval_status_idx",
  });
  await context.addIndex("services", ["publication_status"], {
    name: "services_publication_status_idx",
  });
  // Fuzzy-search support per `04_Data_Model_and_Ownership.md:241`'s trigram-index requirement.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX services_canonical_name_trgm_idx ON services USING gin (canonical_name gin_trgm_ops);",
  );

  await context.createTable("service_deliverables", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    service_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "services", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    deliverable_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "deliverables", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("service_deliverables", ["service_id", "deliverable_id"], {
    name: "service_deliverables_unique",
    unique: true,
  });

  await context.createTable("service_platforms", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    service_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "services", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    platform_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "platforms_technologies", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("service_platforms", ["service_id", "platform_id"], {
    name: "service_platforms_unique",
    unique: true,
  });

  await context.createTable("service_engagement_models", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    service_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "services", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    engagement_model_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "engagement_models", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("service_engagement_models", ["service_id", "engagement_model_id"], {
    name: "service_engagement_models_unique",
    unique: true,
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("service_engagement_models", {});
  await context.dropTable("service_platforms", {});
  await context.dropTable("service_deliverables", {});
  await context.dropTable("services", {});
  await context.dropTable("engagement_models", {});
  await context.dropTable("platforms_technologies", {});
  await context.dropTable("deliverables", {});
  await context.dropTable("service_categories", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_services_confidentiality";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_services_publication_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_services_approval_status";');
}
