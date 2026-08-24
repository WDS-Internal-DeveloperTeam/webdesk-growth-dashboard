import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Content Template Library module foundation
 * (`docs/task-packages/module-content-template-library.md`, module #10). One single table,
 * `content_templates`, matching Business Knowledge Center's/Persona Library's/Website Strategy
 * Center's own single-table precedent (`04_Data_Model_and_Ownership.md`'s "Business and content
 * libraries" section names one table for this module) — the canonical spec
 * (`03_Detailed_Module_Specifications.md §25`) is a flat field list with no basis for splitting
 * across entities: "page type, purpose, required/optional sections, proof rules, SEO/AEO/GEO
 * requirements, schema, CTA rules, content-depth guidance, approval, version."
 *
 * Organization-wide, not project-scoped — no `project_id` column, mirroring Persona Library's/
 * Service Library's own reasoning (a page-template catalog is not tied to a single client
 * project).
 *
 * `required_sections`/`optional_sections` are nullable `text[]` arrays (task package §3/D7) — no
 * enum invented for section names (the canonical spec gives no discrete list) and, unlike Persona
 * Library's own NOT-NULL-default-`[]` array columns, genuinely nullable here per the task
 * package's own schema section.
 *
 * `approval_status` reuses the standard 8-value `ArtifactApprovalStatus` vocabulary verbatim (D4)
 * — governed via a dedicated status-transition endpoint only, never accepted through
 * `create()`/`update()`, same discipline as `personas.approval_status`/`services.approval_status`.
 *
 * `version` is server-managed (D5), incremented by 1 on every successful content update, mirroring
 * `personas.version`'s own identical contract — the canonical spec's own explicit "version" field.
 *
 * `is_published`/`published_at` are new to this module (D1/D2) — this is the first module to wire
 * the real, previously-unused `P` (Publish/Unpublish) RBAC vocabulary
 * (`00013-seed-rbac-matrix.ts`) into actual code. Orthogonal to `approval_status`:
 * `ContentTemplatesService.publish()` enforces "only an `approved` template may be published" as
 * an application-layer gate, not a database constraint, since `unpublish()` has no equivalent
 * status restriction (an operator must always be able to pull a published template down
 * regardless of its current approval status). `published_at` is server-stamped only, by
 * `ContentTemplateRepository.updatePublishState()`'s own atomic `COALESCE` write — never accepted
 * as caller input, and never overwritten once first set (D2, mirroring
 * `internal_links.implemented_at`/`verified_at`'s own "stamp once" contract from migration
 * `00062`).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("content_templates", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching
     *  `personas.public_id`'s/`services.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** A category label (e.g. "Service Page," "Blog Post"), not a reference to any specific page
     *  — deliberately NOT a validated FK into Page Inventory's `pages` table (D6). Free text, no
     *  enum invented, matching Page Inventory's own `page_type` field shape exactly. */
    page_type: { type: DataTypes.STRING(255), allowNull: false },
    purpose: { type: DataTypes.TEXT, allowNull: true },
    /** Guidance labels, not FK references to any other table — no existence validation (D7). */
    required_sections: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
    optional_sections: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
    proof_rules: { type: DataTypes.TEXT, allowNull: true },
    seo_aeo_geo_requirements: { type: DataTypes.TEXT, allowNull: true },
    schema: { type: DataTypes.TEXT, allowNull: true },
    cta_rules: { type: DataTypes.TEXT, allowNull: true },
    content_depth_guidance: { type: DataTypes.TEXT, allowNull: true },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()` (D4), same discipline as `personas.approval_status`. */
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
     *  status-transition or publish/unpublish call) — D5, the canonical spec's own explicit
     *  "version" field. */
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    /** Orthogonal to `approval_status` (D2/D1) — governed via the dedicated publish/unpublish
     *  endpoints only, gated on the real seeded `publish`/`unpublish` RBAC actions. */
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** Server-stamped only, by `ContentTemplateRepository.updatePublishState()`'s own atomic
     *  `COALESCE` write on the first successful `publish()` — never accepted as caller input,
     *  never overwritten once first set, never cleared by `unpublish()` (D2). */
    published_at: { type: DataTypes.DATE, allowNull: true },
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

  await context.addIndex("content_templates", ["public_id"], {
    name: "content_templates_public_id_unique",
    unique: true,
  });
  await context.addIndex("content_templates", ["approval_status"], {
    name: "content_templates_approval_status_idx",
  });
  await context.addIndex("content_templates", ["is_published"], {
    name: "content_templates_is_published_idx",
  });
  await context.addIndex("content_templates", ["updated_at"], {
    name: "content_templates_updated_at_idx",
  });
  // Fuzzy-search support on page_type, mirroring personas_name_trgm_idx (migration 00052)/
  // services_canonical_name_trgm_idx (migration 00050) — the same
  // `04_Data_Model_and_Ownership.md:241` trigram-index requirement applies equally to a field
  // searched via a leading-wildcard ILIKE.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX content_templates_page_type_trgm_idx ON content_templates USING gin (page_type gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("content_templates", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_content_templates_approval_status";');
}
