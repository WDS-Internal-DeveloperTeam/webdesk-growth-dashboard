import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Help Center (module #38, `03_Detailed_Module_Specifications.md §38`) — one single generic
 * table, `help_articles`, with a `category` discriminator covering every topic the spec names
 * verbatim ("onboarding, project setup, WordPress publishing, review/approval,
 * staging-to-production, import/export, search/filtering, design libraries, Page Workspace,
 * security/QA, backup/rollback, FAQ, videos, known issues, feedback, version history") —
 * mirrors Business Knowledge Center's/Knowledge Library's own single-table precedent rather than
 * inventing per-topic tables the spec gives no field-level basis for. Organization-wide, not
 * project-scoped — no `project_id` column, matching the same reasoning (help documentation is not
 * tied to a single client project).
 *
 * No approval workflow — deliberately simpler than every prior content-library module. The spec
 * frames this module as static reference documentation, not a governed content pipeline, so there
 * is no `approval_status`/`version`/`TRANSITIONS` table here at all, only a plain
 * `is_published` boolean gated on the module's own `edit` RBAC action (there is no dedicated
 * `publish`/`unpublish` letter seeded for this module's RBAC group — see below).
 *
 * Reuses the already-seeded `system_settings` RBAC group verbatim (`00013-seed-rbac-matrix.ts`) —
 * no new RBAC migration. That group grants only `super_admin` ("VCERM": view, create, edit,
 * review, configure) and `owner_growth_approver` ("VM": view, configure) any access at all; every
 * other role (marketing_editor, designer, developer, QA, read_only) gets nothing, not even view.
 * This was confirmed directly with the project owner before building and kept as-seeded, matching
 * this project's own precedent of building against the real seeded RBAC matrix rather than
 * silently widening it — flagged here as a real, deliberate limitation, not an oversight: as
 * built, Help Center is only actually visible to the two most-privileged roles.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("help_articles", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** The spec's own §38 topic list, taken verbatim — immutable once set (create-only, never
     *  accepted through `update()`), matching every sibling module's own discriminator-field
     *  convention (`recordType`/`pageType`/`category`). */
    category: {
      type: DataTypes.ENUM(
        "onboarding",
        "project_setup",
        "wordpress_publishing",
        "review_approval",
        "staging_to_production",
        "import_export",
        "search_filtering",
        "design_libraries",
        "page_workspace",
        "security_qa",
        "backup_rollback",
        "faq",
        "videos",
        "known_issues",
        "feedback",
        "version_history",
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    /** Required, unlike Business Knowledge Center's own now-optional `content` (which allows an
     *  attachment-only record) — no attachment mechanism exists for this module, so a help
     *  article's content is always its entire substance. Sanitized at write time
     *  (`sanitizeRichTextHtml()`) even though no `dashboard-web` UI exists yet for this pass,
     *  matching Section and Pattern Library's/Motion and Interaction Library's own precedent of
     *  wiring sanitization ahead of the eventual `RichTextEditor` UI. */
    content: { type: DataTypes.TEXT, allowNull: false },
    /** Orthogonal, plain boolean — not a governed workflow field. Toggled through the ordinary
     *  `update()` route (gated on `edit`), not a dedicated publish/unpublish action, since the
     *  seeded `system_settings` RBAC group carries no `P` (Publish/Unpublish) letter at all. */
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** Server-stamped only, on the first transition to `is_published = true` — never accepted as
     *  caller input, never overwritten once first set, never cleared on unpublish (mirrors
     *  `content_templates.published_at`'s own "stamp once" contract). */
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

  await context.addIndex("help_articles", ["category"], { name: "help_articles_category_idx" });
  await context.addIndex("help_articles", ["is_published"], {
    name: "help_articles_is_published_idx",
  });
  await context.addIndex("help_articles", ["updated_at"], {
    name: "help_articles_updated_at_idx",
  });
  // Fuzzy-search support on title, mirroring personas_name_trgm_idx/knowledge_library_records_
  // title_trgm_idx — this module's own `search` filter is backed by it from day one, not added
  // later as a review-round fix (the gap Knowledge Library's own review found and closed once).
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX help_articles_title_trgm_idx ON help_articles USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("help_articles", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_help_articles_category";');
}
