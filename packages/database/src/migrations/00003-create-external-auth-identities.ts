import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Maps a Google Workspace `sub` claim (stable subject identifier — email can
 * change, `sub` does not, per knowledge/05 "Subject-ID identity mapping") to
 * a `users` row. `provider` is a plain STRING, not a native ENUM: only
 * `"google"` is valid today (WDS-003 — no other IdP), but recording it as a
 * value rather than baking a single-member type into the schema avoids an
 * unnecessary ENUM-migration dance if that rule is ever explicitly
 * revisited — application-level validation enforces the current
 * single-value constraint, not the database.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("external_auth_identities", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    provider: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "google",
    },
    provider_subject_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspace_domain: {
      type: DataTypes.STRING,
      allowNull: false,
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await context.addIndex("external_auth_identities", ["provider", "provider_subject_id"], {
    unique: true,
    name: "external_auth_identities_provider_subject_unique",
  });
  await context.addIndex("external_auth_identities", ["user_id"], {
    name: "external_auth_identities_user_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("external_auth_identities");
}
