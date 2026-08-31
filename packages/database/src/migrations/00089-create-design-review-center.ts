import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Design Review Center module foundation
 * (`docs/implementation/module-design-review-center.md`, module #21) — the 21st real
 * business-module backend on the Phase 1F application shell / canonical module registry
 * (`03_Detailed_Module_Specifications.md §19`: "Review types: creative direction, UX, conversion,
 * UI, accessibility by design, responsive behavior, component consistency, motion, performance
 * impact. Actions: approve, approve with notes, request revision, reject, supersede.").
 *
 * A design fork was confirmed with the user first: extend the already-shipped, already-reviewed
 * `reviews` table (module #11, Review and Approval Center) with a nullable `reviewType` column, or
 * build a dedicated `design_reviews`/`design_review_decisions` table pair. The user chose the
 * dedicated pair — keeps the live `reviews` schema untouched, matching this project's own
 * precedent of accepting some duplication across sibling modules over destabilizing a live one.
 *
 * `design_reviews`/`design_review_decisions` mirror `reviews`/`review_decisions`
 * (migration `00066`) file-for-file, with two real differences: (1) `review_type`, a 9-value enum
 * taken verbatim from the spec, immutable after creation — a real `reviewType` change is a
 * different review, not an edit, mirroring `recordType`'s own immutability in every generic-table
 * module; (2) no `is_paused`/`pause`/`resume`/`delegate` at all — this module's spec Actions line
 * names none of the three, unlike Review and Approval Center's own spec line, which explicitly
 * does.
 *
 * `status` is a 5-value workflow (`submitted -> {approved, rejected, revision_requested}`,
 * `revision_requested -> {approved, rejected}`, plus `superseded` — `approved`/`rejected`/
 * `superseded` are all terminal). `superseded` is reached ONLY automatically: when a `decide()`
 * call produces `status: "approved"`, the SAME transaction atomically flips any OTHER row sharing
 * `(target_module_key, target_id, review_type)` that is currently `approved` to `superseded` —
 * mirrors `WebsiteStrategyRecordRepository.supersedeOtherApprovedVersion()`'s own already-reviewed
 * `UPDATE ... WHERE ... AND status = 'approved' AND id <> $N` shape, scoped to this 3-column tuple
 * instead of a single `recordId`. There is no `POST .../supersede` route — the seeded
 * `review_center` RBAC group (shared with Review and Approval Center) has no letter for it; the
 * legend is V/C/E/R/A only.
 *
 * `design_reviews.target_module_key`/`target_id` deliberately carry NO foreign key, for the exact
 * same reason as `reviews.target_module_key`/`target_id` (migration `00066`'s own doc comment) —
 * the reviewed target can live in any current or future module's own table. `target_module_key` is
 * validated against the real module registry at the service layer
 * (`AuthorizationService.isValidModuleKey()`); `target_id` existence is not checked.
 *
 * Organization-wide, not project-scoped — no `project_id` column, matching the seeded
 * `confidentialityLevel: null` and Review and Approval Center's own precedent.
 *
 * `decided_by_user_id`/`decided_at` are stamped on every `decide()` call — overwritten on each
 * successive call, not COALESCE-guarded (unlike a "stamp once" field such as
 * `content_templates.published_at`). Not stamped by the automatic supersede side effect — that
 * write is triggered by a DIFFERENT review's own `decide()` call, not this row's own.
 *
 * `version_a_label`/`version_b_label` are opaque, nullable text snapshots — no generic per-module
 * version-fetch/diff mechanism exists anywhere in this codebase to build a real comparison
 * against, matching `reviews`' own identical fields.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("design_reviews", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** No foreign key — the reviewed record can live in any current or future module's own table.
     *  Validated against the real module registry at the service layer only. */
    target_module_key: { type: DataTypes.STRING(64), allowNull: false },
    /** No foreign key, for the same reason as `target_module_key` — existence is not checked. */
    target_id: { type: DataTypes.UUID, allowNull: false },
    /** A plain, nullable text snapshot captured at submission time — no generic cross-module fetch
     *  mechanism exists to resolve a live label later. */
    target_label: { type: DataTypes.TEXT, allowNull: true },
    /** Immutable after creation — no route ever changes it (spec §19's 9 review types). */
    review_type: {
      type: DataTypes.ENUM(
        "creative_direction",
        "ux",
        "conversion",
        "ui",
        "accessibility_by_design",
        "responsive_behavior",
        "component_consistency",
        "motion",
        "performance_impact",
      ),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("submitted", "revision_requested", "approved", "rejected", "superseded"),
      allowNull: false,
      defaultValue: "submitted",
    },
    submitted_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Existence-validated at the service layer (mirrors `InternalLinksService.assertApproverExists()`'s
     *  own precedent). This module has no `delegate` action — an assignment is set only at create
     *  time. */
    assigned_to_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Server-stamped only, by `DesignReviewRepository.updateStatus()`'s own atomic write —
     *  overwritten on every successive `decide()` call, unlike a "stamp once" field (see this
     *  migration's own doc comment above). */
    decided_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decided_at: { type: DataTypes.DATE, allowNull: true },
    /** Opaque labels only — no real diff mechanism exists. */
    version_a_label: { type: DataTypes.TEXT, allowNull: true },
    version_b_label: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("design_reviews", ["target_module_key", "target_id"], {
    name: "design_reviews_target_module_key_target_id_idx",
  });
  // Supports the automatic-supersede lookup's own WHERE clause (D4) — the one index this module
  // needs that reviews doesn't, since reviews has no reviewType/supersede mechanism at all.
  await context.addIndex("design_reviews", ["target_module_key", "target_id", "review_type"], {
    name: "design_reviews_target_module_key_target_id_review_type_idx",
  });
  await context.addIndex("design_reviews", ["assigned_to_user_id"], {
    name: "design_reviews_assigned_to_user_id_idx",
  });
  await context.addIndex("design_reviews", ["status"], {
    name: "design_reviews_status_idx",
  });
  await context.addIndex("design_reviews", ["updated_at", "id"], {
    name: "design_reviews_updated_at_id_idx",
  });
  // Fuzzy-search support on target_label, mirroring reviews_target_label_trgm_idx (migration
  // `00066`) / `04_Data_Model_and_Ownership.md:241`'s trigram-index requirement —
  // `DesignReviewRepository.list()`'s own `?search=` filter is a leading-wildcard ILIKE against
  // this column. `CREATE EXTENSION IF NOT EXISTS` is idempotent — safe to re-issue even though
  // migration `00066` already created it once.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX design_reviews_target_label_trgm_idx ON design_reviews USING gin (target_label gin_trgm_ops);",
  );

  await context.createTable("design_review_decisions", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    review_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "design_reviews", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** No `pause`/`resume`/`delegate` (unlike `review_decisions.action`) — this module has no
     *  process-management actions. `supersede` is NEVER a directly-requested `decide()` action; it
     *  is written only by the automatic supersede side effect inside the same transaction as
     *  another review's own `-> approved` transition. */
    action: {
      type: DataTypes.ENUM(
        "approve",
        "approve_with_notes",
        "request_revision",
        "reject",
        "supersede",
      ),
      allowNull: false,
    },
    actor_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("design_review_decisions", ["review_id"], {
    name: "design_review_decisions_review_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("design_review_decisions", {});
  await context.dropTable("design_reviews", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_design_review_decisions_action";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_design_reviews_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_design_reviews_review_type";');
}
