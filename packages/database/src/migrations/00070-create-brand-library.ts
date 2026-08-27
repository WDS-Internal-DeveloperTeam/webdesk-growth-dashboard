import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Brand Library module foundation (`docs/implementation/module-brand-library.md`, module
 * #13). One single table, `brand_library_records`, matching Business Knowledge Center's/Persona
 * Library's/Service Library's/Content Template Library's own single-generic-table precedent for a
 * heterogeneous flat field list with no per-type schema basis in the canonical spec
 * (`03_Detailed_Module_Specifications.md §10`: "logos, colors, typography, photography,
 * illustration, icon rules, tone, visual personality, dos/don'ts, deprecated assets — every active
 * asset has status, version, approval, file reference, and usage rules").
 *
 * Organization-wide, not project-scoped — no `project_id` column (D1, brand identity is not tied
 * to a single client project, matching every other creative/library module's own precedent).
 *
 * `record_type` distinguishes the module's 9 real asset/guidance kinds (D1). `deprecated` is
 * modeled as an `approval_status` value, not a `recordType` (D3) — any record of any type can be
 * marked deprecated, matching the no-hard-delete precedent every module in this codebase already
 * follows.
 *
 * `file_reference` is a plain nullable URL string (D2) — validated as a safe http(s) URL at the
 * DTO layer only (`safeHttpUrlSchema`, `@webdesk/validation`), not a database-level constraint,
 * mirroring `projects.environments.url`'s/`proof_claims.claim_sources.source_url`'s own identical
 * split. No new attachment/storage mechanism — no Asset Library module and no provisioned Vercel
 * Blob store exist yet (see `CLAUDE.md`'s "Open client blockers").
 *
 * `approval_status` reuses the standard 8-value `ArtifactApprovalStatus` vocabulary verbatim (D4)
 * — governed via a dedicated status-transition endpoint only, never accepted through
 * `create()`/`update()`, same discipline as `content_templates.approval_status`.
 *
 * `version` is server-managed (D6), incremented by 1 on every successful content update, mirroring
 * `content_templates.version`'s own identical contract.
 *
 * `is_published`/`published_at` reuse Content Template Library's real publish/unpublish mechanism
 * verbatim (D5) — the seeded `creative_design` RBAC group's own previously-unused `P` grant
 * (`00013-seed-rbac-matrix.ts:136-144`, held only by `super_admin`/`owner_growth_approver`).
 * Orthogonal to `approval_status`: `BrandLibraryService.publish()` enforces "only an `approved`
 * record may be published" as an application-layer gate, not a database constraint, since
 * `unpublish()` has no equivalent status restriction. `published_at` is server-stamped only, by
 * `BrandLibraryRecordRepository.updatePublishState()`'s own atomic `COALESCE` write — never
 * accepted as caller input, and never overwritten once first set.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("brand_library_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching
     *  `content_templates.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    record_type: {
      type: DataTypes.ENUM(
        "logo",
        "color",
        "typography",
        "photography",
        "illustration",
        "icon_rule",
        "tone",
        "visual_personality",
        "dos_dont",
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    /** Validated as a safe http(s) URL at the DTO layer (`safeHttpUrlSchema`), NOT a DB-level
     *  constraint (D2) — guidance-only records (tone, visual_personality, dos_dont) legitimately
     *  have no file. */
    file_reference: { type: DataTypes.STRING(2048), allowNull: true },
    usage_notes: { type: DataTypes.TEXT, allowNull: true },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()` (D4), same discipline as `content_templates.approval_status`. */
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
     *  status-transition or publish/unpublish call) — D6. */
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    /** Orthogonal to `approval_status` (D5) — governed via the dedicated publish/unpublish
     *  endpoints only, gated on the real seeded `publish`/`unpublish` RBAC actions. */
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** Server-stamped only, by `BrandLibraryRecordRepository.updatePublishState()`'s own atomic
     *  `COALESCE` write on the first successful `publish()` — never accepted as caller input,
     *  never overwritten once first set, never cleared by `unpublish()` (D5). */
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

  await context.addIndex("brand_library_records", ["public_id"], {
    name: "brand_library_records_public_id_unique",
    unique: true,
  });
  await context.addIndex("brand_library_records", ["record_type"], {
    name: "brand_library_records_record_type_idx",
  });
  await context.addIndex("brand_library_records", ["approval_status"], {
    name: "brand_library_records_approval_status_idx",
  });
  await context.addIndex("brand_library_records", ["is_published"], {
    name: "brand_library_records_is_published_idx",
  });
  await context.addIndex("brand_library_records", ["updated_at"], {
    name: "brand_library_records_updated_at_idx",
  });
  // Fuzzy-search support on title, mirroring content_templates_page_type_trgm_idx (migration
  // 00064)/personas_name_trgm_idx (migration 00052) — the same
  // `04_Data_Model_and_Ownership.md:241` trigram-index requirement applies equally here.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX brand_library_records_title_trgm_idx ON brand_library_records USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("brand_library_records", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_brand_library_records_record_type";');
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_brand_library_records_approval_status";',
  );
}
