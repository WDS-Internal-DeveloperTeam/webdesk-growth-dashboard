import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Change Center module foundation (module #33, `docs/implementation/module-change-center.md`)
 * — a single table, `change_records`, project-scoped, tracking theme/plugin/core/database/
 * integration/SEO/analytics/security/accessibility/performance/redirect/asset change records
 * through a real accept/reject/merge/defer/apply/verify workflow
 * (`05_Workflow_State_Machines.md §8`).
 *
 * `project_id` uses `onDelete: "RESTRICT"`, matching every other project-scoped module's own
 * choice (the Projects module's own task-package rule 7 — no cascading deletion from `projects`
 * into any website/business-record table — applies directly here). `scan_finding_id` is a real,
 * nullable FK into Scan Center's own `scan_findings` (`onDelete: "SET NULL"` — a change record
 * outlives the finding that detected it, mirroring `scan_evidence`'s own SET NULL choice for
 * `resolved_by`/`created_by`). `target_module_key`/`target_id` are an optional polymorphic
 * reference into ANY other module's own record (mirroring Review and Approval Center's own
 * `(targetModuleKey, targetId)` pattern) — `target_id` is deliberately NOT a real foreign key
 * (there is no single table it could reference), validated only at the DTO/service layer
 * (`AuthorizationService.isValidModuleKey()` for `target_module_key`; `target_id` existence is
 * NOT checked, mirroring Review and Approval Center's own identical restraint — no generic
 * cross-module lookup capability exists to validate it against).
 *
 * This table never supports a hard delete (ADR-0016) — only status transitions.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("change_records", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Stable, human-readable identifier — never regenerated once assigned, globally unique (not
     *  per-project), same contract as `pages.public_id`/`scan_runs.public_id`. */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM(
        "theme",
        "plugin",
        "core",
        "database",
        "integration",
        "seo_metadata",
        "analytics_tracking",
        "security",
        "accessibility",
        "performance",
        "redirects_urls",
        "assets",
        "conflicts_failed_sync",
        "rollback_history",
      ),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM("critical", "high", "medium", "low", "info"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "detected",
        "under_review",
        "accepted",
        "rejected",
        "deferred",
        "manual_merge_required",
        "applying",
        "applied",
        "verified",
        "apply_failed",
      ),
      allowNull: false,
      defaultValue: "detected",
    },
    /** The real "source" link when a change was detected by a scan — `null` for a manually-created
     *  change record. `SET NULL`: a change record's own history outlives the finding that detected
     *  it. */
    scan_finding_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "scan_findings", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Free-text provenance description (e.g. "manual", "WordPress admin notice", "vendor
     *  changelog") — no canonical value list exists anywhere in the sources for this field. */
    source: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** Optional polymorphic target, mirroring `reviews.target_module_key`/`target_id` exactly —
     *  validated (when present) at the service layer via `AuthorizationService.isValidModuleKey()`,
     *  never a real foreign key (no single table it could reference). Both columns are always
     *  either both null or both non-null, enforced at the DTO layer, not a DB CHECK constraint. */
    target_module_key: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    target_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    /** Required human-readable label always present regardless of whether a polymorphic target
     *  exists — what renders in the Change Center list/table (e.g. "WordPress core 6.4.1 →
     *  6.4.2"). */
    record_label: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    before_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    after_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** A 0-100 percentage-style confidence score — range enforced at the DTO layer, not a DB CHECK
     *  constraint. */
    confidence: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    recommendation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assigned_to_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decision_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Server-stamped only, by `ChangeRecordRepository.updateStatus()`, on a transition into one of
     *  the four real decision states (`accepted`/`rejected`/`deferred`/`manual_merge_required`). */
    decided_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decided_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /** Server-stamped only, on a transition into `applied`. */
    applied_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    applied_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /** Server-stamped only, on a transition into `verified`. */
    verified_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /** Settable only as part of a transition INTO `apply_failed` (`05_Workflow_State_Machines.md
     *  §8`) — a request pairing this with any other target status is rejected with a clean 400 at
     *  the service layer. */
    rollback_guidance: {
      type: DataTypes.TEXT,
      allowNull: true,
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

  await context.addIndex("change_records", ["public_id"], {
    name: "change_records_public_id_unique",
    unique: true,
  });
  await context.addIndex("change_records", ["project_id", "updated_at", "id"], {
    name: "change_records_project_id_updated_at_id_idx",
  });
  await context.addIndex("change_records", ["project_id", "status"], {
    name: "change_records_project_id_status_idx",
  });
  await context.addIndex("change_records", ["project_id", "category"], {
    name: "change_records_project_id_category_idx",
  });
  await context.addIndex("change_records", ["scan_finding_id"], {
    name: "change_records_scan_finding_id_idx",
  });
  // Backs the `assignedToMe`/`assignedToUserId` list filter (`listChangeRecordsQuerySchema`) —
  // a first-class, documented query path (mirroring Review and Approval Center's own "my queue"
  // concept) that had no supporting index without this.
  await context.addIndex("change_records", ["project_id", "assigned_to_user_id"], {
    name: "change_records_project_id_assigned_to_user_id_idx",
  });
  // Fuzzy-search support on record_label — ChangeRecordRepository.list()'s own `search` filter
  // does an `Op.iLike` match on this column, the same pattern as
  // scan_findings_title_trgm_idx/internal_links_anchor_trgm_idx. `CREATE EXTENSION IF NOT EXISTS`
  // is idempotent.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX change_records_record_label_trgm_idx ON change_records USING gin (record_label gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("change_records", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_change_records_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_change_records_severity";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_change_records_category";');
}
