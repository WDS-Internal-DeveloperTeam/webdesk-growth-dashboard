import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The 43 real dashboard feature modules from
 * `02_Version_1_Module_Inclusion_Matrix.md` — a pure lookup/resource
 * registry, distinct from `modules` (the 21-row permission-granting
 * granularity from `06_Roles_and_Permissions.md §3`, already seeded).
 * `permission_group_id` points at which `modules` row actually gates
 * access to a given registry entry — this table grants nothing on its
 * own. See docs/implementation/phase-1d-permission-catalog.md §3 for the
 * full reasoning and docs/implementation/phase-1d-role-permission-matrix.md
 * for the 43→21 mapping.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("module_registry", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    permission_group_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "modules", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
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

  await context.addIndex("module_registry", ["permission_group_id"], {
    name: "module_registry_permission_group_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("module_registry", {});
}
