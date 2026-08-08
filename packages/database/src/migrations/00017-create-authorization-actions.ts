import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Generic prior-actor record for future separation-of-duties checks
 * (task package §9/§10): "a code reviewer ≠ the implementer," "a release
 * approver ≠ the release executor," etc. all require knowing *who did what*
 * on a given resource before evaluating a later, conflicting action. No
 * code-review/task/release business tables exist yet (those are business
 * modules, out of this phase's scope) — this table is the reusable
 * foundation those future workflows write to and
 * `SeparationOfDutiesService.assertNoPriorConflictingAction()` reads from,
 * per the brief's own "establishes the reusable policy foundation... full
 * workflow modules may come later" instruction (§10). Append-only by
 * convention (no repository update/delete method), same pattern as Phase
 * 1C's `auth_events`.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("authorization_actions", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actor_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** e.g. "implemented", "reviewed", "approved", "executed_release" — free-text, extensible like role_permissions.action. */
    action_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    /** e.g. "code_change", "release", "recovery_request" — free-text resource category, not an FK (the referenced tables don't all exist yet). */
    resource_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    /** Identifies the specific resource instance within resource_type — not FK-constrained for the same reason as resource_type. */
    resource_id: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    occurred_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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

  await context.addIndex("authorization_actions", ["resource_type", "resource_id"], {
    name: "authorization_actions_resource_idx",
  });
  await context.addIndex("authorization_actions", ["actor_id"], {
    name: "authorization_actions_actor_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("authorization_actions", {});
}
