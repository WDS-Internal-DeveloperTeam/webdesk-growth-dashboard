import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Page Workspace module foundation (`docs/task-packages/module-page-workspace.md`, module
 * #12) — the 12th real business-module backend, and the first built against genuinely sourced
 * spec material rather than a flat field list: `03_Detailed_Module_Specifications.md §6` (tabs +
 * versioning rules), `05_Workflow_State_Machines.md §1/§2/§3/§12` (transition rules, the generic
 * artifact lifecycle, the page lifecycle, approval-record requirements), and
 * `04_Data_Model_and_Ownership.md` (the "Pages and artifacts" cluster + §5's versioning rules).
 *
 * Two new tables (task package D1 — the core slice): `page_artifacts` (one row per page +
 * artifact type, the stable logical identity) and `page_artifact_versions` (the real versioned
 * content). `page_relationships`/`page_component_usage`/`page_deployments` are deliberately NOT
 * built here — two of the three would carry unvalidated foreign keys into Component Library and
 * the Release Center, neither of which exists, and the third overlaps the already-live Internal
 * Linking Library.
 *
 * Plus two additive columns on the already-live `pages` table (task package D4):
 * `lifecycle_stage`/`lifecycle_previous_stage`. `pages.workflow_stage` is NOT reused — Page
 * Inventory seeded it as the shared 8-value generic artifact-approval vocabulary and it ships
 * with a live endpoint and UI. The page lifecycle from `05_Workflow_State_Machines.md §3` is a
 * different axis: `workflow_stage` governs the page RECORD's approval, `lifecycle_stage` governs
 * the page's DELIVERY progress. Purely additive, no breaking change.
 *
 * Project scoping (task package D11): `project_id` is denormalized onto both new tables from the
 * parent page and set only by the service layer, never accepted from a caller — the same
 * mechanism `page_urls` already uses, and what lets project-scoped RBAC and IDOR checks be real
 * WHERE-clause scoping rather than a cross-table lookup.
 */

/** 15 types, not the spec's 16 tabs (task package D3) — "History" is a derived read-only view
 *  over `page_artifact_versions` itself, not a versioned artifact of its own. */
const ARTIFACT_TYPES = [
  "overview",
  "live_snapshot",
  "audit",
  "ideal_structure",
  "search",
  "content",
  "creative_direction",
  "ux_wireframe",
  "ui_specification",
  "component_map",
  "implementation",
  "code_review",
  "security",
  "qa",
  "deployment",
] as const;

/** `05_Workflow_State_Machines.md §3` verbatim — 16 main-path states plus 6 alternative states
 *  (task package D5). Every transition between them is allowlisted in the service layer; nothing
 *  in this module ever advances a stage as a side effect of another action (roadmap row 12:
 *  "No automatic progression through stages"). */
const LIFECYCLE_STAGES = [
  "proposed",
  "approved_for_planning",
  "in_strategy",
  "search_approved",
  "content_approved",
  "design_approved",
  "ready_for_development",
  "in_development",
  "code_review",
  "security_qa",
  "ready_for_staging",
  "staging_deployed",
  "staging_approved",
  "production_approved",
  "production_deployed",
  "verified",
  "revision_requested",
  "blocked",
  "paused",
  "failed",
  "rolled_back",
  "archived",
] as const;

/** The shared generic artifact lifecycle from `05_Workflow_State_Machines.md §2` — reused
 *  verbatim (task package D6), a 6th occurrence of this identical vocabulary across this
 *  codebase. */
const VERSION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "revision_requested",
  "rejected",
  "superseded",
  "archived",
] as const;

export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("page_artifacts", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    page_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "pages", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** Denormalized from the parent page (task package D11) — service-set only. */
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    artifact_type: { type: DataTypes.ENUM(...ARTIFACT_TYPES), allowNull: false },
    /** The version currently presented as "the" artifact. Nullable because an artifact row is
     *  created before its first version exists; no FK, to avoid a circular constraint with
     *  `page_artifact_versions.artifact_id` (each would reference the other). */
    current_version_id: { type: DataTypes.UUID, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  /** `04_Data_Model_and_Ownership.md`'s own "artifact type + page" identity — one artifact of
   *  each type per page, enforced at the database layer, not just service-code discipline. */
  await context.addIndex("page_artifacts", ["page_id", "artifact_type"], {
    name: "page_artifacts_page_type_unique",
    unique: true,
  });
  await context.addIndex("page_artifacts", ["project_id"], {
    name: "page_artifacts_project_id_idx",
  });

  await context.createTable("page_artifact_versions", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    artifact_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "page_artifacts", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** Both denormalized from the parent artifact (task package D11) — service-set only, so
     *  every scoped read/write is a real single-table WHERE clause. */
    page_id: { type: DataTypes.UUID, allowNull: false },
    project_id: { type: DataTypes.UUID, allowNull: false },
    version_number: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM(...VERSION_STATUSES),
      allowNull: false,
      defaultValue: "draft",
    },
    /** Real, server-sanitized HTML from `dashboard-web`'s `RichTextEditor`, per the 2026-08-22
     *  standing rule (task package D10) — sanitized at write time here, and again at render time
     *  in `dashboard-web` via the shared `SanitizedRichText` component. */
    content: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    /** Git-backed artifact provenance, required by `04_Data_Model_and_Ownership.md §5` and §12
     *  (task package D9). Caller-supplied and unvalidated for now — no GitHub integration adapter
     *  exists yet to populate them automatically, the same deferred-integration shape
     *  `pages.wordpress_page_id` already uses. */
    repository: { type: DataTypes.STRING(255), allowNull: true },
    path: { type: DataTypes.TEXT, allowNull: true },
    branch: { type: DataTypes.STRING(255), allowNull: true },
    commit_sha: { type: DataTypes.STRING(64), allowNull: true },
    content_checksum: { type: DataTypes.STRING(128), allowNull: true },
    /** `03_Detailed_Module_Specifications.md §6`: "Reopening an approved stage creates a new
     *  version and records the reason." Both set only on a version created by `reopen()`
     *  (task package D7); a reason is mandatory on that path, per §1. */
    reopened_reason: { type: DataTypes.TEXT, allowNull: true },
    reopened_from_version_id: { type: DataTypes.UUID, allowNull: true },
    /** `05_Workflow_State_Machines.md §12`'s approval-record requirements — the approver and the
     *  decision timestamp, bound to this exact version. */
    approved_by_user_id: { type: DataTypes.UUID, allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  /** `04_Data_Model_and_Ownership.md`'s own "artifact type + page + version" unique constraint,
   *  exactly — artifact identity already encodes page plus type (see the unique index above), so
   *  scoping this to `(artifact_id, version_number)` is the same constraint, normalized. */
  await context.addIndex("page_artifact_versions", ["artifact_id", "version_number"], {
    name: "page_artifact_versions_artifact_version_unique",
    unique: true,
  });
  await context.addIndex("page_artifact_versions", ["project_id", "page_id"], {
    name: "page_artifact_versions_project_page_idx",
  });
  await context.addIndex("page_artifact_versions", ["artifact_id", "status"], {
    name: "page_artifact_versions_artifact_status_idx",
  });

  await context.addColumn("pages", "lifecycle_stage", {
    type: DataTypes.ENUM(...LIFECYCLE_STAGES),
    allowNull: false,
    defaultValue: "proposed",
  });
  await context.addColumn("pages", "lifecycle_previous_stage", {
    type: DataTypes.ENUM(...LIFECYCLE_STAGES),
    allowNull: true,
  });
  await context.addIndex("pages", ["lifecycle_stage"], { name: "pages_lifecycle_stage_idx" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeIndex("pages", "pages_lifecycle_stage_idx");
  await context.removeColumn("pages", "lifecycle_previous_stage");
  await context.removeColumn("pages", "lifecycle_stage");
  await context.dropTable("page_artifact_versions", {});
  await context.dropTable("page_artifacts", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_pages_lifecycle_stage";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_pages_lifecycle_previous_stage";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_page_artifacts_artifact_type";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_page_artifact_versions_status";');
}
