import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Case Study Studio — module #23 on the Recommended Module Roadmap
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §7`,
 * `07_Low_Fidelity_Wireframes.md §4`, `04_Data_Model_and_Ownership.md:133-137`). Four tables:
 * `case_studies` (the parent), `case_study_assets` (D3, a real many-to-many join into the
 * already-live `assets` table), `case_study_consents` (case-study-level consent evidence, distinct
 * from an individual asset's own `consent_reference`), and `case_study_approvals` (a queryable
 * decision-history log for the two approval stages, mirroring Review and Approval Center's own
 * `review_decisions` table shape). See `docs/implementation/module-case-study-studio.md` for the
 * full D1-D10 design account.
 *
 * D1 — the full bespoke 14-stage lifecycle named in the spec (not a trimmed version): `intake`,
 * `upload`, `completeness_review`, `ready_for_claude`, `missing_information`, `draft`,
 * `search_review`, `fact_confidentiality_review`, `internal_approval`, `client_approval`,
 * `scheduled`, `published`, `unpublished`, `archived`. `archived` is terminal.
 *
 * D2 — claims/sources are NOT duplicated here as their own tables (unlike the canonical data-model
 * doc's own separate `case_study_claims`/`case_study_sources` names) — this module reuses the
 * real, already-live Proof and Claims Library directly via `related_claim_ids`
 * (existence-validated against `proof_claims`, via `ClaimsService.existingClaimIds()`).
 *
 * D3 — `case_study_assets` is a real many-to-many join into the real, already-live `assets` table
 * (Asset Library, module #15) rather than a standalone table duplicating licence/consent fields
 * Asset Library already owns. `asset_id` is existence-validated at the app layer (not a DB FK to
 * keep this module decoupled from Asset Library's own schema evolution, matching every sibling
 * cross-module "unvalidated at the DB layer, validated at the app layer via a narrow delegating
 * service method" precedent in this codebase, e.g. `services.related_service_ids`).
 *
 * D9 — no confidentiality field: the module registry's own seeded `confidentiality_level` for
 * `case_study_studio` is `null`, matching Persona/Website Strategy Center's own precedent — the
 * `visibility` field on the parent is a workflow/publication concept, not a per-field redaction
 * axis.
 *
 * Organization-wide, not project-scoped — no `project_id` column, matching Persona/Service/Brand
 * Library's own precedent.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("case_studies", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    client_name: { type: DataTypes.STRING(255), allowNull: false },
    project_title: { type: DataTypes.STRING(255), allowNull: false },
    industry: { type: DataTypes.STRING(255), allowNull: true },
    platform: { type: DataTypes.STRING(255), allowNull: true },
    /** Reuses the Case Study Library spec's own 4-value vocabulary (§8) — Studio is the same
     *  content before it graduates to the Library, so the same visibility vocabulary applies. */
    visibility: {
      type: DataTypes.ENUM("public", "internal_only", "confidential", "client_approval_required"),
      allowNull: false,
      defaultValue: "internal_only",
    },
    embargo_date: { type: DataTypes.DATEONLY, allowNull: true },
    /** The wireframe's own 4-field narrative group (§4) — real HTML from `dashboard-web`'s
     *  `RichTextEditor`, sanitized write-time + render-time, per the 2026-08-22 standing rule,
     *  even though no `dashboard-web` UI exists yet in this pass (D10) — matching every prior
     *  backend-only module's own precedent of wiring sanitization ahead of the UI build. */
    challenge: { type: DataTypes.TEXT, allowNull: true },
    solution: { type: DataTypes.TEXT, allowNull: true },
    implementation: { type: DataTypes.TEXT, allowNull: true },
    results: { type: DataTypes.TEXT, allowNull: true },
    /** Existence-validated against the real `services` table (D5). */
    related_service_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Existence-validated against the real `proof_claims` table (D2) — supersedes the canonical
     *  data-model doc's own `case_study_claims` table name. */
    related_claim_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    assigned_reviewer_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Gates whether `internal_approval` can go straight to `scheduled` or must pass through
     *  `client_approval` (D7). */
    client_approval_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()`, same discipline as `services.approval_status`/
     *  `personas.approval_status`. `archived` is terminal (D1). */
    status: {
      type: DataTypes.ENUM(
        "intake",
        "upload",
        "completeness_review",
        "ready_for_claude",
        "missing_information",
        "draft",
        "search_review",
        "fact_confidentiality_review",
        "internal_approval",
        "client_approval",
        "scheduled",
        "published",
        "unpublished",
        "archived",
      ),
      allowNull: false,
      defaultValue: "intake",
    },
    scheduled_publish_at: { type: DataTypes.DATE, allowNull: true },
    /** Server-stamped, `COALESCE`-write, never overwritten once set — matching every sibling
     *  publish mechanism (e.g. Content Template Library's/Asset Library's own `published_at`). */
    published_at: { type: DataTypes.DATE, allowNull: true },
    /** The spec's own named "mandatory governance" field — required by the service layer
     *  specifically on the `published -> unpublished` transition, not enforced at the schema
     *  level (D5). */
    unpublish_reason: { type: DataTypes.TEXT, allowNull: true },
    /** Server-managed, incremented on every content edit (D5/D8) — a plain counter, unlike
     *  Website Strategy Center's real multi-row version history: this module has no "compare
     *  versions" requirement anywhere in its own spec. */
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
  await context.addIndex("case_studies", ["public_id"], {
    name: "case_studies_public_id_unique",
    unique: true,
  });
  await context.addIndex("case_studies", ["status"], {
    name: "case_studies_status_idx",
  });
  await context.addIndex("case_studies", ["updated_at"], {
    name: "case_studies_updated_at_idx",
  });
  // Fuzzy-search support over the two identity fields, mirroring
  // proof_claims_claim_trgm_idx/personas_name_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX case_studies_client_name_trgm_idx ON case_studies USING gin (client_name gin_trgm_ops);",
  );
  await context.sequelize.query(
    "CREATE INDEX case_studies_project_title_trgm_idx ON case_studies USING gin (project_title gin_trgm_ops);",
  );

  // --- case_study_assets (D3, real many-to-many join into `assets`) ---
  await context.createTable("case_study_assets", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    case_study_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "case_studies", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** NOT a DB-level FK into `assets` — existence-validated at the app layer via
     *  `AssetsService.existingAssetIds()` (D3's own doc comment), matching every sibling
     *  cross-module relationship's "unvalidated at the DB layer" precedent, so this module stays
     *  decoupled from Asset Library's own schema/deletion lifecycle rather than cascading a
     *  case-study asset link when an unrelated asset is hard-deleted elsewhere. */
    asset_id: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.STRING(64), allowNull: false },
    caption: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("case_study_assets", ["case_study_id"], {
    name: "case_study_assets_case_study_id_idx",
  });
  await context.addIndex("case_study_assets", ["case_study_id", "asset_id"], {
    name: "case_study_assets_case_study_id_asset_id_unique",
    unique: true,
  });

  // --- case_study_consents (case-study-level consent evidence) ---
  await context.createTable("case_study_consents", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    case_study_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "case_studies", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    consent_type: { type: DataTypes.STRING(64), allowNull: false },
    /** Validated as a safe http(s) URL at the DTO layer (`safeHttpUrlSchema`,
     *  `@webdesk/validation`) — NOT a DB constraint, matching `brand_library_records.file_reference`'s
     *  precedent. */
    consent_evidence_reference: { type: DataTypes.TEXT, allowNull: true },
    /** The external client contact's name — deliberately NOT a `users` FK, since this is an
     *  external party outside this application's own identity model. */
    granted_by: { type: DataTypes.STRING(255), allowNull: true },
    granted_at: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("case_study_consents", ["case_study_id"], {
    name: "case_study_consents_case_study_id_idx",
  });

  // --- case_study_approvals (queryable decision-history log, D4/D7) ---
  await context.createTable("case_study_approvals", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    case_study_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "case_studies", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    approval_type: { type: DataTypes.ENUM("internal", "client"), allowNull: false },
    decision: {
      type: DataTypes.ENUM("approved", "rejected", "revision_requested"),
      allowNull: false,
    },
    decided_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("case_study_approvals", ["case_study_id"], {
    name: "case_study_approvals_case_study_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("case_study_approvals", {});
  await context.dropTable("case_study_consents", {});
  await context.dropTable("case_study_assets", {});
  await context.dropTable("case_studies", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_case_study_approvals_decision";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_case_study_approvals_approval_type";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_case_studies_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_case_studies_visibility";');
}
