import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Extends the existing `module_registry` table (migrations 00014/00015,
 * Phase 1D-expanded) with the full field set required by the Phase 1F
 * application-shell brief §5, so navigation/shell code has ONE canonical
 * registry to read — no competing frontend/backend registry (brief's own
 * instruction). `key`/`name`/`permission_group_id` are untouched; every
 * column below is additive. See
 * `docs/task-packages/phase-1f-application-shell.md` and
 * `docs/implementation/phase-1f-module-registry.md`.
 *
 * `view_permission_action` pairs with the existing `permission_group_id`
 * FK to form the `(moduleKey, action)` tuple `PermissionGuard`/
 * `@RequirePermission` already expects (established convention, see
 * `apps/dashboard-api/src/authz/require-permission.decorator.ts` and its
 * existing call sites in `retention.controller.ts`/
 * `operational-contacts.controller.ts`) — this migration does not change
 * that convention, only records each module's own view-action string.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.addColumn("module_registry", "display_name", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await context.addColumn("module_registry", "description", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await context.addColumn("module_registry", "navigation_group", {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: "settings",
  });
  await context.addColumn("module_registry", "navigation_order", {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  // Nullable here deliberately: 43 existing rows can't all share one default under a UNIQUE
  // index. Migration 00035 populates each row's real, distinct route, then this migration's own
  // sibling adds the NOT NULL + unique constraint once real values exist — see 00035's own up().
  await context.addColumn("module_registry", "route", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await context.addColumn("module_registry", "icon_reference", {
    type: DataTypes.STRING(64),
    allowNull: true,
  });
  // Authoritative per the Version 1 Module Inclusion Matrix — distinct from implementation_status
  // (brief §7: "do not change the Version 1 scope while implementing the shell").
  await context.addColumn("module_registry", "v1_inclusion_status", {
    type: DataTypes.ENUM("included", "deferred", "future"),
    allowNull: false,
    defaultValue: "included",
  });
  // Brief §6's controlled vocabulary. "available" must never be set merely because a placeholder
  // route exists (brief's own explicit caution) — enforced by process/review, not a DB constraint,
  // since the database cannot know whether real business functionality actually exists.
  await context.addColumn("module_registry", "implementation_status", {
    type: DataTypes.ENUM(
      "not_started",
      "foundation_only",
      "in_development",
      "ready_for_review",
      "approved",
      "available",
      "deferred",
      "blocked",
      "deprecated",
    ),
    allowNull: false,
    defaultValue: "not_started",
  });
  await context.addColumn("module_registry", "view_permission_action", {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: "view",
  });
  /** JSONB array of optional action-permission strings beyond the required view action. */
  await context.addColumn("module_registry", "action_permissions", {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  /** User-facing placeholder/status label (brief §13's vocabulary) — may differ in phrasing from
   *  `implementation_status`'s tracking vocabulary; null means "use implementation_status as-is". */
  await context.addColumn("module_registry", "feature_status", {
    type: DataTypes.STRING(128),
    allowNull: true,
  });
  await context.addColumn("module_registry", "documentation_reference", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await context.addColumn("module_registry", "help_document_reference", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await context.addColumn("module_registry", "owner", {
    type: DataTypes.STRING(128),
    allowNull: true,
  });
  /** JSONB array of other `module_registry.key` values this module depends on. */
  await context.addColumn("module_registry", "dependencies", {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  // TEXT, not a short STRING: real values are explanatory notes (e.g. "advisory until Search
  // Strategy + Growth Director review + human approval"), not a closed short-label vocabulary.
  await context.addColumn("module_registry", "confidentiality_level", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await context.addColumn("module_registry", "badge_support", {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
  /** JSONB free-form visibility-rule notes (role/capability-based); backend route authorization
   *  remains authoritative regardless of what this says (brief §9/§10/§28). */
  await context.addColumn("module_registry", "visibility_rules", {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  /** Points at a replacement `module_registry.key`, or a free-text deprecation note. */
  await context.addColumn("module_registry", "deprecation_reference", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
  await context.addColumn("module_registry", "registry_version", {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  });
  await context.addColumn("module_registry", "last_reviewed_at", {
    type: DataTypes.DATE,
    allowNull: true,
  });

  // No unique index on `route` here — 43 existing rows would all share the same NULL/default
  // value at this point. Migration 00035 populates real, distinct routes for every row, then adds
  // the NOT NULL + unique constraint itself once real values exist.
  await context.addIndex("module_registry", ["navigation_group", "navigation_order"], {
    name: "module_registry_nav_group_order_idx",
  });
  await context.addIndex("module_registry", ["v1_inclusion_status"], {
    name: "module_registry_v1_inclusion_status_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeIndex("module_registry", "module_registry_v1_inclusion_status_idx");
  await context.removeIndex("module_registry", "module_registry_nav_group_order_idx");
  for (const column of [
    "last_reviewed_at",
    "registry_version",
    "deprecation_reference",
    "visibility_rules",
    "badge_support",
    "confidentiality_level",
    "dependencies",
    "owner",
    "help_document_reference",
    "documentation_reference",
    "feature_status",
    "action_permissions",
    "view_permission_action",
    "implementation_status",
    "v1_inclusion_status",
    "icon_reference",
    "route",
    "navigation_order",
    "navigation_group",
    "description",
    "display_name",
  ]) {
    await context.removeColumn("module_registry", column);
  }
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_module_registry_v1_inclusion_status";`);
  await context.sequelize.query(
    `DROP TYPE IF EXISTS "enum_module_registry_implementation_status";`,
  );
}
