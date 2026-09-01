import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Portfolio Library — module #25 on the Recommended Module Roadmap
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §9`). Two tables:
 * `portfolio_records` (the parent) and `portfolio_assets` (D2, a real many-to-many join into the
 * already-live `assets` table, mirroring `case_study_assets` (migration `00091`) exactly). See
 * `docs/implementation/module-portfolio-library.md` for the full D1-D8 design account.
 *
 * D1 — a single flat table, no `recordType` discriminator — the spec names one flat field list,
 * not a taxonomy of record types. Organization-wide, no `project_id` column.
 *
 * D2 — `portfolio_assets` (screenshots) is a real many-to-many join into `assets`. `asset_id` is
 * NOT a DB-level FK — existence-validated at the app layer via `AssetsService.existingAssetIds()`,
 * matching every sibling cross-module relationship's "unvalidated at the DB layer" precedent, so
 * this module stays decoupled from Asset Library's own schema/deletion lifecycle.
 *
 * D3 — `related_proof_ids` (proof) is a real existence-validated array column, validated against
 * the live `proof_claims` table via `ClaimsService.existingClaimIds()` — NOT a DB-level FK, the
 * same "unvalidated at the DB layer, validated at the app layer" precedent as `services.related_
 * service_ids`/`case_studies.related_claim_ids`.
 *
 * D4 — `visibility` reuses Case Study Studio's own 4-value vocabulary (`public | internal_only |
 * confidential | client_approval_required`).
 *
 * D5 — `publicationStatus` is a real, orthogonal publish/unpublish mechanism (`is_published`/
 * `published_at`), mirroring Content Template Library's/Brand Library's own pair exactly — atomic
 * compare-and-swap, `publish()` requires `approvalStatus === "approved"`, `unpublish()` has no
 * status restriction, `publishedAt` stamped once via `COALESCE`, never cleared/overwritten.
 *
 * D6 — the standard 8-value `ArtifactApprovalStatus` workflow, reused verbatim (the same
 * `TRANSITIONS` table copied byte-for-byte into each new module, the established, already-accepted
 * duplication precedent).
 *
 * D7 — `version` is server-managed, incremented by 1 on every successful content update only.
 *
 * D8 — remaining flat fields: `publicId` (create-only), `projectOrClientName`, `url` (validated as
 * a safe http(s) URL at the DTO layer, `safeHttpUrlSchema` — NOT a DB constraint, matching
 * `brand_library_records.file_reference`'s precedent), `primaryCategory`, `additionalCategories`
 * (plain string array, NOT NULL default `{}` — no categories taxonomy module exists), `tags`
 * (plain string array, NOT NULL default `{}`), `industry`, `platform`, `serviceType`,
 * `launchDate` (nullable date).
 *
 * No confidentiality field (matches Persona/Website Strategy Center/Case Study Studio's own
 * precedent) — the module registry's own seeded `confidentiality_level` for `portfolio_library` is
 * a plain business field description ("record-level (has a visibility field; level unspecified)"),
 * not an RBAC confidential-field mechanism; `visibility` is the real business concept here.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("portfolio_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    project_or_client_name: { type: DataTypes.STRING(255), allowNull: false },
    /** Validated as a safe http(s) URL at the DTO layer (`safeHttpUrlSchema`,
     *  `@webdesk/validation`) — NOT a DB constraint (D8). */
    url: { type: DataTypes.TEXT, allowNull: true },
    primary_category: { type: DataTypes.STRING(255), allowNull: true },
    additional_categories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    industry: { type: DataTypes.STRING(255), allowNull: true },
    platform: { type: DataTypes.STRING(255), allowNull: true },
    service_type: { type: DataTypes.STRING(255), allowNull: true },
    launch_date: { type: DataTypes.DATEONLY, allowNull: true },
    /** Existence-validated against the real `proof_claims` table (D3) — supersedes any
     *  bespoke "portfolio proof" table name the advisory roadmap material might imply. */
    related_proof_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Reuses Case Study Studio's own 4-value vocabulary (D4). */
    visibility: {
      type: DataTypes.ENUM("public", "internal_only", "confidential", "client_approval_required"),
      allowNull: false,
      defaultValue: "internal_only",
    },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()`, same discipline as `services.approval_status`/
     *  `personas.approval_status`/`content_templates.approval_status` (D6). */
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
    /** Orthogonal to `approval_status` (D5) — mirrors `content_templates.is_published`/
     *  `published_at` exactly. Governed via dedicated publish()/unpublish() routes only. */
    is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** Server-stamped once via `COALESCE(published_at, NOW())` on the first successful `publish()`
     *  — never cleared by `unpublish()`, never re-stamped by a later republish (D5). */
    published_at: { type: DataTypes.DATE, allowNull: true },
    /** Server-managed, incremented by 1 on every successful content `update()` only — never on a
     *  status-transition or publish/unpublish call (D7). */
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
  await context.addIndex("portfolio_records", ["public_id"], {
    name: "portfolio_records_public_id_unique",
    unique: true,
  });
  await context.addIndex("portfolio_records", ["approval_status"], {
    name: "portfolio_records_approval_status_idx",
  });
  await context.addIndex("portfolio_records", ["updated_at"], {
    name: "portfolio_records_updated_at_idx",
  });
  // Fuzzy-search support, mirroring case_studies_client_name_trgm_idx/personas_name_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX portfolio_records_project_or_client_name_trgm_idx ON portfolio_records USING gin (project_or_client_name gin_trgm_ops);",
  );

  // --- portfolio_assets (D2, real many-to-many join into `assets`, mirrors case_study_assets) ---
  await context.createTable("portfolio_assets", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    portfolio_record_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "portfolio_records", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** NOT a DB-level FK into `assets` — existence-validated at the app layer via
     *  `AssetsService.existingAssetIds()` (D2), matching `case_study_assets.asset_id`'s own
     *  identical precedent, so this module stays decoupled from Asset Library's own schema/
     *  deletion lifecycle rather than cascading a portfolio asset link when an unrelated asset is
     *  hard-deleted elsewhere. */
    asset_id: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.STRING(64), allowNull: false },
    caption: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("portfolio_assets", ["portfolio_record_id"], {
    name: "portfolio_assets_portfolio_record_id_idx",
  });
  await context.addIndex("portfolio_assets", ["portfolio_record_id", "asset_id"], {
    name: "portfolio_assets_portfolio_record_id_asset_id_unique",
    unique: true,
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("portfolio_assets", {});
  await context.dropTable("portfolio_records", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_portfolio_records_approval_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_portfolio_records_visibility";');
}
