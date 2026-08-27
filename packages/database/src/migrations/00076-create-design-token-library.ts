import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Design Token Library module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §13`,
 * `04_Data_Model_and_Ownership.md:147-148`) — module #14 on the Recommended Module Roadmap. A
 * catalog of literal design-token values (colors, spacing, typography, etc.) for the **WordPress
 * website** deliverable, deliberately isolated from this dashboard's own `packages/ui` design
 * tokens, which are a separate, unrelated system. See
 * `docs/implementation/module-design-token-library.md` for the full scope account.
 *
 * File-for-file mirrors `00056-create-website-strategy-center.ts` — every version of a record is
 * its own physical row: `id` is unique per row/version; `record_id` is the stable logical-record
 * identity, generated fresh when a record is first created and copied forward unchanged onto
 * every subsequent version — the grouping/history key, NOT the same as `id`. `public_id` is
 * likewise copied forward unchanged across every version, since its whole purpose is a stable
 * human-facing reference across the record's lifetime, not a per-snapshot label — its uniqueness
 * is enforced via a PARTIAL unique index `WHERE is_current = true`, not a bare `UNIQUE(public_id)`
 * column constraint, which would incorrectly reject version 2+ of the same record (which
 * legitimately repeats the same `public_id`). `group` is set once at creation and immutable
 * across a record's own version chain — a real group change is a different record, not a new
 * version of this one, enforced server-side (never accepted through the update route).
 *
 * `is_current` is true for exactly one row per `record_id` at any time (the latest version,
 * whether draft or approved) — flipped atomically (old current -> false, new row -> true) in the
 * same transaction that creates a new version (`DesignTokenRepository.createNewVersion()`/
 * `updateInPlace()`, called together from `DesignTokensService.update()`).
 *
 * `approval_status` reuses the shared generic 8-value artifact-lifecycle vocabulary verbatim from
 * Website Strategy Center's/Service Library's/Persona Library's/Proof and Claims Library's own
 * identical `TRANSITIONS` table (design decision 2) — deliberately not extracted into a shared
 * helper (already-accepted, out-of-scope debt in this codebase), with the same deliberate
 * deviation Website Strategy Center's own table has: no `approved -> superseded` edge, since
 * "supersede" is not a separate user action — it's an automatic consequence of a NEW version's
 * own `-> approved` transition succeeding: the same transaction also flips whichever OTHER
 * version of the same `record_id` currently holds `approval_status = 'approved'` (if any) to
 * `'superseded'`, calling the repository's `supersedeOtherApprovedVersion()` directly rather than
 * going through the `TRANSITIONS` table at all. The superseded row is never deleted —
 * permanently readable via the version-history route, satisfying "version changes" (roadmap's own
 * language for this module).
 *
 * `usage_references` is a plain, unvalidated string array (design decision 3) — no
 * `component_library`/`page_workspace`(-consuming-side) module exists yet to link it to for real,
 * matching the established precedent (Persona Library's `related_service_ids`, Proof and Claims
 * Library's `related_page_ids`) for a relationship with no real target module yet.
 *
 * No `project_id` scoping — organization-wide, matching every other library-shaped module. No
 * confidential-field mechanism — the module registry's own seeded `confidentialityLevel` for
 * `design_token_library` is `null` (migration `00035`), the same value Persona Library's/Proof
 * and Claims Library's/Website Strategy Center's own entries have. Backend-only pass —
 * `dashboard-web` UI is a separate, not-yet-requested next step, matching every prior module's own
 * backend-first precedent.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("design_tokens", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable across every version row of the same logical record — the grouping/history key. */
    record_id: { type: DataTypes.UUID, allowNull: false },
    /** Stable, human-readable identifier — repeats across every version of the same record;
     *  uniqueness is enforced by the partial unique index below, not a column constraint. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Immutable across a record's own version chain — a real group change is a different
     *  record, not a new version of this one. */
    group: {
      type: DataTypes.ENUM(
        "colors",
        "semantic_statuses",
        "theme",
        "typography",
        "spacing",
        "grids",
        "breakpoints",
        "borders",
        "shadows",
        "opacity_and_z_index",
        "icon_sizes",
        "media_ratios",
        "component_sizes",
        "motion",
        "interactive_states",
      ),
      allowNull: false,
    },
    /** Starts at 1, increments per new version within the same `record_id`. */
    version_number: { type: DataTypes.INTEGER, allowNull: false },
    /** True for exactly one row per `record_id` at any time — see this migration's own top
     *  comment for the atomicity discipline around flipping it. */
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: false },
    unit: { type: DataTypes.STRING(32), allowNull: true },
    semantic_purpose: { type: DataTypes.TEXT, allowNull: true },
    responsive_variation: { type: DataTypes.TEXT, allowNull: true },
    theme_variation: { type: DataTypes.ENUM("light", "dark", "both"), allowNull: true },
    /** Plain, unvalidated string array (design decision 3) — no target module exists yet. */
    usage_references: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()`, same discipline as every sibling module's own `approval_status`.
     *  Reuses the shared generic-lifecycle vocabulary verbatim (design decision 2). */
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

  // Uniqueness among only the currently-active rows — a plain UNIQUE(public_id) would incorrectly
  // reject version 2+ of the same record, which legitimately repeats the same public_id.
  await context.addIndex("design_tokens", ["public_id"], {
    name: "design_tokens_public_id_current_unique",
    unique: true,
    where: { is_current: true },
  });
  // No two versions of the same record share a version number.
  await context.addIndex("design_tokens", ["record_id", "version_number"], {
    name: "design_tokens_record_version_unique",
    unique: true,
  });
  // The common "find the current version of a record" lookup.
  await context.addIndex("design_tokens", ["record_id", "is_current"], {
    name: "design_tokens_record_current_idx",
  });
  // Fuzzy-search support on name, mirroring website_strategy_records_title_trgm_idx/
  // services_canonical_name_trgm_idx/personas_name_trgm_idx/proof_claims_claim_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX design_tokens_name_trgm_idx ON design_tokens USING gin (name gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("design_tokens", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_design_tokens_approval_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_design_tokens_theme_variation";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_design_tokens_group";');
}
