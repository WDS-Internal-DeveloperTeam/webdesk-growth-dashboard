import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Review and Approval Center module foundation
 * (`docs/task-packages/module-review-and-approval-center.md`, module #11) — the 11th real
 * business-module backend on the Phase 1F application shell / canonical module registry, and the
 * first that is a cross-cutting **engine** attaching to records owned by other modules, not a
 * single content-record library of its own (`03_Detailed_Module_Specifications.md §31`:
 * "assigned reviews, version compare, comments, approve, approve with notes, request revision,
 * reject, pause, delegate where permitted").
 *
 * Three tables (task package D1): `reviews` (the workflow record), `review_comments` (a plain
 * comment thread), `review_decisions` (an append-only, queryable local action log — distinct from
 * the real, DB-trigger-enforced `audit_events` table, which also receives a copy of every genuine
 * approval-shaped decision, task package D5).
 *
 * `reviews.target_module_key`/`target_id` deliberately carry NO foreign key (task package D1) —
 * the reviewed target can live in any current or future module's own table, exactly the shape
 * `internal_links.related_strategy_record_id`/Service Library's `icpIds` etc. already established
 * for a genuinely cross-module, not-yet-linkable reference. `target_module_key` is validated
 * against the real module registry at the service layer (task package D6,
 * `AuthorizationService.isValidModuleKey()`); `target_id` existence is not checked — no generic
 * cross-module lookup capability exists to check it against.
 *
 * Organization-wide, not project-scoped (task package D7) — no `project_id` column: a review can
 * legitimately target a record in a module with no project concept at all.
 *
 * `status` and `is_paused` are two orthogonal axes (task package D2), mirroring Content Template
 * Library's already-reviewed `approvalStatus`/`isPublished` split rather than inventing a new
 * shape. `status` is the 4-value workflow (`submitted -> {approved, rejected, revision_requested}`,
 * `revision_requested -> {approved, rejected}` — `approved`/`rejected` terminal); `is_paused` is an
 * independent boolean toggled by `pause`/`resume`, advisory only, never a blocking gate on other
 * transitions.
 *
 * `decided_by_user_id`/`decided_at` are stamped on every `decide()` call (approve/
 * approve_with_notes/reject/request_revision) — unlike `content_templates.published_at`'s "stamp
 * once, never overwrite" contract, these two record the MOST RECENT decision, so they are
 * overwritten on each successive `decide()` call, not COALESCE-guarded.
 *
 * `version_a_label`/`version_b_label` (task package D3) are opaque, nullable text snapshots — no
 * generic per-module version-fetch/diff mechanism exists anywhere in this codebase to build a real
 * comparison against.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("reviews", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** No foreign key — the reviewed record can live in any current or future module's own table
     *  (task package D1). Validated against the real module registry at the service layer only
     *  (task package D6). */
    target_module_key: { type: DataTypes.STRING(64), allowNull: false },
    /** No foreign key, for the same reason as `target_module_key` — existence is not checked
     *  (task package D6). */
    target_id: { type: DataTypes.UUID, allowNull: false },
    /** A plain, nullable text snapshot captured at submission time — no generic cross-module fetch
     *  mechanism exists to resolve a live label later (task package D1). */
    target_label: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("submitted", "revision_requested", "approved", "rejected"),
      allowNull: false,
      defaultValue: "submitted",
    },
    /** Orthogonal to `status` (task package D2) — advisory only, never a blocking gate on other
     *  transitions. */
    is_paused: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    submitted_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Existence-validated at the service layer (mirrors `InternalLinksService.assertApproverExists()`'s
     *  own precedent). Reassigned only via the dedicated `delegate` action (task package D10). */
    assigned_to_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Server-stamped only, by `ReviewRepository.updateStatus()`'s own atomic write — overwritten
     *  on every successive `decide()` call, unlike a "stamp once" field (see this migration's own
     *  doc comment above). */
    decided_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decided_at: { type: DataTypes.DATE, allowNull: true },
    /** Opaque labels only — no real diff mechanism exists (task package D3). */
    version_a_label: { type: DataTypes.TEXT, allowNull: true },
    version_b_label: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("reviews", ["target_module_key", "target_id"], {
    name: "reviews_target_module_key_target_id_idx",
  });
  await context.addIndex("reviews", ["assigned_to_user_id"], {
    name: "reviews_assigned_to_user_id_idx",
  });
  await context.addIndex("reviews", ["status"], {
    name: "reviews_status_idx",
  });
  await context.addIndex("reviews", ["updated_at", "id"], {
    name: "reviews_updated_at_id_idx",
  });
  // Fuzzy-search support on target_label, mirroring content_templates_page_type_trgm_idx/
  // personas_name_trgm_idx (04_Data_Model_and_Ownership.md:241's trigram-index requirement) —
  // `ReviewRepository.list()`'s own `?search=` filter is a leading-wildcard ILIKE against this
  // column.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX reviews_target_label_trgm_idx ON reviews USING gin (target_label gin_trgm_ops);",
  );

  await context.createTable("review_comments", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    review_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "reviews", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    author_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Capped via an application-layer Zod `.max(2000)` — plain text, no `RichTextEditor` (no
     *  `dashboard-web` UI exists yet for this module, task package §5). */
    body: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("review_comments", ["review_id"], {
    name: "review_comments_review_id_idx",
  });

  await context.createTable("review_decisions", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    review_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "reviews", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    action: {
      type: DataTypes.ENUM(
        "approve",
        "approve_with_notes",
        "request_revision",
        "reject",
        "pause",
        "resume",
        "delegate",
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
    /** Set only when `action = 'delegate'` (task package §3) — application-layer discipline, not a
     *  database `CHECK` constraint (no existing sibling precedent for one). */
    delegated_to_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("review_decisions", ["review_id"], {
    name: "review_decisions_review_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("review_decisions", {});
  await context.dropTable("review_comments", {});
  await context.dropTable("reviews", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_review_decisions_action";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_reviews_status";');
}
