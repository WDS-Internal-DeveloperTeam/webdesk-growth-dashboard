import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Integrations module foundation (`docs/implementation/module-integrations.md`, module #41).
 * Four tables — `integrations`, `integration_environments`, `webhook_events`, `secret_metadata` —
 * per `04_Data_Model_and_Ownership.md §"Notifications and integrations"`'s own four table names
 * (no columns given there; the field-level schema below is this module's own design, D2). The
 * canonical spec's one concrete design signal is the module registry's own already-seeded entry
 * (`00035-populate-module-registry-fields.ts`): `confidentialityLevel: "secret values never
 * stored — metadata/verification status only"` — no secret VALUE is ever stored anywhere in this
 * schema, only metadata about where a secret lives (`secret_metadata.storage_location`,
 * `integrations.config_reference`).
 *
 * Record-keeping only (D1) — this module tracks status/config metadata and lets an admin manually
 * record a verification result; it does NOT make real outbound calls to any external service,
 * matching the precedent already set by Scan Center/Technical Center/Ready for Claude Queue (each
 * ships the full data model and RBAC-gated API surface for a mechanism with no execution engine
 * yet).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("integrations", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching every
     *  sibling module's own `public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    provider: {
      type: DataTypes.ENUM(
        "github",
        "wordpress",
        "vercel_blob",
        "postgresql",
        "smtp",
        "sentry",
        "uptime_monitor",
        "vulnerability_scanner",
        "upstash",
        "other",
      ),
      allowNull: false,
    },
    display_name: { type: DataTypes.STRING(255), allowNull: false },
    status: {
      type: DataTypes.ENUM("connected", "disconnected", "error", "not_configured"),
      allowNull: false,
      defaultValue: "not_configured",
    },
    /** Plain text — where the real secret/config actually lives (e.g. "Vercel env:
     *  dashboard-api / GOOGLE_OAUTH_CLIENT_SECRET"), never the value itself, matching the module
     *  registry's own seeded confidentiality note. */
    config_reference: { type: DataTypes.TEXT, allowNull: true },
    /** Plain text — ops notes, not user-facing content, so no rich-text/sanitization treatment,
     *  matching Scan Center's/Technical Center's own precedent for internal ops metadata. */
    notes: { type: DataTypes.TEXT, allowNull: true },
    last_verified_at: { type: DataTypes.DATE, allowNull: true },
    last_verified_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    last_verification_result: {
      type: DataTypes.ENUM("success", "failure", "unknown"),
      allowNull: true,
    },
    last_verification_notes: { type: DataTypes.TEXT, allowNull: true },
    /** No hard delete for `integrations` itself — `is_active: false` is the retirement
     *  mechanism, matching every content-library module's own no-hard-delete precedent. */
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("integrations", ["public_id"], {
    name: "integrations_public_id_unique",
    unique: true,
  });
  await context.addIndex("integrations", ["provider"], { name: "integrations_provider_idx" });
  await context.addIndex("integrations", ["status"], { name: "integrations_status_idx" });
  await context.addIndex("integrations", ["is_active"], { name: "integrations_is_active_idx" });
  // `IntegrationRepository.list()` orders every query by `updated_at DESC, id ASC` — back that
  // shape directly, mirroring `personas_updated_at_idx` (migration 00052, added as a code-review
  // finding on that module) and every module built after it that reuses the same list-ordering
  // convention.
  await context.addIndex("integrations", ["updated_at", "id"], {
    name: "integrations_updated_at_id_idx",
  });
  // Fuzzy-search support on display_name, mirroring brand_library_records_title_trgm_idx
  // (migration 00070)/personas_name_trgm_idx (migration 00052).
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX integrations_display_name_trgm_idx ON integrations USING gin (display_name gin_trgm_ops);",
  );

  // --- integration_environments — a real one-to-many sub-resource, real delete allowed (a
  // Projects-sub-resource-style config row, not a historical record needing retention). ---
  await context.createTable("integration_environments", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    integration_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "integrations", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** Plain text — "staging", "production", etc.; no fixed taxonomy in the spec. */
    environment_name: { type: DataTypes.STRING(255), allowNull: false },
    status: {
      type: DataTypes.ENUM("connected", "disconnected", "error", "not_configured"),
      allowNull: false,
      defaultValue: "not_configured",
    },
    config_reference: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    last_verified_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("integration_environments", ["integration_id"], {
    name: "integration_environments_integration_id_idx",
  });

  // --- webhook_events — an append-only, queryable local delivery log. No update, no delete
  // route/repository method exists at all, so the invariant holds application-wide today — but,
  // unlike `audit_events` (ADR-0017), there is no database-level `BEFORE UPDATE OR DELETE` trigger
  // backing it, so this is an application-level append-only log, explicitly distinguished from
  // that DB-trigger-enforced table, mirroring `review_decisions`' (migration 00066) own identical,
  // honestly-scoped phrasing. Since no real webhook receiver exists yet (D1), this table's only
  // write path is a manual "record an event" endpoint for ops use, not a live receiver. ---
  await context.createTable("webhook_events", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Nullable, `SET NULL` — an event may arrive before it can be matched to a known
     *  integration. */
    integration_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "integrations", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    event_type: { type: DataTypes.STRING(255), allowNull: false },
    received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    /** Deliberately NOT the raw payload — a short, human-written or truncated summary, to avoid
     *  storing secrets/PII that might be embedded in a real webhook body. */
    payload_summary: { type: DataTypes.TEXT, allowNull: true },
    processing_status: {
      type: DataTypes.ENUM("received", "processed", "failed"),
      allowNull: false,
      defaultValue: "received",
    },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("webhook_events", ["integration_id"], {
    name: "webhook_events_integration_id_idx",
  });
  await context.addIndex("webhook_events", ["received_at"], {
    name: "webhook_events_received_at_idx",
  });
  await context.addIndex("webhook_events", ["processing_status"], {
    name: "webhook_events_processing_status_idx",
  });

  // --- secret_metadata — tracks which secret exists for an integration, never the value. Real
  // FK, CASCADE (a metadata row has no meaning once its parent integration is gone). Real delete
  // allowed (pure metadata, no compliance/audit reason to retain a deleted row) — but deletion is
  // itself an edit-gated, audited action at the service layer. ---
  await context.createTable("secret_metadata", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    integration_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "integrations", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** e.g. `GOOGLE_OAUTH_CLIENT_SECRET` — plain text, never the value. */
    secret_name: { type: DataTypes.STRING(255), allowNull: false },
    /** e.g. "Vercel env var — dashboard-api". */
    storage_location: { type: DataTypes.TEXT, allowNull: false },
    last_rotated_at: { type: DataTypes.DATE, allowNull: true },
    rotation_due_at: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addIndex("secret_metadata", ["integration_id"], {
    name: "secret_metadata_integration_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("secret_metadata", {});
  await context.dropTable("webhook_events", {});
  await context.dropTable("integration_environments", {});
  await context.dropTable("integrations", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_integrations_provider";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_integrations_status";');
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_integrations_last_verification_result";',
  );
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_integration_environments_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_webhook_events_processing_status";');
}
