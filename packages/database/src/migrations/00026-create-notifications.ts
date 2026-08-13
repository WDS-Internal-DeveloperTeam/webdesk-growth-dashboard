import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The reusable notification-record model (Phase 1E notification-foundation
 * brief §15) — every future domain/system event that needs to notify
 * someone creates a row here rather than a module inventing its own
 * notification table (§4's core rule). No real producer or SMTP delivery
 * exists yet; see `docs/task-packages/phase-1e-notification-foundation.md`.
 *
 * `delivery_state` and `severity` are real Postgres ENUMs — both are
 * exact, small, "use exact names" approved lists (§15, §18), the same
 * reasoning that made `jobs.status`/`audit_events.actor_type` ENUMs while
 * `notification_type` stays an evolvable STRING.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("notifications", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    notification_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM("critical", "high", "medium", "low"),
      allowNull: false,
    },
    operational_area: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    /** Not FK-constrained — no `projects` table exists yet, same precedent as `user_roles.project_id` (migration 00016). */
    project_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    recipient_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** No `operational_contacts` table exists yet (§17-18, a separate later slice) — schema-ready slot only. */
    recipient_contact_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    /** A safe short message or a reference to where the full content lives (e.g. a template key) — never raw HTML or PII beyond what's already safe to log. */
    body_reference: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    delivery_state: {
      type: DataTypes.ENUM(
        "queued",
        "sent_to_smtp",
        "accepted",
        "failed",
        "retrying",
        "permanently_failed",
      ),
      allowNull: false,
      defaultValue: "queued",
    },
    attempt_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_attempt_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failure_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retry_eligible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    correlation_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    /** Polymorphic, not FK-constrained — spans audit_events/jobs/security-finding tables, same reasoning as audit_events.entity_id. */
    related_entity_type: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    related_entity_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    retention_category: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addIndex("notifications", ["delivery_state"], {
    name: "notifications_delivery_state_idx",
  });
  await context.addIndex("notifications", ["project_id", "created_at"], {
    name: "notifications_project_id_created_at_idx",
  });
  await context.addIndex("notifications", ["recipient_user_id"], {
    name: "notifications_recipient_user_id_idx",
  });
  await context.addIndex("notifications", ["related_entity_type", "related_entity_id"], {
    name: "notifications_related_entity_idx",
  });
  await context.addIndex("notifications", ["correlation_id"], {
    name: "notifications_correlation_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("notifications", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_notifications_delivery_state";`);
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_notifications_severity";`);
}
