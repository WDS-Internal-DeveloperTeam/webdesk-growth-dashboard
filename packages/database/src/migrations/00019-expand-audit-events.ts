import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Closes the gap between migration 00018's `audit_events` shape (the base
 * skill's original `contracts/audit-event.schema.json`, a separately-
 * versioned asset outside this repo's own git history) and the newer,
 * more detailed Phase 1E authorization brief's §5/§8 field list — see
 * `docs/implementation/phase-1e-audit-architecture.md` for the full
 * field-by-field rationale. Seven new columns:
 *
 *   - `event_category` — NOT NULL, backfilled deterministically from the
 *     existing `event_type` column (a pure function of already-stored
 *     data, so backfill accuracy is exact, not a guess). Always derived
 *     by `AuditService`'s exhaustive event_type→category mapping going
 *     forward, never left to the caller to remember.
 *   - `source_application` — NOT NULL, backfilled to `'dashboard-api'`:
 *     `AuditModule` has only ever been wired into `dashboard-api`
 *     (`AuthModule`/`AuthzModule`), so every existing row is genuinely
 *     known to have come from there, not a default masking uncertainty.
 *   - `environment` — NOT NULL, backfilled to `'production'`: this
 *     project has never had a staging/preview deployment that wrote to
 *     the real database (CLAUDE.md's own "no staging environment exists"
 *     — every existing row really was written in production), using the
 *     same three-value vocabulary as `packages/configuration`'s already-
 *     approved `NODE_ENV` schema (`development`/`test`/`production`), not
 *     an invented fourth value.
 *   - `confidentiality_classification` — NOT NULL, backfilled to
 *     `'internal'`: the conservative, non-elevated default that grants no
 *     new visibility to any historical row and matches what every
 *     existing event (role/recovery actions) actually is.
 *   - `session_id`, `project_id`, `correlation_id` — left NULLABLE, no
 *     backfill. Unlike the four columns above, there is no data already
 *     in this table (or reachable from it) that lets a backfill be
 *     accurate rather than fabricated — no request-scoped correlation-ID
 *     propagation or session-linkage exists in the calling code yet.
 *     These are schema-ready slots only, exactly the same "not
 *     FK-constrained, no business entity backing it yet" precedent
 *     `user_roles.project_id` set in migration 00016.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.addColumn("audit_events", "event_category", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await context.addColumn("audit_events", "session_id", {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: "sessions", key: "id" },
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
  await context.addColumn("audit_events", "project_id", {
    type: DataTypes.UUID,
    allowNull: true,
  });
  await context.addColumn("audit_events", "correlation_id", {
    type: DataTypes.UUID,
    allowNull: true,
  });
  await context.addColumn("audit_events", "source_application", {
    type: DataTypes.STRING(64),
    allowNull: true,
  });
  await context.addColumn("audit_events", "environment", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await context.addColumn("audit_events", "confidentiality_classification", {
    type: DataTypes.STRING(32),
    allowNull: true,
  });

  await context.sequelize.query(`
    UPDATE audit_events SET event_category = CASE event_type
      WHEN 'login' THEN 'authentication'
      WHEN 'login_rejected' THEN 'authentication'
      WHEN 'logout' THEN 'authentication'
      WHEN 'session_revoked' THEN 'authentication'
      WHEN 'permission_change' THEN 'access_control'
      WHEN 'confidential_field_access_change' THEN 'access_control'
      WHEN 'user_activation' THEN 'access_control'
      WHEN 'user_deactivation' THEN 'access_control'
      WHEN 'data_change' THEN 'content_lifecycle'
      WHEN 'approval' THEN 'approval'
      WHEN 'rejection' THEN 'approval'
      WHEN 'revision_requested' THEN 'approval'
      WHEN 'publish' THEN 'content_lifecycle'
      WHEN 'unpublish' THEN 'content_lifecycle'
      WHEN 'release' THEN 'content_lifecycle'
      WHEN 'rollback' THEN 'content_lifecycle'
      WHEN 'backup' THEN 'operational'
      WHEN 'restore' THEN 'operational'
      WHEN 'retention_run' THEN 'operational'
      WHEN 'security_exception' THEN 'security'
      WHEN 'scan_run' THEN 'operational'
      WHEN 'import_run' THEN 'operational'
      WHEN 'export_run' THEN 'operational'
      WHEN 'git_sync' THEN 'operational'
      WHEN 'webhook_processed' THEN 'operational'
      WHEN 'job_completed' THEN 'operational'
      WHEN 'job_failed' THEN 'operational'
      WHEN 'emergency_admin_login' THEN 'authentication'
      WHEN 'account_recovery_request' THEN 'identity_recovery'
      WHEN 'account_recovery_decision' THEN 'identity_recovery'
      ELSE 'operational'
    END
    WHERE event_category IS NULL;
  `);
  await context.sequelize.query(
    `UPDATE audit_events SET source_application = 'dashboard-api' WHERE source_application IS NULL;`,
  );
  await context.sequelize.query(
    `UPDATE audit_events SET environment = 'production' WHERE environment IS NULL;`,
  );
  await context.sequelize.query(
    `UPDATE audit_events SET confidentiality_classification = 'internal' WHERE confidentiality_classification IS NULL;`,
  );

  await context.changeColumn("audit_events", "event_category", {
    type: DataTypes.STRING(32),
    allowNull: false,
  });
  await context.changeColumn("audit_events", "source_application", {
    type: DataTypes.STRING(64),
    allowNull: false,
  });
  await context.changeColumn("audit_events", "environment", {
    type: DataTypes.STRING(32),
    allowNull: false,
  });
  await context.changeColumn("audit_events", "confidentiality_classification", {
    type: DataTypes.STRING(32),
    allowNull: false,
  });

  await context.addIndex("audit_events", ["event_category"], {
    name: "audit_events_event_category_idx",
  });
  await context.addIndex("audit_events", ["project_id", "created_at"], {
    name: "audit_events_project_id_created_at_idx",
  });
  await context.addIndex("audit_events", ["correlation_id"], {
    name: "audit_events_correlation_id_idx",
  });
  await context.addIndex("audit_events", ["session_id"], {
    name: "audit_events_session_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeIndex("audit_events", "audit_events_session_id_idx");
  await context.removeIndex("audit_events", "audit_events_correlation_id_idx");
  await context.removeIndex("audit_events", "audit_events_project_id_created_at_idx");
  await context.removeIndex("audit_events", "audit_events_event_category_idx");
  await context.removeColumn("audit_events", "confidentiality_classification");
  await context.removeColumn("audit_events", "environment");
  await context.removeColumn("audit_events", "source_application");
  await context.removeColumn("audit_events", "correlation_id");
  await context.removeColumn("audit_events", "project_id");
  await context.removeColumn("audit_events", "session_id");
  await context.removeColumn("audit_events", "event_category");
}
