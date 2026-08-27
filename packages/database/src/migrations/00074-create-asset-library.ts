import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Asset Library module foundation (`docs/implementation/module-asset-library.md`, module
 * #15). Two tables: `assets` (the primary record) and `asset_related_records` (a real polymorphic
 * child table, D3).
 *
 * Organization-wide, not project-scoped — no `project_id` column (D9), matching Brand Library's/
 * Content Template Library's/Persona Library's/Service Library's own precedent. The module
 * registry seeds no project-scoping signal for `asset_library` and `dependencies: null`.
 *
 * `file_reference` is a plain nullable URL string (D1) — validated as a safe http(s) URL at the
 * DTO layer only (`safeHttpUrlSchema`, `@webdesk/validation`), not a database-level constraint,
 * mirroring `brand_library_records.file_reference`'s own identical split. This is a deliberate,
 * flagged deviation from `03_Detailed_Module_Specifications.md §12`'s own "direct authenticated
 * upload to private Blob" rule: no Vercel Blob store is provisioned in production (a standing
 * `CLAUDE.md` open blocker that already caused a real production 500 on 2026-08-21), so building
 * the upload pipeline now would ship a feature that fails on every use. See D1 for the full
 * reasoning and for which columns are therefore caller-supplied metadata rather than
 * server-derived values.
 *
 * `visibility` is a REAL enforcement axis (D2), not a decorative column — unlike Brand Library,
 * this module's own seeded `module_registry.confidentiality_level` is a real "record-level" value,
 * so `AssetsController` redacts `file_reference`/`consent_reference` on a `restricted` asset for
 * any caller lacking the `view_confidential` action, via the existing shared
 * `redactConfidentialFields()` mechanism.
 *
 * `scan_status` defaults to `not_configured` and is NEVER set to `clean` by any code path in this
 * module (D4) — the registry's own seeded text is explicit that files "may show 'Scan Not
 * Configured' — never claimed malware-free," and no malware scanner exists anywhere in this
 * system. The other enum values exist so a future scanner integration has somewhere to write;
 * nothing fabricates a result today. Server-managed — never accepted as caller input.
 *
 * `approval_status` reuses the standard 8-value `ArtifactApprovalStatus` vocabulary verbatim (D5)
 * — governed via a dedicated status-transition endpoint only, never accepted through
 * `create()`/`update()`, same discipline as `brand_library_records.approval_status`.
 *
 * `version` is server-managed (D5), incremented by 1 on every successful content update.
 *
 * `is_published`/`published_at` reuse Brand Library's real publish/unpublish mechanism verbatim
 * (D6) — the seeded `creative_design` RBAC group's own `P` grant (`00013-seed-rbac-matrix.ts`),
 * held only by `super_admin`/`owner_growth_approver`. This is what serves the roadmap's "private
 * assets remain private until approved." `published_at` is server-stamped only, by
 * `AssetRepository.updatePublishState()`'s own atomic `COALESCE` write — never accepted as caller
 * input, and never overwritten once first set.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("assets", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Spec §12's "asset ID" — stable, human-readable, never regenerated once assigned, matching
     *  `brand_library_records.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Not in spec §12's own flat field list — added deliberately (D8), since an asset catalogue
     *  keyed only by an opaque id is not usable and every sibling module has one. */
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    /** Validated as a safe http(s) URL at the DTO layer (`safeHttpUrlSchema`), NOT a DB-level
     *  constraint (D1). Nullable: an asset record can legitimately be catalogued before its file
     *  location is known. Redacted on a `restricted` asset for callers lacking
     *  `view_confidential` (D2). */
    file_reference: { type: DataTypes.STRING(2048), allowNull: true },
    /** Caller-supplied metadata in this pass, NOT derived from a file this system holds (D1) —
     *  becomes server-derived once real upload lands. */
    mime_type: { type: DataTypes.STRING(255), allowNull: true },
    /** BIGINT, not INTEGER: a real media file exceeds INTEGER's ~2.1GB ceiling. Sequelize returns
     *  BIGINT as a string from Postgres, so the entity type declares `string | null`. */
    file_size_bytes: { type: DataTypes.BIGINT, allowNull: true },
    /** Spec §12's "checksum". Sized for a SHA-256 hex digest (64 chars) with room for a prefixed
     *  algorithm label. Caller-supplied in this pass (D1). */
    checksum: { type: DataTypes.STRING(128), allowNull: true },
    /** Spec §12's "dimensions", as two real integer columns rather than one opaque string — a
     *  future UI needs to sort/filter on them. Null for non-visual assets. */
    width_px: { type: DataTypes.INTEGER, allowNull: true },
    height_px: { type: DataTypes.INTEGER, allowNull: true },
    /** Spec §12's "duration", for audio/video. Null for still assets. */
    duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
    /** Spec §12's "licence" — the terms themselves. */
    licence: { type: DataTypes.TEXT, allowNull: true },
    /** The roadmap's "ownership" (`Recommended_Module_Roadmap.md:49`) — who holds the licence. */
    licence_holder: { type: DataTypes.STRING(255), allowNull: true },
    /** Spec §12's "consent". Redacted on a `restricted` asset for callers lacking
     *  `view_confidential` (D2) — consent evidence routinely names real people. */
    consent_reference: { type: DataTypes.TEXT, allowNull: true },
    /** Spec §12's "alt guidance" — guidance for authors writing alt text, not the alt text of one
     *  particular usage (which belongs to the consuming page, not the asset). */
    alt_text_guidance: { type: DataTypes.TEXT, allowNull: true },
    /** Spec §12's "visibility" — a REAL enforcement axis (D2), driving confidential-field
     *  redaction. Same 3-value vocabulary as `services.confidentiality`. */
    visibility: {
      type: DataTypes.ENUM("public", "internal", "restricted"),
      allowNull: false,
      defaultValue: "internal",
    },
    /** Spec §12's "retention", as plain text rather than a FK into Phase 1E's real
     *  `retention_policies` table (D7) — nothing anywhere creates a retention policy, so an FK
     *  would be a permanently unusable field, the exact defect Service Library's own UI review
     *  already surfaced for a required `categoryId` with zero seeded rows. */
    retention_note: { type: DataTypes.TEXT, allowNull: true },
    /** Spec §12's "scan status". Server-managed, never caller input, and never set to `clean` by
     *  any code path in this module (D4) — no scanner exists; nothing is fabricated. */
    scan_status: {
      type: DataTypes.ENUM("not_configured", "pending", "clean", "infected", "failed"),
      allowNull: false,
      defaultValue: "not_configured",
    },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()` (D5), same discipline as `brand_library_records.approval_status`. */
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
     *  status-transition or publish/unpublish call) — D5. */
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    /** Orthogonal to `approval_status` (D6) — governed via the dedicated publish/unpublish
     *  endpoints only, gated on the real seeded `publish`/`unpublish` RBAC actions. */
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** Server-stamped once via `COALESCE(published_at, NOW())` on the first successful
     *  `publish()` — never cleared by `unpublish()`, never re-stamped by a later republish (D6). */
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

  await context.addIndex("assets", ["public_id"], {
    name: "assets_public_id_unique",
    unique: true,
  });
  await context.addIndex("assets", ["approval_status"], {
    name: "assets_approval_status_idx",
  });
  await context.addIndex("assets", ["visibility"], { name: "assets_visibility_idx" });
  await context.addIndex("assets", ["mime_type"], { name: "assets_mime_type_idx" });
  await context.addIndex("assets", ["is_published"], { name: "assets_is_published_idx" });
  await context.addIndex("assets", ["updated_at"], { name: "assets_updated_at_idx" });
  // Fuzzy-search support on title, mirroring brand_library_records_title_trgm_idx (migration
  // 00070)/content_templates_page_type_trgm_idx (00064) — the same
  // `04_Data_Model_and_Ownership.md:241` trigram-index requirement applies equally here.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX assets_title_trgm_idx ON assets USING gin (title gin_trgm_ops);",
  );

  /**
   * Spec §12's "related records" (D3) — a real polymorphic reference, mirroring
   * `reviews.target_module_key`/`target_id`'s own already-reviewed pattern. `module_key` is
   * validated against the real module registry at the service layer via
   * `AuthorizationService.isValidModuleKey()`; `record_id` deliberately carries NO foreign key,
   * since the target may live in any of the 43 registered modules, most of which have no table
   * yet. This also satisfies the roadmap's own "usage" tracking requirement.
   */
  await context.createTable("asset_related_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    asset_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "assets", key: "id" },
      // CASCADE, unlike the SET NULL used for user references above: a relationship row is
      // meaningless without its parent asset, and no hard delete exists for assets today anyway
      // (archived is the retirement mechanism, ADR-0016) — this guards a hypothetical future one.
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** A `module_registry.key` value. Not an FK — `module_registry` is seeded reference data and
     *  the service layer validates against it explicitly, matching `reviews.target_module_key`'s
     *  own identical treatment. */
    module_key: { type: DataTypes.STRING(64), allowNull: false },
    record_id: { type: DataTypes.UUID, allowNull: false },
    note: { type: DataTypes.STRING(500), allowNull: true },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // Prevents the same target being linked to the same asset twice. The service's own upfront
  // duplicate check is TOCTOU; this index is what actually enforces it under concurrency, with
  // the race loser surfacing as a clean 400 via `isSequelizeUniqueConstraintError()`.
  await context.addIndex("asset_related_records", ["asset_id", "module_key", "record_id"], {
    name: "asset_related_records_asset_target_unique",
    unique: true,
  });
  // Leads with `asset_id`, the mandatory scope on every list call — mirrors the composite-index
  // shape Internal Linking Library's own code review established.
  await context.addIndex("asset_related_records", ["asset_id"], {
    name: "asset_related_records_asset_id_idx",
  });
  // Supports the reverse question ("what assets reference this record?"), the real point of
  // tracking usage at all.
  await context.addIndex("asset_related_records", ["module_key", "record_id"], {
    name: "asset_related_records_target_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // Child first — `asset_related_records.asset_id` references `assets.id`.
  await context.dropTable("asset_related_records", {});
  await context.dropTable("assets", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_assets_visibility";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_assets_scan_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_assets_approval_status";');
}
