import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Persona Library module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §21`) — a single
 * table, unlike Service Library's normalized multi-table shape, since the canonical spec gives no
 * basis for splitting persona fields across separate entities (the spec is a flat field list:
 * "persona ID, buyer type, company size, roles, industries, geography, goals, pains, triggers,
 * objections, decision criteria, services, bad-fit signals, messaging track, CTA preferences,
 * status, version").
 *
 * `related_service_ids` is an unvalidated string array, not a foreign key — mirrors Service
 * Library's own `icpIds`/`relatedPageIds`/`relatedCaseStudyIds` precedent exactly (confirmed
 * directly with the project owner, D2): Service Library's own `service_categories`/`services`
 * tables already exist, but retrofitting a real relationship in this same pass was explicitly
 * ruled out — Persona Library stays fully standalone.
 *
 * Organization-wide, not project-scoped — no `project_id` column (D8), matching Service Library
 * and Business Knowledge Center.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("personas", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching
     *  `services.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Human-readable label (e.g. "Enterprise IT Director"), distinct from `public_id` — the
     *  canonical spec's "persona ID" field alone isn't a display name (D1). */
    name: { type: DataTypes.STRING(255), allowNull: false },
    buyer_type: { type: DataTypes.STRING(255), allowNull: true },
    company_size: { type: DataTypes.STRING(255), allowNull: true },
    roles: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    industries: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    geography: { type: DataTypes.STRING(255), allowNull: true },
    goals: { type: DataTypes.TEXT, allowNull: true },
    pains: { type: DataTypes.TEXT, allowNull: true },
    triggers: { type: DataTypes.TEXT, allowNull: true },
    objections: { type: DataTypes.TEXT, allowNull: true },
    decision_criteria: { type: DataTypes.TEXT, allowNull: true },
    /** Unvalidated identifier list, not a foreign key — D2. */
    related_service_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    bad_fit_signals: { type: DataTypes.TEXT, allowNull: true },
    messaging_track: { type: DataTypes.TEXT, allowNull: true },
    cta_preferences: { type: DataTypes.TEXT, allowNull: true },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()` (D3/D4), same discipline as `services.approval_status`. */
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
     *  status-transition call) — D5, the canonical spec's own explicit "version" field. */
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
  await context.addIndex("personas", ["public_id"], {
    name: "personas_public_id_unique",
    unique: true,
  });
  await context.addIndex("personas", ["approval_status"], {
    name: "personas_approval_status_idx",
  });
  await context.addIndex("personas", ["updated_at"], { name: "personas_updated_at_idx" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("personas", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_personas_approval_status";');
}
