import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The ADR-0017 general-purpose audit-log subsystem — genuinely distinct from
 * migration 00008's `auth_events` (that table is deliberately narrow and
 * login-scoped; its own doc comment says so explicitly). Field list is the
 * approved
 * `.../profiles/webdesk-growth-dashboard/contracts/audit-event.schema.json`
 * formalization, restated in `knowledge/10-data-ownership-and-audit.md`.
 *
 * `event_type`, `action`, and `retention_category` are STRING, not native
 * Postgres ENUMs — same reasoning as `auth_events.event_type`: the
 * vocabulary is expected to grow, and widening a STRING needs no migration
 * while widening a Postgres ENUM does. `actor_type` is a real ENUM: it is a
 * small, structurally stable set (human/system/service_account) rather than
 * an open business vocabulary.
 *
 * Immutability is enforced at the DATABASE layer per ADR-0017's own explicit
 * requirement ("not merely by convention") — a trigger, not just the
 * repository's own omission of an update/delete method:
 *   - UPDATE is unconditionally rejected, always, no exception.
 *   - DELETE is rejected UNLESS the current transaction has explicitly set
 *     `audit.retention_delete_authorized = 'on'` (a transaction-local
 *     Postgres setting — `set_config(..., true)` — never a sticky
 *     session-wide flag). This is the hook the future retention-deletion job
 *     (ADR-0017 "Operational considerations", knowledge/11's `deletion_runs`
 *     design) will use; that job itself is a separate, not-yet-authorized
 *     Phase 1E component and is not built here.
 *   - Even with that setting on, a row with `legal_hold = true` is still
 *     refused — a second, independent enforcement layer backing up whatever
 *     WHERE-clause correctness the future job's own query has, per
 *     knowledge/11's "Legal holds override deletion, unconditionally."
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("audit_events", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    event_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    actor_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    actor_type: {
      type: DataTypes.ENUM("human", "system", "service_account"),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    /** Not FK-constrained — entity_type spans many tables, some of which (business modules) don't exist as code yet, same reasoning as authorization_actions.resource_id. */
    entity_id: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    entity_version: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    /** Redacted per confidentiality rules (knowledge/12) before the caller ever passes this in — no redaction happens inside this table or its repository. */
    before_state: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    after_state: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    related_gate_or_approval_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    git_commit_sha: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    retention_category: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    legal_hold: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    legal_hold_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.sequelize.query(
    `ALTER TABLE audit_events
       ADD CONSTRAINT audit_events_git_commit_sha_format
       CHECK (git_commit_sha IS NULL OR git_commit_sha ~ '^[0-9a-f]{40}$');`,
  );

  await context.addIndex("audit_events", ["entity_type", "entity_id"], {
    name: "audit_events_entity_idx",
  });
  await context.addIndex("audit_events", ["event_type"], { name: "audit_events_event_type_idx" });
  await context.addIndex("audit_events", ["actor_user_id"], {
    name: "audit_events_actor_user_id_idx",
  });
  await context.addIndex("audit_events", ["created_at"], {
    name: "audit_events_created_at_idx",
  });
  await context.addIndex("audit_events", ["retention_category", "created_at"], {
    name: "audit_events_retention_category_created_at_idx",
  });

  await context.sequelize.query(`
    CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'audit_events rows are immutable (ADR-0017) — append a new event instead of editing history.';
      END IF;

      IF TG_OP = 'DELETE' THEN
        IF current_setting('audit.retention_delete_authorized', true) IS DISTINCT FROM 'on' THEN
          RAISE EXCEPTION 'audit_events rows can only be deleted by the retention-deletion job (ADR-0017).';
        END IF;
        IF OLD.legal_hold THEN
          RAISE EXCEPTION 'audit_events row % is under legal hold and cannot be deleted regardless of retention authorization.', OLD.id;
        END IF;
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await context.sequelize.query(`
    CREATE TRIGGER audit_events_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();
  `);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(`DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;`);
  await context.sequelize.query(`DROP FUNCTION IF EXISTS audit_events_block_mutation();`);
  await context.dropTable("audit_events", {});
}
