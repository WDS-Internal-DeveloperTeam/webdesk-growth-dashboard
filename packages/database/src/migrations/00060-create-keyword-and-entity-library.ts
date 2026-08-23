import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Keyword & Entity Library module foundation (`docs/task-packages/module-keyword-and-entity-library.md`,
 * module #8). Four tables (task package §3, sourced from `04_Data_Model_and_Ownership.md:121-124`):
 * `keywords` and `entities` (both project-scoped parents, task package D2), and two real join
 * tables — `keyword_entity_relationships` (a genuine many-to-many between `keywords` and
 * `entities`) and `page_keyword_assignments` (a real, existence-validated join into Page
 * Inventory's own `pages`, task package D1 — unlike prior modules whose relationship-style fields
 * fell back to plain unvalidated arrays specifically because their target modules didn't exist yet
 * at build time; both `website_strategy_center` and `page_inventory` already exist here).
 *
 * `keywords.project_id`/`entities.project_id` use `onDelete: "RESTRICT"`, mirroring
 * `pages.project_id`'s own choice (`00058-create-page-inventory.ts`) — the Projects module's own
 * task package rule 7 ("No cascading deletion from `projects` into any website/business-record
 * table") applies directly here. `keyword_entity_relationships`/`page_keyword_assignments` are
 * pure join rows with no independent meaning once either parent is gone, so both FKs on both join
 * tables use `onDelete: "CASCADE"` — the same class of relationship
 * `project_environments`/`project_repositories` already use `CASCADE` for against their own
 * parent `projects` row (those are the project's own configuration sub-resources, not a separate
 * business record — see `00058`'s own doc comment for why that distinction matters).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("keywords", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Stable, human-readable identifier — never regenerated once assigned, same "unique per row"
     *  (global, not per-project) contract as `pages.public_id`/`projects.public_id`. */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    query_text: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    /** Plain nullable string — no canonical value list exists anywhere in the sources for this
     *  field (task package D6). */
    keyword_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    intent: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    funnel_stage: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    /** "Metrics" (task package D7) — the two most standard SEO keyword metrics; the spec names no
     *  exhaustive metric list, so more can be added later without a breaking migration. */
    search_volume: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    difficulty_score: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    research_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    cannibalization_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** No numeric threshold basis exists anywhere in the spec to justify a numeric score
     *  (task package D8) — a plain 3-value enum instead. */
    confidence: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: true,
    },
    /** Governed via a dedicated status-transition endpoint, reused verbatim from
     *  Service/Persona/Proof-and-Claims/Website-Strategy-Center/Page-Inventory's own identical
     *  vocabulary (task package D9) — a 6th occurrence of this identical shape, deliberately not
     *  extracted into a shared helper (already-accepted, out-of-scope debt in this codebase).
     *  Applies only to `keywords` — `entities` and both join tables below carry no approval
     *  status of their own. */
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

  await context.addIndex("keywords", ["public_id"], {
    name: "keywords_public_id_unique",
    unique: true,
  });
  await context.addIndex("keywords", ["project_id", "updated_at", "id"], {
    name: "keywords_project_id_updated_at_id_idx",
  });
  // Fuzzy-search support, same pattern as pages_page_name_trgm_idx/services_canonical_name_trgm_idx/
  // personas_name_trgm_idx (per 04_Data_Model_and_Ownership.md:241's trigram-index requirement,
  // already established for every sibling module's own primary name/text field).
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX keywords_query_text_trgm_idx ON keywords USING gin (query_text gin_trgm_ops);",
  );

  await context.createTable("entities", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    /** Free text — e.g. "Person"/"Organization"/"Place"/"Concept"/"Brand" — no enum invented,
     *  since the spec names no discrete taxonomy (task package D3). */
    entity_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
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

  await context.addIndex("entities", ["public_id"], {
    name: "entities_public_id_unique",
    unique: true,
  });
  await context.addIndex("entities", ["project_id", "updated_at", "id"], {
    name: "entities_project_id_updated_at_id_idx",
  });
  await context.sequelize.query(
    "CREATE INDEX entities_name_trgm_idx ON entities USING gin (name gin_trgm_ops);",
  );

  await context.createTable("keyword_entity_relationships", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    keyword_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "keywords", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "entities", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    created_by: {
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
  });

  await context.addIndex("keyword_entity_relationships", ["keyword_id", "entity_id"], {
    name: "keyword_entity_relationships_unique",
    unique: true,
  });
  await context.addIndex("keyword_entity_relationships", ["entity_id"], {
    name: "keyword_entity_relationships_entity_id_idx",
  });

  await context.createTable("page_keyword_assignments", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    keyword_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "keywords", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** Existence-and-same-project validated at the service layer (task package D1), via
     *  `PagesService.existsInProject()` — not a plain unvalidated array, since Page Inventory
     *  already exists at build time (unlike Persona Library's `relatedServiceIds`-style fields). */
    page_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "pages", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    assignment_note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_by: {
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
  });

  await context.addIndex("page_keyword_assignments", ["keyword_id", "page_id"], {
    name: "page_keyword_assignments_unique",
    unique: true,
  });
  await context.addIndex("page_keyword_assignments", ["page_id"], {
    name: "page_keyword_assignments_page_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("page_keyword_assignments", {});
  await context.dropTable("keyword_entity_relationships", {});
  await context.dropTable("entities", {});
  await context.dropTable("keywords", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_keywords_confidence";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_keywords_approval_status";');
}
