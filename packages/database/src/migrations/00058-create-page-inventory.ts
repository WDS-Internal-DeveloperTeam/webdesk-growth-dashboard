import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Page Inventory module foundation (`docs/task-packages/module-page-inventory.md`). Two
 * tables — `pages` (parent) and `page_urls` (a real one-to-many child, task package D1/D10) —
 * scoped to the "Pages and artifacts" cluster's own first two tables only, not the full 7-table
 * cluster `04_Data_Model_and_Ownership.md` names (`page_artifacts`/`page_artifact_versions`/
 * `page_relationships`/`page_component_usage`/`page_deployments` are Page Workspace's own, later,
 * not-yet-authorized scope, per the module registry's own `page_workspace.dependencies` naming
 * `page_inventory` as its dependency, not the other way around).
 *
 * `pages.project_id` is a real, required FK — unlike every prior content-library module (Business
 * Knowledge Center, Service/Persona/Proof-and-Claims Library, Website Strategy Center, all
 * organization-wide), Page Inventory IS project-scoped (task package D2): a website's pages
 * naturally belong to one specific client project. `onDelete: "RESTRICT"`, not `"CASCADE"` — the
 * Projects module's own task package rule 7 ("No cascading deletion from `projects` into any
 * website/business-record table") applies directly here; `project_environments`'/`project_repositories`'
 * own `CASCADE` is explicitly not the right precedent to copy, since those are the project's own
 * configuration sub-resources, not a separate business record like Pages (see
 * `00037-create-project-environments.ts`'s own doc comment, which names Pages by name as the
 * example this rule protects).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("pages", {
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
     *  (global, not per-project) contract as `projects.public_id`/`services.public_id`. No real
     *  multi-row version history exists for this module (unlike Website Strategy Center), so this
     *  is a plain unique column, not a partial index. */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    page_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    /** Plain nullable string, not an ENUM — no canonical value list exists anywhere in the
     *  sources for this field (task package D-none, applies the same "no basis for an enum"
     *  reasoning already used for `template`/`target_keyword` below). */
    page_type: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    existing_or_proposed: {
      type: DataTypes.ENUM("existing", "proposed"),
      allowNull: false,
      defaultValue: "proposed",
    },
    index_status: {
      type: DataTypes.ENUM("index", "noindex", "unknown"),
      allowNull: false,
      defaultValue: "unknown",
    },
    /** Plain nullable string — Page Template Library (module #16) doesn't exist yet (task package
     *  D5). */
    template: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** A real, existence-validated FK — meaningful now that `pages` is project-scoped (task
     *  package D6). `onDelete: "SET NULL"`, not `"RESTRICT"`: unlike `pages.project_id` (a Pages
     *  row must always belong to some project), a page losing its roadmap-phase association when
     *  that phase is removed is a normal, recoverable event, matching `projects.active_phase_id`'s
     *  own `SET NULL`-shaped precedent for the identical relationship class (`00042-add-project-active-phase.ts`).
     */
    roadmap_phase_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "roadmap_items", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Governed via a dedicated status-transition endpoint, sourced from
     *  `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim from
     *  Service/Persona/Proof-and-Claims/Website-Strategy-Center's own identical vocabulary (task
     *  package D8) — a 5th occurrence of this identical shape, deliberately not extracted into a
     *  shared helper (already-accepted, out-of-scope debt in this codebase). */
    workflow_stage: {
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
    /** Plain nullable string — Keyword & Entity Library (module #8) doesn't exist yet (task
     *  package D7). */
    target_keyword: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    design_version: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** Plain nullable text — the spec names "repository files" with no structure defined; a
     *  structured array/JSONB shape would be invented, not sourced. */
    repository_files: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** External references only — no real FK, no validation against a live WordPress site (task
     *  package D4, matches D3's own deferral of Scan Website/Import). */
    wordpress_page_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    wordpress_post_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_scan_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    last_deployment_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    /** Named only in `canonical-inputs/Recommended_Module_Roadmap.md` row 7, absent from the
     *  spec/data-model/wireframe/registry description (task package D9) — a nullable, purely
     *  descriptive field with no governance/workflow attached, not treated as spec-sourced. */
    classification: {
      type: DataTypes.ENUM("keep", "optimize", "restructure", "redesign", "rebuild", "consolidate"),
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

  await context.addIndex("pages", ["public_id"], {
    name: "pages_public_id_unique",
    unique: true,
  });
  await context.addIndex("pages", ["project_id"], { name: "pages_project_id_idx" });
  await context.addIndex("pages", ["workflow_stage"], { name: "pages_workflow_stage_idx" });
  // Fuzzy-search support, same pattern as services_canonical_name_trgm_idx/personas_name_trgm_idx/
  // proof_claims_claim_trgm_idx (per 04_Data_Model_and_Ownership.md:241's trigram-index
  // requirement, already established for every sibling module's own primary name/text field).
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX pages_page_name_trgm_idx ON pages USING gin (page_name gin_trgm_ops);",
  );

  await context.createTable("page_urls", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    page_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "pages", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** Denormalized from the parent page's own `project_id`, set only by the service layer (never
     *  accepted from a caller) — this is what lets the acceptance rule below be enforced as a real
     *  partial unique index without a cross-table lookup (task package D10). `onDelete: "RESTRICT"`
     *  mirrors `pages.project_id`'s own choice for the identical reason — in practice this FK can
     *  never actually fire on a `projects` delete, since `pages.project_id`'s own `RESTRICT` will
     *  already have blocked it first, but it's added anyway as a real, independent DB-layer
     *  safety net rather than trusting the service layer's own denormalization to always be
     *  correct. */
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_canonical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

  await context.addIndex("page_urls", ["page_id"], { name: "page_urls_page_id_idx" });
  // The spec's own acceptance rule, task package D10: "each URL has one canonical active page
  // record unless an approved redirect or archive relationship exists" — enforced at the database
  // layer, not just application-code discipline, matching this project's own standing pattern
  // (Projects' active_phase_id partial unique index, Website Strategy Center's is_current one).
  await context.addIndex("page_urls", ["project_id", "url"], {
    name: "page_urls_one_canonical_per_project_url",
    unique: true,
    where: { is_canonical: true },
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("page_urls", {});
  await context.dropTable("pages", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_pages_existing_or_proposed";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_pages_index_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_pages_workflow_stage";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_pages_classification";');
}
