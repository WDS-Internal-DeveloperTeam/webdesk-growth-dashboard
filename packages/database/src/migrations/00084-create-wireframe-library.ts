import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Wireframe Library module foundation
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §17`) — module #16 on
 * the Recommended Module Roadmap. See `docs/implementation/module-wireframe-library.md` for the
 * full scope account and the design decisions confirmed directly with the project owner.
 *
 * File-for-file mirrors `00080-create-section-and-pattern-library.ts` — every version of a record
 * is its own physical row: `id` is unique per row/version; `record_id` is the stable
 * logical-record identity, generated fresh when a record is first created and copied forward
 * unchanged onto every subsequent version — the grouping/history key, NOT the same as `id`.
 * `public_id` is likewise copied forward unchanged across every version, since its whole purpose
 * is a stable human-facing reference across the record's lifetime, not a per-snapshot label — its
 * uniqueness is enforced via a PARTIAL unique index `WHERE is_current = true`, not a bare
 * `UNIQUE(public_id)` column constraint, which would incorrectly reject version 2+ of the same
 * record (which legitimately repeats the same `public_id`). `page_or_module` is set once at
 * creation and immutable across a record's own version chain — a real page/module change is a
 * different record, not a new version of this one, enforced server-side (never accepted through
 * the update route). `viewport` is NOT immutable — a later version may legitimately re-plan the
 * same page/module wireframe at a different viewport.
 *
 * `is_current` is true for exactly one row per `record_id` at any time (the latest version,
 * whether draft or approved) — flipped atomically (old current -> false, new row -> true) in the
 * same transaction that creates a new version (`WireframeRecordRepository.createNewVersion()`/
 * `updateInPlace()`, called together from `WireframesService.update()`).
 *
 * `approval_status` reuses the shared generic 8-value artifact-lifecycle vocabulary verbatim from
 * Section and Pattern Library's/Design Token Library's/Website Strategy Center's/Service
 * Library's/Persona Library's/Proof and Claims Library's own identical `TRANSITIONS` table
 * (deliberately not extracted into a shared helper — already-accepted, out-of-scope debt in this
 * codebase), with the same deliberate deviation Section and Pattern Library's/Design Token
 * Library's own table has: no `approved -> superseded` edge, since "supersede" is not a separate
 * user action — it's an automatic consequence of a NEW version's own `-> approved` transition
 * succeeding: the same transaction also flips whichever OTHER version of the same `record_id`
 * currently holds `approval_status = 'approved'` (if any) to `'superseded'`, calling the
 * repository's `supersedeOtherApprovedVersion()` directly rather than going through the
 * `TRANSITIONS` table at all. The superseded row is never deleted — permanently readable via the
 * version-history route.
 *
 * `related_template_id` is a plain, unvalidated string — a real dependency cycle with
 * `page_template_library` (which doesn't exist yet: a template references its wireframe and a
 * wireframe references the template it implements, per
 * `docs/phase-plans/module-implementation-roadmap.md` §4) — to be linked for real once that module
 * exists, matching the established precedent (Website Strategy Center <-> Internal Linking
 * Library, Service Library's `relatedPageIds`/`relatedCaseStudyIds`) for a relationship with no
 * real target module/identity shape yet. `reviewer_user_id` is a real, existence-validated FK into
 * `users` (validated in the service layer, mirroring `ProjectService.assertOwnerExists()`/
 * `InternalLinksService.assertApproverExists()`'s own precedent).
 *
 * No `project_id` scoping — organization-wide, matching every other library-shaped module. No
 * confidential-field mechanism — the module registry's own seeded `confidentialityLevel` for
 * `wireframe_library` is `null` (migration `00035`). No publish/unpublish action — nothing in this
 * module's own spec entry names one, matching Section and Pattern Library/Design Token Library
 * over Content Template Library/Brand Library. Reuses the already-seeded `creative_design` RBAC
 * permission group verbatim — no new RBAC migration. Backend-only pass — `dashboard-web` UI is a
 * separate, not-yet-requested next step, matching every prior module's own backend-first
 * precedent.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("wireframe_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable across every version row of the same logical record — the grouping/history key. */
    record_id: { type: DataTypes.UUID, allowNull: false },
    /** Stable, human-readable identifier — repeats across every version of the same record;
     *  uniqueness is enforced by the partial unique index below, not a column constraint. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Immutable across a record's own version chain — a real page/module change is a different
     *  record, not a new version of this one. Required plain text (spec §17's own "page/module"
     *  field). */
    page_or_module: { type: DataTypes.TEXT, allowNull: false },
    /** Starts at 1, increments per new version within the same `record_id`. */
    version_number: { type: DataTypes.INTEGER, allowNull: false },
    /** True for exactly one row per `record_id` at any time — see this migration's own top
     *  comment for the atomicity discipline around flipping it. */
    is_current: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    /** NOT immutable across versions — a later version may re-plan the same page/module at a
     *  different viewport. */
    viewport: {
      type: DataTypes.ENUM("mobile", "tablet", "desktop"),
      allowNull: false,
    },
    /** `safeHttpUrlSchema`-validated at the API layer (a Figma/design-file reference), matching
     *  Brand Library's `fileReference` precedent — no new Blob/attachment infrastructure. */
    file_reference: { type: DataTypes.TEXT, allowNull: true },
    /** Rich-text-sanitized at write time (per the 2026-08-22 standing rule), even though no
     *  `dashboard-web` UI exists yet for this module. */
    annotations: { type: DataTypes.TEXT, allowNull: true },
    /** Rich-text-sanitized at write time, same treatment as `annotations`. */
    interaction_notes: { type: DataTypes.TEXT, allowNull: true },
    /** Plain, unvalidated string — no `page_template_library` module exists yet to link to for
     *  real (see this migration's own top comment on the real dependency cycle). */
    related_template_id: { type: DataTypes.TEXT, allowNull: true },
    /** Existence-validated at the service layer, not a hard DB constraint requirement beyond the
     *  FK itself — nullable, since a wireframe may not yet have an assigned reviewer. */
    reviewer_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
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
  await context.addIndex("wireframe_records", ["public_id"], {
    name: "wireframe_records_public_id_current_unique",
    unique: true,
    where: { is_current: true },
  });
  // No two versions of the same record share a version number.
  await context.addIndex("wireframe_records", ["record_id", "version_number"], {
    name: "wireframe_records_record_version_unique",
    unique: true,
  });
  // The common "find the current version of a record" lookup.
  await context.addIndex("wireframe_records", ["record_id", "is_current"], {
    name: "wireframe_records_record_current_idx",
  });
  // list()'s actual query shape: WHERE is_current = true, ORDER BY updated_at DESC, id ASC — the
  // composite above can't serve this efficiently since record_id (not is_current) is its leading
  // column. Partial on is_current = true, same technique as the public_id uniqueness index above
  // (proactively added — Section and Pattern Library's own equivalent index was a code-review
  // finding; applying it up front here rather than repeating that same review round).
  await context.addIndex("wireframe_records", ["updated_at", "id"], {
    name: "wireframe_records_current_updated_idx",
    where: { is_current: true },
  });
  // supersedeOtherApprovedVersion()'s UPDATE filters on (record_id, approval_status = 'approved')
  // with no supporting index otherwise (same proactive rationale as above).
  await context.addIndex("wireframe_records", ["record_id", "approval_status"], {
    name: "wireframe_records_record_approval_status_idx",
  });
  // Fuzzy-search support on page_or_module, mirroring section_pattern_records_name_trgm_idx/
  // design_tokens_name_trgm_idx/website_strategy_records_title_trgm_idx/etc.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX wireframe_records_page_or_module_trgm_idx ON wireframe_records USING gin (page_or_module gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("wireframe_records", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_wireframe_records_approval_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_wireframe_records_viewport";');
}
