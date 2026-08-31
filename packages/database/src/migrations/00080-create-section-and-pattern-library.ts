import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Section and Pattern Library module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §15`) — module #15 on
 * the Recommended Module Roadmap. Unlike most modules built so far, §15 gives no field list — only
 * a taxonomy of pattern types. See `docs/implementation/module-section-and-pattern-library.md` for
 * the full scope account and the three design forks confirmed directly with the project owner.
 *
 * File-for-file mirrors `00076-create-design-token-library.ts` — every version of a record is its
 * own physical row: `id` is unique per row/version; `record_id` is the stable logical-record
 * identity, generated fresh when a record is first created and copied forward unchanged onto every
 * subsequent version — the grouping/history key, NOT the same as `id`. `public_id` is likewise
 * copied forward unchanged across every version, since its whole purpose is a stable human-facing
 * reference across the record's lifetime, not a per-snapshot label — its uniqueness is enforced via
 * a PARTIAL unique index `WHERE is_current = true`, not a bare `UNIQUE(public_id)` column
 * constraint, which would incorrectly reject version 2+ of the same record (which legitimately
 * repeats the same `public_id`). `pattern_type` is set once at creation and immutable across a
 * record's own version chain — a real pattern-type change is a different record, not a new version
 * of this one, enforced server-side (never accepted through the update route).
 *
 * `is_current` is true for exactly one row per `record_id` at any time (the latest version, whether
 * draft or approved) — flipped atomically (old current -> false, new row -> true) in the same
 * transaction that creates a new version (`SectionPatternRecordRepository.createNewVersion()`/
 * `updateInPlace()`, called together from `SectionPatternsService.update()`).
 *
 * `approval_status` reuses the shared generic 8-value artifact-lifecycle vocabulary verbatim from
 * Design Token Library's/Website Strategy Center's/Service Library's/Persona Library's/Proof and
 * Claims Library's own identical `TRANSITIONS` table (design decision 2) — deliberately not
 * extracted into a shared helper (already-accepted, out-of-scope debt in this codebase), with the
 * same deliberate deviation Design Token Library's/Website Strategy Center's own table has: no
 * `approved -> superseded` edge, since "supersede" is not a separate user action — it's an
 * automatic consequence of a NEW version's own `-> approved` transition succeeding: the same
 * transaction also flips whichever OTHER version of the same `record_id` currently holds
 * `approval_status = 'approved'` (if any) to `'superseded'`, calling the repository's
 * `supersedeOtherApprovedVersion()` directly rather than going through the `TRANSITIONS` table at
 * all. The superseded row is never deleted — permanently readable via the version-history route.
 *
 * `js_dependencies`/`token_references`/`related_component_ids` are plain, unvalidated string arrays
 * (design decision 3-adjacent) — no `design_token_library`-version-identity linking or
 * `component_library` module exists yet to link them to for real, matching the established
 * precedent (Design Token Library's own `usage_references`, Persona Library's
 * `related_service_ids`) for a relationship with no real target module/identity shape yet.
 *
 * No `project_id` scoping — organization-wide, matching every other library-shaped module. No
 * confidential-field mechanism — the module registry's own seeded `confidentialityLevel` for
 * `section_and_pattern_library` is `null` (migration `00035`). No publish/unpublish action (design
 * decision 3) — the RBAC `creative_design` group seeds a Publish/Unpublish action pair (used by
 * Design Reference Library, skipped by Design Token Library), but nothing in this module's own spec
 * entry names a publish concept, matching Design Token Library, the closer structural sibling given
 * the version-history choice above. Backend-only pass — `dashboard-web` UI is a separate,
 * not-yet-requested next step, matching every prior module's own backend-first precedent.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("section_pattern_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable across every version row of the same logical record — the grouping/history key. */
    record_id: { type: DataTypes.UUID, allowNull: false },
    /** Stable, human-readable identifier — repeats across every version of the same record;
     *  uniqueness is enforced by the partial unique index below, not a column constraint. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Immutable across a record's own version chain — a real pattern-type change is a different
     *  record, not a new version of this one. The spec's own §15 taxonomy, 20 values. */
    pattern_type: {
      type: DataTypes.ENUM(
        "homepage_storytelling",
        "service",
        "industry",
        "location",
        "landing_conversion",
        "portfolio_showcase",
        "social_proof",
        "results_metrics",
        "engagement_models",
        "team_expertise",
        "content_hub",
        "article",
        "lead_capture",
        "download",
        "multi_step_form",
        "search_filter",
        "trust",
        "objection_handling",
        "cross_sell",
        "error_no_results",
      ),
      allowNull: false,
    },
    /** Starts at 1, increments per new version within the same `record_id`. */
    version_number: { type: DataTypes.INTEGER, allowNull: false },
    /** True for exactly one row per `record_id` at any time — see this migration's own top
     *  comment for the atomicity discipline around flipping it. */
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    /** Rich-text-sanitized (usage guidance — what the pattern is for). */
    description: { type: DataTypes.TEXT, allowNull: true },
    /** `safeHttpUrlSchema`-validated at the API layer (Figma/design reference), matching Design
     *  Reference Library's `sourceUrl` precedent. */
    design_reference: { type: DataTypes.TEXT, allowNull: true },
    /** A code snippet, not prose — plain, no rich-text sanitization applied. */
    html_structure: { type: DataTypes.TEXT, allowNull: true },
    php_path: { type: DataTypes.STRING(500), allowNull: true },
    /** SCSS classes/path, combined into one field per Component Library's own single line item. */
    scss_reference: { type: DataTypes.TEXT, allowNull: true },
    js_dependencies: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Rich-text-sanitized (desktop/mobile/tablet behavior notes). */
    responsive_behavior: { type: DataTypes.TEXT, allowNull: true },
    /** Rich-text-sanitized. */
    accessibility_notes: { type: DataTypes.TEXT, allowNull: true },
    browser_support: { type: DataTypes.TEXT, allowNull: true },
    /** Plain, unvalidated string array — no real relationship to `design_token_library` yet (see
     *  this migration's own top comment). */
    token_references: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Plain, unvalidated string array — `component_library` doesn't exist yet. */
    related_component_ids: {
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
  await context.addIndex("section_pattern_records", ["public_id"], {
    name: "section_pattern_records_public_id_current_unique",
    unique: true,
    where: { is_current: true },
  });
  // No two versions of the same record share a version number.
  await context.addIndex("section_pattern_records", ["record_id", "version_number"], {
    name: "section_pattern_records_record_version_unique",
    unique: true,
  });
  // The common "find the current version of a record" lookup.
  await context.addIndex("section_pattern_records", ["record_id", "is_current"], {
    name: "section_pattern_records_record_current_idx",
  });
  // list()'s actual query shape: WHERE is_current = true, ORDER BY updated_at DESC, id ASC — the
  // composite above can't serve this efficiently since record_id (not is_current) is its leading
  // column. Partial on is_current = true, same technique as the public_id uniqueness index above
  // (code-review finding — the same gap exists, uncorrected, in design_tokens; closed here since
  // it's purely additive and carries no cross-module divergence risk).
  await context.addIndex("section_pattern_records", ["updated_at", "id"], {
    name: "section_pattern_records_current_updated_idx",
    where: { is_current: true },
  });
  // supersedeOtherApprovedVersion()'s UPDATE filters on (record_id, approval_status = 'approved')
  // with no supporting index otherwise (code-review finding, same rationale as above).
  await context.addIndex("section_pattern_records", ["record_id", "approval_status"], {
    name: "section_pattern_records_record_approval_status_idx",
  });
  // Fuzzy-search support on name, mirroring design_tokens_name_trgm_idx/
  // website_strategy_records_title_trgm_idx/services_canonical_name_trgm_idx/etc.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX section_pattern_records_name_trgm_idx ON section_pattern_records USING gin (name gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("section_pattern_records", {});
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_section_pattern_records_approval_status";',
  );
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_section_pattern_records_pattern_type";');
}
