import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Workflow and Task Template Library module foundation
 * (`docs/implementation/module-workflow-and-task-template-library.md`). One single table,
 * `workflow_task_templates`, matching Business Knowledge Center's/Persona Library's/Service
 * Library's/Content Template Library's/Brand Library's own single-generic-table precedent for a
 * flat field list with no per-type schema basis in the canonical spec
 * (`03_Detailed_Module_Specifications.md`: existing-page audit, new-page opportunity, search
 * brief, content, case study, design, development, code review, security, QA, and release task
 * templates — each with authorized stage, required inputs, expected outputs, restrictions, agent
 * assignment, validation criteria, and required approvals).
 *
 * Organization-wide, not project-scoped — no `project_id` column, matching Brand Library's own
 * precedent (these templates are not tied to a single client project).
 *
 * `template_type` distinguishes the module's 11 real template kinds — create-only/immutable after
 * create (a real type change means a new record, never accepted through the update route).
 *
 * `approval_status` reuses the standard 8-value `ArtifactApprovalStatus` vocabulary verbatim —
 * governed via a dedicated status-transition endpoint only, never accepted through
 * `create()`/`update()`, same discipline as `brand_library_records.approval_status`.
 *
 * `version` is server-managed, incremented by 1 on every successful content update, mirroring
 * `brand_library_records.version`'s own identical contract.
 *
 * No `file_reference`/URL field, no publish/unpublish mechanism (the seeded `ready_for_claude`
 * RBAC group has no `P` grant — `00013-seed-rbac-matrix.ts`), and no confidentiality field (the
 * module registry's own seeded `confidentialityLevel` for `workflow_and_task_template_library` is
 * `null`, `00035-populate-module-registry-fields.ts:428-441`).
 *
 * `required_inputs`/`expected_outputs`/`restrictions`/`validation_criteria` are stored as plain
 * unsanitized TEXT — a backend-only pass, matching Persona Library's/Service Library's own
 * original backend-only builds; rich-text sanitization is added later alongside the
 * `dashboard-web` UI. `restrictions`/`required_approvals` are inert, descriptive metadata only —
 * neither is wired to any automatic status transition or execution gate, honoring the roadmap's
 * own explicit "Templates never authorize execution by themselves" design note.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("workflow_task_templates", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching
     *  `brand_library_records.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    template_type: {
      type: DataTypes.ENUM(
        "existing_page_audit",
        "new_page_opportunity",
        "search_brief",
        "content",
        "case_study",
        "design",
        "development",
        "code_review",
        "security",
        "qa",
        "release",
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    authorized_stage: { type: DataTypes.STRING(255), allowNull: false },
    required_inputs: { type: DataTypes.TEXT, allowNull: true },
    expected_outputs: { type: DataTypes.TEXT, allowNull: true },
    restrictions: { type: DataTypes.TEXT, allowNull: true },
    agent_assignment: { type: DataTypes.STRING(255), allowNull: true },
    validation_criteria: { type: DataTypes.TEXT, allowNull: true },
    required_approvals: { type: DataTypes.STRING(500), allowNull: true },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()`, same discipline as `content_templates.approval_status`. */
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
    /** Server-managed, incremented by 1 on every successful content update (never on a
     *  status-transition call). */
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
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

  await context.addIndex("workflow_task_templates", ["public_id"], {
    name: "workflow_task_templates_public_id_unique",
    unique: true,
  });
  await context.addIndex("workflow_task_templates", ["template_type"], {
    name: "workflow_task_templates_template_type_idx",
  });
  await context.addIndex("workflow_task_templates", ["approval_status"], {
    name: "workflow_task_templates_approval_status_idx",
  });
  // list() orders every paginated query by (updatedAt DESC, id ASC) — mirrors Brand Library's own
  // brand_library_records_updated_at_idx.
  await context.addIndex("workflow_task_templates", ["updated_at"], {
    name: "workflow_task_templates_updated_at_idx",
  });
  // Fuzzy-search support on title, mirroring brand_library_records_title_trgm_idx (migration
  // 00070)/knowledge_library_records_title_trgm_idx (migration 00097) — the same
  // `04_Data_Model_and_Ownership.md:241` trigram-index requirement applies equally here.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX workflow_task_templates_title_trgm_idx ON workflow_task_templates USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("workflow_task_templates", {});
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_workflow_task_templates_template_type";',
  );
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_workflow_task_templates_approval_status";',
  );
}
