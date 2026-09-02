import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Import and Export Center module foundation (module #34,
 * `docs/implementation/module-import-and-export-center.md`) — a real, organization-wide
 * record-keeping mechanism for import templates, import runs (with row-level results and
 * errors), and export runs. No real file-upload/parsing/target-table-writer engine exists behind
 * this schema (confirmed scope) — a future, separately-authorized capability consumes it.
 *
 * Five tables: `import_templates` (a reusable, versioned import configuration) ->
 * `import_runs` (one execution of a template, through a real two-tier submit/review/approve gate
 * before any mechanical validation/import) -> `import_rows`/`import_errors` (a run's own
 * row-level results and errors, bulk-created only alongside the run's own
 * `validating -> dry_run_completed`/`validating -> importing` transition — no standalone create
 * route for either). `export_runs` is a separate, simpler 5-state pipeline with no approval gate
 * (the `exports` RBAC group has no submit/review/approve letters — `export` itself functions as
 * the create-gate, mirroring `imports`' own `X`-as-gate semantics).
 *
 * Organization-wide — no `project_id` column on any of the five tables (an import template is
 * reused across many projects' data, matching Business Knowledge Center's/Service Library's own
 * organization-wide precedent, not Scan Center's/Page Inventory's project-scoped shape).
 * `target_module_key` (on `import_templates` and `export_runs`) names which business module's
 * data is being imported/exported, validated at the service layer against the real module
 * registry via `AuthorizationService.isValidModuleKey()` — never a foreign key (the module
 * registry is a lookup table, not a data table this module writes into), mirroring Review and
 * Approval Center's/Change Center's own identical `target_module_key` treatment.
 *
 * None of the five tables ever support a hard delete (ADR-0016) — only status transitions.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("import_templates", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    /** No foreign key — validated at the service layer against the real module registry only
     *  (`AuthorizationService.isValidModuleKey()`). */
    target_module_key: { type: DataTypes.STRING(100), allowNull: false },
    /** Free-form source-column -> target-field pairs — no schema imposed, since the target
     *  module's own field shape varies per `target_module_key`. */
    column_mapping: { type: DataTypes.JSONB, allowNull: true },
    duplicate_strategy_default: {
      type: DataTypes.ENUM("skip", "overwrite", "create_new"),
      allowNull: false,
      defaultValue: "skip",
    },
    file_format: {
      type: DataTypes.ENUM("csv", "xlsx", "json"),
      allowNull: false,
    },
    /** Server-managed — atomically incremented via a `literal("version + 1")` write on every
     *  content update (`ImportTemplateRepository.update()`), mirroring
     *  `PersonaRepository.update()`'s own `returning: true` pattern, no read-then-write race. */
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
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
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("import_templates", ["public_id"], {
    name: "import_templates_public_id_unique",
    unique: true,
  });
  await context.addIndex("import_templates", ["updated_at", "id"], {
    name: "import_templates_updated_at_id_idx",
  });
  await context.addIndex("import_templates", ["target_module_key"], {
    name: "import_templates_target_module_key_idx",
  });
  await context.addIndex("import_templates", ["is_active"], {
    name: "import_templates_is_active_idx",
  });
  // Fuzzy-search support on name, mirroring scan_definitions_name_trgm_idx/personas_name_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX import_templates_name_trgm_idx ON import_templates USING gin (name gin_trgm_ops);",
  );

  await context.createTable("import_runs", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    import_template_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "import_templates", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** A snapshot of the template's own `version` at run-creation time — NOT a live join, since a
     *  template may be edited after a run references it and the run must record what version it
     *  actually validated against. */
    template_version: { type: DataTypes.INTEGER, allowNull: false },
    is_dry_run: { type: DataTypes.BOOLEAN, allowNull: false },
    /** Nullable — falls back to the template's own `duplicate_strategy_default` when omitted; the
     *  fallback is resolved by callers reading the run, never copied in at write time (avoids a
     *  stale-copy bug if the template's own default later changes). */
    duplicate_strategy: {
      type: DataTypes.ENUM("skip", "overwrite", "create_new"),
      allowNull: true,
    },
    /** Opaque, plain text — deliberately NOT URL-validated, mirroring `scan_definitions.target`'s
     *  own precedent: no file-storage infrastructure is wired to this module. */
    source_file_reference: { type: DataTypes.TEXT, allowNull: true },
    /** A SHA-256 or similar — the idempotency material `04_Data_Model_and_Ownership.md` names
     *  ("source file checksum, template version, and row external ID"). */
    source_checksum: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM(
        "draft",
        "submitted",
        "approved",
        "validating",
        "dry_run_completed",
        "importing",
        "completed",
        "partially_completed",
        "failed",
        "cancelled",
        "rejected",
        "rolled_back",
      ),
      allowNull: false,
      defaultValue: "draft",
    },
    /** Server-computed only, via a `GROUP BY status, COUNT(*)` query over `import_rows` after each
     *  bulk row-insert (`ImportRunRepository.countByStatus()`/`applyRowCounts()`) — never trusted
     *  from caller input. */
    total_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    success_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    error_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    skipped_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    error_summary: { type: DataTypes.TEXT, allowNull: true },
    /** Captures WHY/HOW a rollback happened — no real automated reversal exists (confirmed
     *  record-keeping-only scope), so this records the human account of what was actually
     *  reversed, not a claim that an automated undo happened. */
    rollback_notes: { type: DataTypes.TEXT, allowNull: true },
    /** Server-stamped only, by `ImportRunRepository.updateStatus()`'s own atomic `COALESCE`
     *  write when the target status is `importing` — never accepted as caller input, never
     *  overwritten once first set. */
    started_at: { type: DataTypes.DATE, allowNull: true },
    /** Server-stamped the same way, when the target status is any terminal status
     *  (`completed`/`partially_completed`/`failed`/`cancelled`/`rejected`/`rolled_back`). */
    completed_at: { type: DataTypes.DATE, allowNull: true },
    requested_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("import_runs", ["public_id"], {
    name: "import_runs_public_id_unique",
    unique: true,
  });
  await context.addIndex("import_runs", ["updated_at", "id"], {
    name: "import_runs_updated_at_id_idx",
  });
  await context.addIndex("import_runs", ["import_template_id"], {
    name: "import_runs_import_template_id_idx",
  });
  await context.addIndex("import_runs", ["status"], {
    name: "import_runs_status_idx",
  });

  await context.createTable("import_rows", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    import_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "import_runs", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    row_number: { type: DataTypes.INTEGER, allowNull: false },
    /** The row's own natural identifier from the source data — the row-level half of the
     *  idempotency triple `04_Data_Model_and_Ownership.md` names. */
    external_id: { type: DataTypes.TEXT, allowNull: true },
    /** The row's source values as submitted — free-form, no schema imposed. */
    raw_data: { type: DataTypes.JSONB, allowNull: true },
    status: {
      type: DataTypes.ENUM("pending", "valid", "invalid", "imported", "skipped", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    /** Which duplicate-policy outcome actually applied to this row — only set once a row is
     *  processed. */
    resolution: {
      type: DataTypes.ENUM("created", "overwritten", "skipped_duplicate"),
      allowNull: true,
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // Composite, matching ImportRowRepository.list()'s own WHERE + ORDER BY exactly — every list
  // call filters on import_run_id, then sorts by row_number, the natural presentation order for a
  // run's own rows (mirrors scan_evidence_scan_finding_id_created_at_id_idx's own reasoning).
  await context.addIndex("import_rows", ["import_run_id", "row_number"], {
    name: "import_rows_import_run_id_row_number_idx",
  });
  await context.addIndex("import_rows", ["import_run_id", "status"], {
    name: "import_rows_import_run_id_status_idx",
  });

  await context.createTable("import_errors", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    import_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "import_runs", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Nullable — a run-level error (e.g. "file not found") has no specific row. */
    import_row_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "import_rows", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    error_code: { type: DataTypes.TEXT, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: false },
    /** Which mapped column/field the error concerns, when row-specific. */
    field_name: { type: DataTypes.TEXT, allowNull: true },
    // No updated_at — append-only, never edited (matches scan_evidence's own immutable-row
    // precedent, ADR-0016).
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("import_errors", ["import_run_id"], {
    name: "import_errors_import_run_id_idx",
  });
  await context.addIndex("import_errors", ["import_row_id"], {
    name: "import_errors_import_row_id_idx",
  });

  await context.createTable("export_runs", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** No foreign key — same reasoning/mechanism as `import_templates.target_module_key`. */
    target_module_key: { type: DataTypes.STRING(100), allowNull: false },
    /** An opaque, caller-supplied filter description — no schema imposed, mirrors
     *  `import_templates.column_mapping`'s own reasoning. */
    filter_criteria: { type: DataTypes.JSONB, allowNull: true },
    format: {
      type: DataTypes.ENUM("csv", "xlsx", "json"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("requested", "processing", "completed", "failed", "cancelled"),
      allowNull: false,
      defaultValue: "requested",
    },
    row_count: { type: DataTypes.INTEGER, allowNull: true },
    /** Opaque, plain text — deliberately NOT URL-validated, same reasoning as
     *  `import_runs.source_file_reference`. */
    file_reference: { type: DataTypes.TEXT, allowNull: true },
    /** Always `true` at creation (never a caller-settable create-DTO field) — there is no
     *  mechanism anywhere in this codebase today that would let an export actually include a
     *  confidential field, so nothing here claims otherwise (module registry's own seeded
     *  `confidentialityLevel` constraint for `import_and_export_center`). */
    excludes_confidential_fields: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    error_summary: { type: DataTypes.TEXT, allowNull: true },
    /** Server-stamped only, the same atomic `COALESCE` pattern as `import_runs`, when the target
     *  status is `processing`. */
    started_at: { type: DataTypes.DATE, allowNull: true },
    /** Server-stamped when the target status is any terminal status
     *  (`completed`/`failed`/`cancelled`). */
    completed_at: { type: DataTypes.DATE, allowNull: true },
    requested_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("export_runs", ["public_id"], {
    name: "export_runs_public_id_unique",
    unique: true,
  });
  await context.addIndex("export_runs", ["updated_at", "id"], {
    name: "export_runs_updated_at_id_idx",
  });
  await context.addIndex("export_runs", ["target_module_key"], {
    name: "export_runs_target_module_key_idx",
  });
  await context.addIndex("export_runs", ["status"], {
    name: "export_runs_status_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("export_runs", {});
  await context.dropTable("import_errors", {});
  await context.dropTable("import_rows", {});
  await context.dropTable("import_runs", {});
  await context.dropTable("import_templates", {});

  await context.sequelize.query('DROP TYPE IF EXISTS "enum_export_runs_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_export_runs_format";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_import_rows_resolution";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_import_rows_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_import_runs_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_import_runs_duplicate_strategy";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_import_templates_file_format";');
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_import_templates_duplicate_strategy_default";',
  );
}
