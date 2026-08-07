import { DataTypes, type QueryInterface } from "sequelize";

/**
 * One row per granted `(role, module, action)` — VED-equivalent seeded
 * minimum, extensible per module (base skill `security/02-authn-authz.md`,
 * knowledge/12-dashboard-security-controls.md's action vocabulary).
 * `action` is a plain STRING, not a native ENUM — the vocabulary is
 * explicitly extensible ("any action addable"), and a STRING needs no
 * migration to widen while a Postgres ENUM does (same reasoning as Phase
 * 1C's `auth_events.event_type`).
 *
 * `project_id` is schema-ready for the "project level" permission axis
 * (knowledge/12) but **not FK-constrained and not functionally scoped
 * yet** — the dashboard's `projects` business entity doesn't exist until
 * Task 8. Every row seeded by this phase has `project_id IS NULL`
 * (global scope); the partial unique index below only enforces
 * one-grant-per-(role,module,action) at that global scope, deliberately
 * leaving room for future project-scoped grants to coexist without a
 * schema change.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("role_permissions", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "roles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    module_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "modules", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    action: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    /** Nullable, not yet FK-constrained (no `projects` table exists — Task 8). */
    project_id: {
      type: DataTypes.UUID,
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

  await context.addIndex("role_permissions", ["role_id", "module_id", "action"], {
    unique: true,
    where: { project_id: null },
    name: "role_permissions_global_scope_unique",
  });
  await context.addIndex("role_permissions", ["module_id"], {
    name: "role_permissions_module_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("role_permissions", {});
}
