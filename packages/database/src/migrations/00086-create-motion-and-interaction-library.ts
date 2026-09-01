import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Motion and Interaction Library module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §18`) — module #20 on
 * the Recommended Module Roadmap. File-for-file mirrors
 * `00080-create-section-and-pattern-library.ts`/`00082-create-page-template-library.ts` — every
 * version of a record is its own physical row: `id` is unique per row/version; `record_id` is the
 * stable logical-record identity, generated fresh when a record is first created and copied
 * forward unchanged onto every subsequent version — the grouping/history key, NOT the same as
 * `id`. `public_id` is likewise copied forward unchanged across every version, since its whole
 * purpose is a stable human-facing reference across the record's lifetime, not a per-snapshot
 * label — its uniqueness is enforced via a PARTIAL unique index `WHERE is_current = true`, not a
 * bare `UNIQUE(public_id)` column constraint, which would incorrectly reject version 2+ of the
 * same record (which legitimately repeats the same `public_id`). `category` is set once at
 * creation and immutable across a record's own version chain — a real category change is a
 * different record, not a new version of this one, enforced server-side (never accepted through
 * the update route).
 *
 * `is_current` is true for exactly one row per `record_id` at any time (the latest version,
 * whether draft or approved) — flipped atomically (old current -> false, new row -> true) in the
 * same transaction that creates a new version (`MotionInteractionRecordRepository.createNewVersion()`/
 * `updateInPlace()`, called together from `MotionInteractionsService.update()`).
 *
 * `approval_status` reuses the shared generic 8-value artifact-lifecycle vocabulary verbatim from
 * Section and Pattern Library's/Page Template Library's/Design Token Library's/Component
 * Library's own identical `TRANSITIONS` table — deliberately not extracted into a shared helper
 * (already-accepted, out-of-scope debt in this codebase), with the same deliberate deviation
 * those tables have: no `approved -> superseded` edge, since "supersede" is not a separate user
 * action — it's an automatic consequence of a NEW version's own `-> approved` transition
 * succeeding: the same transaction also flips whichever OTHER version of the same `record_id`
 * currently holds `approval_status = 'approved'` (if any) to `'superseded'`, calling the
 * repository's `supersedeOtherApprovedVersion()` directly rather than going through the
 * `TRANSITIONS` table at all. The superseded row is never deleted — permanently readable via the
 * version-history route.
 *
 * `related_component_ids` is a real, existence-validated relationship into Component Library
 * (`ComponentsService.existingComponentIds()`), mirroring Page Template Library's own
 * `supportedComponentIds` pattern — Component Library already exists, so, unlike Section and
 * Pattern Library's own `related_component_ids` (added before Component Library existed), this
 * one is validated for real rather than left as a plain unvalidated string array.
 *
 * `timing_and_easing`/`implementation_spec`/`fallback_behavior` are plain code/spec-value fields —
 * no rich-text sanitization applied, matching Section and Pattern Library's own
 * `scss_reference`/`html_structure` treatment. `description`/`trigger_and_behavior`/
 * `accessibility_notes` are rich-text-sanitized.
 *
 * No `project_id` scoping — organization-wide, matching every other library-shaped module. No
 * confidential-field mechanism — the module registry's own seeded `confidentialityLevel` for
 * `motion_and_interaction_library` is `null` (migration `00035`). No publish/unpublish action —
 * nothing in this module's own spec entry names a publish concept, matching Design Token
 * Library/Section and Pattern Library. Backend-only pass — `dashboard-web` UI is a separate,
 * not-yet-requested next step, matching every prior module's own backend-first precedent.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("motion_interaction_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable across every version row of the same logical record — the grouping/history key. */
    record_id: { type: DataTypes.UUID, allowNull: false },
    /** Stable, human-readable identifier — repeats across every version of the same record;
     *  uniqueness is enforced by the partial unique index below, not a column constraint. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Immutable across a record's own version chain — a real category change is a different
     *  record, not a new version of this one. The spec's own §18 taxonomy, 26 values. */
    category: {
      type: DataTypes.ENUM(
        "page_transition",
        "focus_state",
        "active_state",
        "selected_state",
        "disabled_state",
        "form_feedback",
        "menu",
        "modal_drawer",
        "tooltip",
        "sticky_behavior",
        "content_reveal",
        "loader",
        "progress_indicator",
        "success_error_state",
        "notification",
        "media_control",
        "filter_search",
        "pagination",
        "copy_share",
        "anchor_scroll",
        "parallax",
        "cursor",
        "dismissal",
        "screen_reader_announcement",
        "timing_and_interruption",
        "analytics_event",
        "no_js_fallback",
      ),
      allowNull: false,
    },
    /** Starts at 1, increments per new version within the same `record_id`. */
    version_number: { type: DataTypes.INTEGER, allowNull: false },
    /** True for exactly one row per `record_id` at any time — see this migration's own top
     *  comment for the atomicity discipline around flipping it. */
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    /** Rich-text-sanitized. */
    description: { type: DataTypes.TEXT, allowNull: true },
    /** Rich-text-sanitized. */
    trigger_and_behavior: { type: DataTypes.TEXT, allowNull: true },
    /** A code/spec value, not prose — plain, no rich-text sanitization applied. */
    timing_and_easing: { type: DataTypes.TEXT, allowNull: true },
    /** A code snippet, not prose — plain, no rich-text sanitization applied. */
    implementation_spec: { type: DataTypes.TEXT, allowNull: true },
    /** Rich-text-sanitized. */
    accessibility_notes: { type: DataTypes.TEXT, allowNull: true },
    /** A code/spec value, not prose — plain, no rich-text sanitization applied. */
    fallback_behavior: { type: DataTypes.TEXT, allowNull: true },
    /** `safeHttpUrlSchema`-validated at the API layer (Figma/design reference), matching Section
     *  and Pattern Library's `designReference` precedent. */
    design_reference: { type: DataTypes.TEXT, allowNull: true },
    /** Real, existence-validated relationship into Component Library
     *  (`ComponentsService.existingComponentIds()`), mirroring Page Template Library's own
     *  `supportedComponentIds` — see this migration's own top comment. */
    related_component_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Governed via a dedicated status-transition endpoint only — never accepted through
     *  `create()`/`update()`, same discipline as every sibling module's own `approval_status`.
     *  Reuses the shared generic-lifecycle vocabulary verbatim. */
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
  await context.addIndex("motion_interaction_records", ["public_id"], {
    name: "motion_interaction_records_public_id_current_unique",
    unique: true,
    where: { is_current: true },
  });
  // No two versions of the same record share a version number.
  await context.addIndex("motion_interaction_records", ["record_id", "version_number"], {
    name: "motion_interaction_records_record_version_unique",
    unique: true,
  });
  // The common "find the current version of a record" lookup.
  await context.addIndex("motion_interaction_records", ["record_id", "is_current"], {
    name: "motion_interaction_records_record_current_idx",
  });
  // list()'s actual query shape: WHERE is_current = true, ORDER BY updated_at DESC, id ASC — the
  // composite above can't serve this efficiently since record_id (not is_current) is its leading
  // column. Partial on is_current = true, same technique as the public_id uniqueness index above
  // (mirrors the fix Section and Pattern Library's own migration already applied for the identical
  // gap).
  await context.addIndex("motion_interaction_records", ["updated_at", "id"], {
    name: "motion_interaction_records_current_updated_idx",
    where: { is_current: true },
  });
  // supersedeOtherApprovedVersion()'s UPDATE filters on (record_id, approval_status = 'approved')
  // with no supporting index otherwise (mirrors Section and Pattern Library's own fix).
  await context.addIndex("motion_interaction_records", ["record_id", "approval_status"], {
    name: "motion_interaction_records_record_approval_status_idx",
  });
  // Fuzzy-search support on name, mirroring section_pattern_records_name_trgm_idx/
  // page_templates_name_trgm_idx/etc.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX motion_interaction_records_name_trgm_idx ON motion_interaction_records USING gin (name gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("motion_interaction_records", {});
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_motion_interaction_records_approval_status";',
  );
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_motion_interaction_records_category";');
}
