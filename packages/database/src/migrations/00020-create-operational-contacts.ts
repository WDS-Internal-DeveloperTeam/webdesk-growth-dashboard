import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The configurable operational-contact model (Phase 1E operational-
 * contacts brief §17). No seed data — §17's own instruction: "do not
 * hardcode personal contact details... no real operational emails
 * required in fixtures." Only the model is approved, not any particular
 * contact list. See
 * `docs/task-packages/phase-1e-operational-contacts.md`.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("operational_contacts", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** A real system user, when the contact is someone with a dashboard account. */
    contact_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Raw contact details, when the contact is external (a vendor, a support line) with no `users` row. At least one of contact_user_id/contact_name is required — see the CHECK constraint below. */
    contact_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    contact_phone: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    /** e.g. "dashboard", "wordpress", "devops", "security" — §17's own list is "such as", not exhaustive, so this stays an evolvable STRING rather than a closed ENUM. */
    area: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("primary", "backup"),
      allowNull: false,
    },
    escalation_priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    channel_preference: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    /** JSONB array of severity keys (e.g. ["critical","high"]) this contact applies to — see `incident_severity_policies` for the approved severity vocabulary. Null means "applies to all severities". */
    severity_applicability: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    working_hours_start: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    working_hours_end: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    time_zone: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    effective_start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    /** Null means indefinite. */
    effective_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    active_status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    /** No real verification-send mechanism exists yet — schema-ready for a future one. */
    verification_status: {
      type: DataTypes.ENUM("unverified", "verified", "failed"),
      allowNull: false,
      defaultValue: "unverified",
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

  await context.sequelize.query(
    `ALTER TABLE operational_contacts
       ADD CONSTRAINT operational_contacts_identity_required
       CHECK (contact_user_id IS NOT NULL OR contact_name IS NOT NULL);`,
  );

  await context.addIndex("operational_contacts", ["area"], {
    name: "operational_contacts_area_idx",
  });
  await context.addIndex("operational_contacts", ["area", "active_status"], {
    name: "operational_contacts_area_active_idx",
  });
  await context.addIndex("operational_contacts", ["contact_user_id"], {
    name: "operational_contacts_contact_user_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("operational_contacts", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_operational_contacts_role";`);
  await context.sequelize.query(
    `DROP TYPE IF EXISTS "enum_operational_contacts_verification_status";`,
  );
}
