import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Knowledge Library (`docs/implementation/module-knowledge-library.md`) — one generic table for
 * all reference-source records the canonical spec describes (D2), matching Business Knowledge
 * Center's own single-table precedent (same RBAC permission group, same flat unstructured field
 * list, no described sub-resources). Organization-wide, not project-scoped — no `project_id`
 * column.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("knowledge_library_records", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // D4 — plain free text, no taxonomy exists anywhere in the canonical spec.
    source_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    // D5 — the spec's "URL/file" field, plain text (not URL-validated): a reference source's
    // location may genuinely be a URL, an internal file path, or a citation.
    location: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
    // D6 — real FK into users, existence-validated at the service layer before write.
    owner_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    source_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // D1 — a real, separate confidentiality enum (Service Library's own pattern), distinct from
    // `status`.
    confidentiality: {
      type: DataTypes.ENUM("public", "internal", "restricted"),
      allowNull: false,
      defaultValue: "public",
    },
    // D10 — stored, not yet acted on; no consuming "agent memory" mechanism exists anywhere in
    // this codebase yet.
    approved_for_agent_use: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // D3 — Business Knowledge Center's own 5-value vocabulary with `restricted` removed, since
    // confidentiality is now a real, separate field above. `deprecated` is terminal (no hard
    // delete, ADR-0016).
    status: {
      type: DataTypes.ENUM("draft", "mandatory", "advisory", "deprecated"),
      allowNull: false,
      defaultValue: "draft",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // D7 — plain, unvalidated string array; "related entities" isn't scoped to any single other
    // module in the spec, so no existence-check target exists.
    related_entity_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    // D8 — server-managed integer counter, incremented by 1 on every real update() call via a
    // Postgres-evaluated `version + 1` literal (mirrors PersonaRepository.update()'s own pattern).
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // D9 — a plain, caller-settable nullable timestamp; no dedicated "mark reviewed" action
    // exists anywhere in the spec.
    last_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
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

  await context.addIndex("knowledge_library_records", ["source_type"], {
    name: "knowledge_library_records_source_type_idx",
  });
  await context.addIndex("knowledge_library_records", ["status"], {
    name: "knowledge_library_records_status_idx",
  });
  await context.addIndex("knowledge_library_records", ["confidentiality"], {
    name: "knowledge_library_records_confidentiality_idx",
  });

  // Fuzzy-search support on title, mirroring section_pattern_records_name_trgm_idx/
  // design_tokens_name_trgm_idx/website_strategy_records_title_trgm_idx/etc.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX knowledge_library_records_title_trgm_idx ON knowledge_library_records USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("knowledge_library_records", {});
  await context.sequelize.query(
    `DROP TYPE IF EXISTS "enum_knowledge_library_records_confidentiality";`,
  );
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_knowledge_library_records_status";`);
}
