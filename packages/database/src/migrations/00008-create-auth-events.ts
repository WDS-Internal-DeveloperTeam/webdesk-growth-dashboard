import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Narrow, login-scoped event log covering exactly what knowledge/05's
 * "Login audit events" section requires — NOT the general-purpose ADR-0017
 * audit-log subsystem (Task 7, separate authorization). `event_type` and
 * `reason` are plain STRING, not native ENUMs: the event vocabulary is
 * expected to grow (Task 7 may extend or migrate this table), and widening
 * a STRING needs no migration while widening a Postgres ENUM does.
 * `user_id`/`session_id` are nullable — a rejected SSO login (wrong domain,
 * invalid token) may have no resolved user or session at all.
 *
 * Append-only by convention here (no `update`/`delete` method is ever
 * exposed on its repository) — the database-permission-level enforcement
 * ADR-0017 describes for the full audit subsystem is Task 7's job, not
 * duplicated here.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("auth_events", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    event_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "sessions", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    auth_method: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    /** Generic, safe reason only (e.g. "domain_not_allowed") — never specific enough to enable user enumeration, per knowledge/05. */
    reason: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    ip_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addIndex("auth_events", ["user_id"], { name: "auth_events_user_id_idx" });
  await context.addIndex("auth_events", ["event_type"], { name: "auth_events_event_type_idx" });
  await context.addIndex("auth_events", ["created_at"], { name: "auth_events_created_at_idx" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("auth_events");
}
