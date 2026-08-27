import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Design Reference Library module foundation
 * (`docs/implementation/module-design-reference-library.md`, module #14). One single table,
 * `design_reference_records`, matching Brand Library's/Business Knowledge Center's/Persona
 * Library's/Service Library's/Content Template Library's own single-generic-table precedent —
 * unlike those, no `record_type` discriminator (D1), since the canonical spec
 * (`03_Detailed_Module_Specifications.md §11`) names one flat field list with no enumerated
 * sub-types.
 *
 * Organization-wide, not project-scoped — no `project_id` column (mirrors every other
 * creative/library module's own precedent).
 *
 * `source_url`/`screenshot_url` are plain nullable URL strings (D2) — validated as safe http(s)
 * URLs at the DTO layer only (`safeHttpUrlSchema`, `@webdesk/validation`), not a database-level
 * constraint, mirroring `brand_library_records.file_reference`'s own identical split. No new
 * attachment/storage mechanism — no Asset Library module and no provisioned Vercel Blob store
 * exist yet (see `CLAUDE.md`'s "Open client blockers").
 *
 * `likes`/`dislikes`/`motion_notes`/`accessibility_concerns`/`performance_concerns` are free-text
 * rich-text rationale (D3) — sanitized at write time (`sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()`) and render time (`SanitizedRichText`), built
 * sanitize-ready from day one even though no `dashboard-web` UI exists yet this pass, mirroring
 * Brand Library's own precedent. `page_section_type` (D4) is a plain free-text field, not a
 * closed enum — the spec names no enumerated value list. `desktop_behavior`/`mobile_behavior`
 * (D5) are plain text, distinct in kind from the rationale fields above.
 *
 * `tags` is a plain unvalidated string array (D6), mirroring `personas.roles`'s/
 * `services.icp_ids`'s own identical shape — non-nullable, defaulting to an empty array.
 *
 * `approval_status` reuses the standard 8-value `ArtifactApprovalStatus` vocabulary verbatim
 * (D7) — governed via a dedicated status-transition endpoint only, never accepted through
 * `create()`/`update()`, same discipline as `brand_library_records.approval_status`.
 *
 * `is_published`/`published_at` reuse Brand Library's/Content Template Library's real
 * publish/unpublish mechanism verbatim (D8) — the seeded `creative_design` RBAC group's own
 * `publish`/`unpublish` actions. Orthogonal to `approval_status`: `DesignReferenceLibraryService.
 * publish()` enforces "only an `approved` record may be published" as an application-layer gate,
 * not a database constraint, since `unpublish()` has no equivalent status restriction.
 * `published_at` is server-stamped only, by `DesignReferenceRecordRepository.
 * updatePublishState()`'s own atomic `COALESCE` write — never accepted as caller input, and never
 * overwritten once first set.
 *
 * `version` is server-managed (D9), incremented by 1 on every successful content update,
 * mirroring `brand_library_records.version`'s own identical contract.
 *
 * No sub-resources, no cross-module relationship fields (D10).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("design_reference_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching
     *  `brand_library_records.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    /** Validated as a safe http(s) URL at the DTO layer (`safeHttpUrlSchema`), NOT a DB-level
     *  constraint (D2) — the reference's own origin page. */
    source_url: { type: DataTypes.STRING(2048), allowNull: true },
    /** Validated as a safe http(s) URL at the DTO layer (`safeHttpUrlSchema`), NOT a DB-level
     *  constraint (D2) — no new attachment/storage mechanism, a plain URL field. */
    screenshot_url: { type: DataTypes.STRING(2048), allowNull: true },
    /** Plain free-text field, not a closed enum (D4) — the spec names no enumerated value list. */
    page_section_type: { type: DataTypes.STRING(255), allowNull: true },
    /** Free-text rich-text rationale (D3) — sanitized at write/render time, not a database
     *  constraint. */
    likes: { type: DataTypes.TEXT, allowNull: true },
    dislikes: { type: DataTypes.TEXT, allowNull: true },
    /** Plain text, not rich text (D5) — describes observed behavior, distinct in kind from the
     *  rationale fields above. */
    desktop_behavior: { type: DataTypes.STRING(2000), allowNull: true },
    mobile_behavior: { type: DataTypes.STRING(2000), allowNull: true },
    motion_notes: { type: DataTypes.TEXT, allowNull: true },
    accessibility_concerns: { type: DataTypes.TEXT, allowNull: true },
    performance_concerns: { type: DataTypes.TEXT, allowNull: true },
    /** Plain unvalidated tag list (D6) — non-nullable, defaulting to an empty array, mirroring
     *  `personas.roles`'s/`services.icp_ids`'s own identical shape. No backing tag entity exists. */
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()` (D7), same discipline as `brand_library_records.approval_status`. */
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
     *  status-transition or publish/unpublish call) — D9. */
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    /** Orthogonal to `approval_status` (D8) — governed via the dedicated publish/unpublish
     *  endpoints only, gated on the real seeded `publish`/`unpublish` RBAC actions. */
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** Server-stamped only, by `DesignReferenceRecordRepository.updatePublishState()`'s own
     *  atomic `COALESCE` write on the first successful `publish()` — never accepted as caller
     *  input, never overwritten once first set, never cleared by `unpublish()` (D8). */
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

  await context.addIndex("design_reference_records", ["public_id"], {
    name: "design_reference_records_public_id_unique",
    unique: true,
  });
  await context.addIndex("design_reference_records", ["approval_status"], {
    name: "design_reference_records_approval_status_idx",
  });
  await context.addIndex("design_reference_records", ["is_published"], {
    name: "design_reference_records_is_published_idx",
  });
  await context.addIndex("design_reference_records", ["updated_at"], {
    name: "design_reference_records_updated_at_idx",
  });
  // Fuzzy-search support on title, mirroring brand_library_records_title_trgm_idx (migration
  // 00070)/content_templates_page_type_trgm_idx (migration 00064)/personas_name_trgm_idx
  // (migration 00052) — the same `04_Data_Model_and_Ownership.md:241` trigram-index requirement
  // applies equally here.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX design_reference_records_title_trgm_idx ON design_reference_records USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("design_reference_records", {});
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_design_reference_records_approval_status";',
  );
}
