import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Proof and Claims Library module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §22`) — two tables,
 * unlike Persona Library's single flat table: `proof_claims` (the parent) and `claim_sources` (a
 * real one-to-many child), since `04_Data_Model_and_Ownership.md:119-120` explicitly names both
 * `proof_claims` and `claim_sources` as separate tables — confirmed directly with the project
 * owner rather than collapsing sources into a JSONB array on the parent.
 *
 * The canonical spec's flat field list: "claim, claim type, source, source URL/file, before/after
 * values, verification, approved wording, restrictions, expiry/review date, related
 * services/cases/pages." The roadmap's own language ("Evidence first... Every public claim needs
 * source/verification/usage status... public content cannot use an unverified claim") grounds
 * `verification_status` directly — no enforcement point exists yet since no consuming module
 * (page_inventory/case_study_studio) is built yet; none is fabricated here.
 *
 * `related_service_ids` is EXISTENCE-VALIDATED against the real `services` table (Service Library
 * already exists — mirrors Persona Library's own `relatedServiceIds`/`assertServiceIdsExist()`
 * precedent exactly). `related_case_study_ids`/`related_page_ids` are UNVALIDATED string arrays —
 * `case_study_studio`/`page_inventory` don't exist yet, mirroring Service Library's own
 * `relatedPageIds`/`relatedCaseStudyIds` precedent.
 *
 * No `confidentiality` field — the module registry's own seeded `confidentialityLevel` for
 * `proof_and_claims_library` is `null` (migration `00035`), the same value Persona Library's own
 * entry has; Persona Library's build already decided not to add a Service-Library-style
 * confidentiality/redaction mechanism for exactly that reason (see
 * `apps/dashboard-api/src/persona-library/persona-library.module.ts`'s own doc comment). An
 * advisory-only document (`canonical-inputs/Recommended_Module_Roadmap.md`) suggests "confidential
 * claims need separate access control," but per this project's own standing rule that document
 * "is recorded-for-reference only and authorizes nothing" — the module registry's own real seeded
 * data wins.
 *
 * No `version` field — unlike Persona Library, the canonical spec names no "version" field for
 * proof claims, so none is added.
 *
 * Organization-wide, not project-scoped — no `project_id` column, matching Service Library,
 * Business Knowledge Center, and Persona Library.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("proof_claims", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching
     *  `personas.public_id`/`services.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** The claim wording itself. */
    claim: { type: DataTypes.TEXT, allowNull: false },
    /** Free text — no enum basis exists anywhere in the canonical docs, so none is invented,
     *  mirroring how Service Library left `shortPublicDescription` as free text with no forced
     *  categorization. */
    claim_type: { type: DataTypes.STRING(255), allowNull: true },
    before_value: { type: DataTypes.STRING(255), allowNull: true },
    after_value: { type: DataTypes.STRING(255), allowNull: true },
    /** Grounded directly in the roadmap's own language — "public content cannot use an unverified
     *  claim." */
    verification_status: {
      type: DataTypes.ENUM("unverified", "pending", "verified"),
      allowNull: false,
      defaultValue: "unverified",
    },
    approved_wording: { type: DataTypes.TEXT, allowNull: true },
    restrictions: { type: DataTypes.TEXT, allowNull: true },
    expiry_review_date: { type: DataTypes.DATEONLY, allowNull: true },
    /** Existence-validated against the real `services` table — D-parallel to Persona Library's own
     *  `related_service_ids`. */
    related_service_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Unvalidated — `case_study_studio` doesn't exist yet. */
    related_case_study_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Unvalidated — `page_inventory` doesn't exist yet. */
    related_page_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()`, same discipline as `services.approval_status`/
     *  `personas.approval_status`. Reuses Service Library's/Persona Library's exact 8-state
     *  vocabulary and `TRANSITIONS` table verbatim — a 3rd occurrence of this identical shape,
     *  already-accepted, out-of-scope debt in this codebase (not extracted into a shared helper). */
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
  await context.addIndex("proof_claims", ["public_id"], {
    name: "proof_claims_public_id_unique",
    unique: true,
  });
  await context.addIndex("proof_claims", ["approval_status"], {
    name: "proof_claims_approval_status_idx",
  });
  await context.addIndex("proof_claims", ["updated_at"], {
    name: "proof_claims_updated_at_idx",
  });
  // Fuzzy-search support, mirroring personas_name_trgm_idx/services_canonical_name_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX proof_claims_claim_trgm_idx ON proof_claims USING gin (claim gin_trgm_ops);",
  );

  await context.createTable("claim_sources", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    claim_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "proof_claims", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** Description of the source. */
    source: { type: DataTypes.TEXT, allowNull: false },
    /** URL or file reference. */
    source_url: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("claim_sources", ["claim_id"], {
    name: "claim_sources_claim_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("claim_sources", {});
  await context.dropTable("proof_claims", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_proof_claims_approval_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_proof_claims_verification_status";');
}
