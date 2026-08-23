import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Website Strategy Center module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md:40-44`) — the 6th
 * real business module, after Projects, Business Knowledge Center, Service Library, Persona
 * Library, and Proof and Claims Library. `docs/task-packages/module-website-strategy-center.md`
 * records the full account, including two decisions confirmed directly with the user (D1: single
 * generic table with a `record_type` discriminator, mirroring Business Knowledge Center's own
 * precedent — the spec names 9 record kinds with zero field list to differentiate them; D2: REAL
 * version history, not a single mutable row like every prior module — the spec's own "compare
 * versions"/"supersede" actions and the roadmap's own "Preserve versions when WebDesk changes
 * business direction" instruction need real prior versions to exist).
 *
 * Every version of a record is its own physical row (task package D3): `id` is unique per
 * row/version; `record_id` is the stable logical-record identity, generated fresh when a record
 * is first created and copied forward unchanged onto every subsequent version — the
 * grouping/history key, NOT the same as `id`. `public_id` is likewise copied forward unchanged
 * across every version, since its whole purpose is a stable human-facing reference across the
 * record's lifetime, not a per-snapshot label — its uniqueness is enforced via a PARTIAL unique
 * index `WHERE is_current = true`, not a bare `UNIQUE(public_id)` column constraint, which would
 * incorrectly reject version 2+ of the same record (which legitimately repeats the same
 * `public_id`). `record_type` is set once at creation and immutable across a record's own version
 * chain — a real type change is a different record, not a new version of this one, enforced
 * server-side (never accepted through the update route).
 *
 * `is_current` is true for exactly one row per `record_id` at any time (the latest version,
 * whether draft or approved) — flipped atomically (old current -> false, new row -> true) in the
 * same transaction that creates a new version (`WebsiteStrategyRecordRepository.createNewVersion()`/
 * `updateInPlace()`, called together from `WebsiteStrategyRecordsService.update()`).
 *
 * `approval_status` reuses the shared generic 8-value artifact-lifecycle vocabulary verbatim from
 * Service Library's/Persona Library's/Proof and Claims Library's own identical `TRANSITIONS`
 * table (task package D6) — a 4th occurrence of this identical shape, deliberately not extracted
 * into a shared helper (already-accepted, out-of-scope debt in this codebase, matching every
 * prior module's own identical disposition). "Supersede" (task package D4) is not a separate user
 * action — it's an automatic consequence of a NEW version's own `-> approved` transition
 * succeeding: the same transaction also flips whichever OTHER version of the same `record_id`
 * currently holds `approval_status = 'approved'` (if any) to `'superseded'`, reusing the already-
 * legal `approved -> superseded` edge. The superseded row is never deleted — permanently readable
 * via the version-history route, satisfying "preserve versions."
 *
 * `content`/`notes` stay plain text for this backend-only pass (task package D7) — no
 * `dashboard-web` UI exists yet, matching every sibling module's own original backend-first
 * precedent (Persona Library/Service Library/Proof and Claims Library all shipped plain
 * unsanitized text first, converting to `RichTextEditor` + real sanitization only once a
 * `dashboard-web` UI was later authorized and built).
 *
 * No `project_id` scoping — organization-wide, matching every other business-content module
 * (task package D9). No confidential-field mechanism — the module registry's own seeded
 * `confidentialityLevel` for `website_strategy_center` is `null` (migration `00035`), the same
 * value Persona Library's/Proof and Claims Library's own entries have. No `version`/`lock_version`
 * columns (task package D10) — this module's real multi-row version history already IS what a
 * bare `version` integer would have tracked in a single-row design (`version_number`, at the row
 * level), and no separate optimistic-lock token is needed since every write here is already an
 * atomic single-statement `UPDATE ... WHERE id = ...` or an atomic compare-and-swap
 * `updateApprovalStatus()`, the same discipline every sibling module's own `update()` already
 * relies on instead of a numeric lock.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("website_strategy_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable across every version row of the same logical record — the grouping/history key. */
    record_id: { type: DataTypes.UUID, allowNull: false },
    /** Stable, human-readable identifier — repeats across every version of the same record;
     *  uniqueness is enforced by the partial unique index below, not a column constraint. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Immutable across a record's own version chain (task package D3) — a real type change is a
     *  different record, not a new version of this one. */
    record_type: {
      type: DataTypes.ENUM(
        "navigation_plan",
        "page_clusters",
        "pillar_strategy",
        "platform_strategy",
        "industry_strategy",
        "location_strategy",
        "conversion_plan",
        "search_plan",
        "internal_link_plan",
      ),
      allowNull: false,
    },
    /** Starts at 1, increments per new version within the same `record_id`. */
    version_number: { type: DataTypes.INTEGER, allowNull: false },
    /** True for exactly one row per `record_id` at any time — see this migration's own top
     *  comment for the atomicity discipline around flipping it. */
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    title: { type: DataTypes.TEXT, allowNull: false },
    /** Plain text (task package D7) — no rich-text/sanitization pass yet, no UI exists yet. */
    content: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()`, same discipline as every sibling module's own `approval_status`.
     *  Reuses the shared generic-lifecycle vocabulary verbatim (task package D6). */
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
  await context.addIndex("website_strategy_records", ["public_id"], {
    name: "website_strategy_records_public_id_current_unique",
    unique: true,
    where: { is_current: true },
  });
  // No two versions of the same record share a version number.
  await context.addIndex("website_strategy_records", ["record_id", "version_number"], {
    name: "website_strategy_records_record_version_unique",
    unique: true,
  });
  // The common "find the current version of a record" lookup.
  await context.addIndex("website_strategy_records", ["record_id", "is_current"], {
    name: "website_strategy_records_record_current_idx",
  });
  // Fuzzy-search support on title, mirroring services_canonical_name_trgm_idx/personas_name_trgm_idx/
  // proof_claims_claim_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX website_strategy_records_title_trgm_idx ON website_strategy_records USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("website_strategy_records", {});
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_website_strategy_records_approval_status";',
  );
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_website_strategy_records_record_type";');
}
