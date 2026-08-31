import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Page Template Library module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §16`,
 * `04_Data_Model_and_Ownership.md:152`) — module #19 on the Recommended Module Roadmap. Defines
 * reusable page architecture by page type (homepage, service, platform, industry, location, case
 * study, portfolio, landing, article, About, Contact, Team, Careers, archive/category,
 * confirmation, 404, campaign/event) — required/optional sections, supported components, content
 * requirements, search requirements, conversion goal, and the related PHP template file. See
 * `docs/implementation/module-page-template-library.md` for the full scope account.
 *
 * File-for-file mirrors `00078-create-component-library.ts` (the most recent sibling in the same
 * `creative_design` RBAC domain, same real-version-history pattern) — every version of a record is
 * its own physical row: `id` is unique per row/version; `record_id` is the stable logical-record
 * identity, generated fresh when a record is first created and copied forward unchanged onto every
 * subsequent version — the grouping/history key, NOT the same as `id`. `public_id` is likewise
 * copied forward unchanged across every version, since its whole purpose is a stable human-facing
 * reference across the record's lifetime, not a per-snapshot label — its uniqueness is enforced via
 * a PARTIAL unique index `WHERE is_current = true`, not a bare `UNIQUE(public_id)` column
 * constraint, which would incorrectly reject version 2+ of the same record (which legitimately
 * repeats the same `public_id`). `page_type` is set once at creation and immutable across a
 * record's own version chain — a real page-type change is a different record, not a new version of
 * this one, enforced server-side (never accepted through the update route).
 *
 * `is_current` is true for exactly one row per `record_id` at any time (the latest version,
 * whether draft or approved) — flipped atomically (old current -> false, new row -> true) in the
 * same transaction that creates a new version (`PageTemplateRepository.createNewVersion()`/
 * `updateInPlace()`, called together from `PageTemplatesService.update()`).
 *
 * `approval_status` reuses the shared generic 8-value artifact-lifecycle vocabulary verbatim from
 * Design Token Library's/Component Library's/Section and Pattern Library's own identical
 * `TRANSITIONS` table (design decision D1) — deliberately not extracted into a shared helper
 * (already-accepted, out-of-scope debt in this codebase), with the same deliberate deviation those
 * modules' own tables have: no `approved -> superseded` edge, since "supersede" is not a separate
 * user action — it's an automatic consequence of a NEW version's own `-> approved` transition
 * succeeding: the same transaction also flips whichever OTHER version of the same `record_id`
 * currently holds `approval_status = 'approved'` (if any) to `'superseded'`, calling the
 * repository's `supersedeOtherApprovedVersion()` directly rather than going through the
 * `TRANSITIONS` table at all. The superseded row is never deleted — permanently readable via the
 * version-history route.
 *
 * `required_section_ids`/`optional_section_ids` are REAL, existence-validated relationships into
 * `section_pattern_records` (design decision D2) — each entry a Section and Pattern Library
 * `record_id`, validated at the service layer via `SectionAndPatternLibraryService
 * .existingRecordIds()`. `supported_component_ids` is a REAL, existence-validated relationship
 * into `components` (design decision D3), validated via `ComponentsService.existingComponentIds()`.
 * `wireframe_references` is a plain, UNVALIDATED string array (design decision D4) —
 * `wireframe_library` doesn't exist yet, and it and this module are a real co-dependent cycle in
 * the seeded module registry (`docs/phase-plans/module-implementation-roadmap.md` §4.2). None of
 * the three are DB-level FKs — an array column can't carry a standard FK constraint.
 * `replacement_record_id` is a nullable self-referential `record_id` into this table's own
 * logical-record identity — existence-checked in-module, and deliberately NOT immutable across a
 * record's own version chain (unlike `page_type`), matching Component Library's identical field
 * exactly.
 *
 * No `project_id` scoping — organization-wide, matching every other library-shaped module. No
 * confidential-field mechanism — the module registry's own seeded `confidentialityLevel` for
 * `page_template_library` is `null` (migration `00035`). No publish/unpublish mechanism — matches
 * every sibling's own established precedent (design decision D6; the `creative_design` group's
 * seeded `P`/`X` grants stay unwired). Backend-only pass — `dashboard-web` UI is a separate,
 * not-yet-requested next step, matching every prior module's own backend-first precedent.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("page_templates", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable across every version row of the same logical record — the grouping/history key. */
    record_id: { type: DataTypes.UUID, allowNull: false },
    /** Stable, human-readable identifier — repeats across every version of the same record;
     *  uniqueness is enforced by the partial unique index below, not a column constraint. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Immutable across a record's own version chain — a real page-type change is a different
     *  record, not a new version of this one. The spec's own closed §16 taxonomy, 17 values
     *  (design decision D5). */
    page_type: {
      type: DataTypes.ENUM(
        "homepage",
        "service",
        "platform",
        "industry",
        "location",
        "case_study",
        "portfolio",
        "landing",
        "article",
        "about",
        "contact",
        "team",
        "careers",
        "archive_category",
        "confirmation",
        "not_found",
        "campaign_event",
      ),
      allowNull: false,
    },
    /** Starts at 1, increments per new version within the same `record_id`. */
    version_number: { type: DataTypes.INTEGER, allowNull: false },
    /** True for exactly one row per `record_id` at any time — see this migration's own top
     *  comment for the atomicity discipline around flipping it. */
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    /** A real, existence-validated relationship into `section_pattern_records.record_id` (design
     *  decision D2) — validated at the service layer, not a DB-level FK. */
    required_section_ids: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    /** A real, existence-validated relationship into `section_pattern_records.record_id` (design
     *  decision D2) — validated at the service layer, not a DB-level FK. */
    optional_section_ids: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    /** A real, existence-validated relationship into `components.record_id` (design decision D3)
     *  — validated at the service layer, not a DB-level FK. */
    supported_component_ids: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    /** Plain, UNVALIDATED string array (design decision D4) — `wireframe_library` doesn't exist
     *  yet; this and that module are a real co-dependent cycle in the seeded module registry. */
    wireframe_references: {
      type: DataTypes.ARRAY(DataTypes.STRING(500)),
      allowNull: false,
      defaultValue: [],
    },
    content_requirements: { type: DataTypes.TEXT, allowNull: true },
    search_requirements: { type: DataTypes.TEXT, allowNull: true },
    conversion_goal: { type: DataTypes.TEXT, allowNull: true },
    /** Path/reference string, not prose — matches Component Library's `php_path` precedent. */
    php_template_relationship: { type: DataTypes.STRING(2_000), allowNull: true },
    /** A nullable self-referential `record_id` into this table's own logical-record identity —
     *  "this whole logical record is replaced by that whole logical record." Not a DB-level FK
     *  (there is no unique constraint on the bare `record_id` column to reference — uniqueness is
     *  only enforced per-`is_current` via the partial index below); existence-checked at the
     *  service layer instead. */
    replacement_record_id: { type: DataTypes.UUID, allowNull: true },
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
  await context.addIndex("page_templates", ["public_id"], {
    name: "page_templates_public_id_current_unique",
    unique: true,
    where: { is_current: true },
  });
  // No two versions of the same record share a version number.
  await context.addIndex("page_templates", ["record_id", "version_number"], {
    name: "page_templates_record_version_unique",
    unique: true,
  });
  // The common "find the current version of a record" lookup.
  await context.addIndex("page_templates", ["record_id", "is_current"], {
    name: "page_templates_record_current_idx",
  });
  // list()'s actual query shape: WHERE is_current = true, ORDER BY updated_at DESC, id ASC — the
  // composite above can't serve this efficiently since record_id (not is_current) is its leading
  // column. Partial on is_current = true, mirroring
  // section_pattern_records_current_updated_idx's own already-code-reviewed fix.
  await context.addIndex("page_templates", ["updated_at", "id"], {
    name: "page_templates_current_updated_idx",
    where: { is_current: true },
  });
  // supersedeOtherApprovedVersion()'s UPDATE filters on (record_id, approval_status = 'approved')
  // with no supporting index otherwise, mirroring
  // section_pattern_records_record_approval_status_idx's own already-code-reviewed fix.
  await context.addIndex("page_templates", ["record_id", "approval_status"], {
    name: "page_templates_record_approval_status_idx",
  });
  // Fuzzy-search support on name, mirroring components_name_trgm_idx/design_tokens_name_trgm_idx/
  // section_pattern_records_name_trgm_idx/etc.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX page_templates_name_trgm_idx ON page_templates USING gin (name gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("page_templates", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_page_templates_approval_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_page_templates_page_type";');
}
