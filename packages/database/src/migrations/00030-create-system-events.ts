import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The system-activity (user-facing) event log (Phase 1E system-events-
 * health brief §24) — deliberately NOT the compliance audit trail.
 * `related_audit_event_id` is the schema-level embodiment of §24's own
 * instruction: "an event may generate both [activity and audit]... when
 * required" — set only when a caller has ALSO separately written a real
 * `audit_events` row for the same occurrence; recording one never
 * automatically creates the other. See
 * `docs/task-packages/phase-1e-system-events-health.md`.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("system_events", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** e.g. "job_status_changed", "notification_queued", "integration_unavailable" — §24's own list is illustrative, not exhaustive, so this stays an evolvable STRING. */
    event_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    /** Same four-value vocabulary as `incident_severity_policies`/`operational_contacts.severity_applicability` — reused for consistency, not redefined. */
    severity: {
      type: DataTypes.ENUM("critical", "high", "medium", "low"),
      allowNull: true,
    },
    source_application: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    /** Polymorphic, not FK-constrained — spans jobs/notifications/audit_events/etc, same reasoning as audit_events.entity_id. */
    related_entity_type: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    related_entity_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    correlation_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    /** Safe structured detail only — same "never secrets/PII" rule audit_events.before_state/after_state follow. */
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    /** Real FK — set only when a matching audit_events row was also written for the same occurrence. */
    related_audit_event_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "audit_events", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addIndex("system_events", ["event_type"], {
    name: "system_events_event_type_idx",
  });
  await context.addIndex("system_events", ["category"], { name: "system_events_category_idx" });
  await context.addIndex("system_events", ["severity"], { name: "system_events_severity_idx" });
  await context.addIndex("system_events", ["related_entity_type", "related_entity_id"], {
    name: "system_events_related_entity_idx",
  });
  await context.addIndex("system_events", ["correlation_id"], {
    name: "system_events_correlation_id_idx",
  });
  await context.addIndex("system_events", ["created_at"], {
    name: "system_events_created_at_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("system_events", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_system_events_severity";`);
}
