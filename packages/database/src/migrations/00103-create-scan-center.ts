import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Scan Center module foundation (module #31, `docs/implementation/module-scan-center.md`).
 * Four tables forming a real pipeline: `scan_definitions` (what to scan, and how) ->
 * `scan_runs` (one execution of a definition) -> `scan_findings` (issues surfaced by a completed
 * run) -> `scan_evidence` (immutable supporting material attached to one finding).
 *
 * `project_id` uses `onDelete: "RESTRICT"` on all four tables, mirroring every other
 * project-scoped module's own choice — the Projects module's own task-package rule 7
 * ("No cascading deletion from `projects` into any website/business-record table") applies
 * directly here. `project_id` is denormalized onto `scan_runs`/`scan_findings`/`scan_evidence`
 * (not just derivable via join through their parent row) for cheap query/IDOR scoping at every
 * layer — the same pattern `claim_sources`/`case_study_assets` establish for a multi-table
 * project-scoped pipeline.
 *
 * None of these four tables ever support a hard delete (ADR-0016) — only status/enable
 * transitions.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("scan_definitions", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Stable, human-readable identifier — never regenerated once assigned, globally unique
     *  (not per-project), same contract as `pages.public_id`/`keywords.public_id`. */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    scan_type: {
      type: DataTypes.ENUM(
        "full_website",
        "selected_page",
        "repository",
        "wordpress_health",
        "theme_plugin_core_currency",
        "security_indicators",
        "accessibility",
        "performance",
        "links",
        "metadata",
        "structured_data",
      ),
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM("manual", "scheduled"),
      allowNull: false,
      defaultValue: "manual",
    },
    /** A URL/path/repo-ref describing what's being scanned — deliberately NOT URL-validated at
     *  either layer; a repository ref or a "selected page" slug is not always a URL. */
    target: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** e.g. production/staging/development — plain free text, no closed enum sourced anywhere. */
    environment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** Only meaningful when `mode = 'scheduled'` — not enforced at the DB layer (no CHECK tying
     *  the two columns together), matching this codebase's own restraint about cross-column
     *  invariants that a service-layer check already covers just as well. */
    schedule_cron: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("scan_definitions", ["public_id"], {
    name: "scan_definitions_public_id_unique",
    unique: true,
  });
  await context.addIndex("scan_definitions", ["project_id", "updated_at", "id"], {
    name: "scan_definitions_project_id_updated_at_id_idx",
  });
  await context.addIndex("scan_definitions", ["project_id", "scan_type"], {
    name: "scan_definitions_project_id_scan_type_idx",
  });

  await context.createTable("scan_runs", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** Denormalized from `scan_definitions.project_id` for cheap query/IDOR scoping — every route
     *  reads and writes this table exclusively through the `:projectId` route path segment. */
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    scan_definition_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "scan_definitions", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM(
        "requested",
        "queued",
        "running",
        "completed",
        "partially_completed",
        "failed",
        "timed_out",
        "cancelled",
      ),
      allowNull: false,
      defaultValue: "requested",
    },
    trigger_type: {
      type: DataTypes.ENUM("manual", "scheduled"),
      allowNull: false,
    },
    /** Server-stamped only, by `ScanRunRepository.updateStatus()`'s own atomic `COALESCE` write
     *  when the target status is `running` — never accepted as caller input, never overwritten
     *  once first set. */
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /** Server-stamped only, the same way, when the target status is any terminal status
     *  (`completed`/`partially_completed`/`failed`/`timed_out`/`cancelled`). */
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    error_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
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

  await context.addIndex("scan_runs", ["public_id"], {
    name: "scan_runs_public_id_unique",
    unique: true,
  });
  await context.addIndex("scan_runs", ["project_id", "updated_at", "id"], {
    name: "scan_runs_project_id_updated_at_id_idx",
  });
  await context.addIndex("scan_runs", ["project_id", "status"], {
    name: "scan_runs_project_id_status_idx",
  });
  await context.addIndex("scan_runs", ["scan_definition_id"], {
    name: "scan_runs_scan_definition_id_idx",
  });

  await context.createTable("scan_findings", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** Denormalized from `scan_runs.project_id`. */
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    scan_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "scan_runs", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Plain free text — no canonical value list exists anywhere in the sources for this field. */
    category: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    severity: {
      type: DataTypes.ENUM("critical", "high", "medium", "low", "info"),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** A URL/selector/file path the finding pertains to. */
    location: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("open", "acknowledged", "resolved", "dismissed"),
      allowNull: false,
      defaultValue: "open",
    },
    /** Server-stamped only, by `ScanFindingRepository.updateStatus()`'s own atomic `COALESCE`
     *  write when the target status is `resolved` — never overwritten once first set. */
    resolved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("scan_findings", ["public_id"], {
    name: "scan_findings_public_id_unique",
    unique: true,
  });
  await context.addIndex("scan_findings", ["project_id", "updated_at", "id"], {
    name: "scan_findings_project_id_updated_at_id_idx",
  });
  await context.addIndex("scan_findings", ["scan_run_id"], {
    name: "scan_findings_scan_run_id_idx",
  });
  await context.addIndex("scan_findings", ["project_id", "severity"], {
    name: "scan_findings_project_id_severity_idx",
  });
  await context.addIndex("scan_findings", ["project_id", "status"], {
    name: "scan_findings_project_id_status_idx",
  });
  // Fuzzy-search support on title — the one obvious fuzzy-search target on this table, same
  // pattern as internal_links_anchor_trgm_idx/keywords_query_text_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX scan_findings_title_trgm_idx ON scan_findings USING gin (title gin_trgm_ops);",
  );

  await context.createTable("scan_evidence", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** Denormalized from `scan_findings.project_id`. */
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    scan_finding_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "scan_findings", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    evidence_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    /** Validated at the DTO layer, when present, via the shared `safeHttpUrlSchema`
     *  (`@webdesk/validation`) — NOT at the DB layer, mirroring every other stored-URL column in
     *  this codebase. */
    reference: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    captured_at: {
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
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addIndex("scan_evidence", ["public_id"], {
    name: "scan_evidence_public_id_unique",
    unique: true,
  });
  await context.addIndex("scan_evidence", ["scan_finding_id"], {
    name: "scan_evidence_scan_finding_id_idx",
  });
  await context.addIndex("scan_evidence", ["project_id"], {
    name: "scan_evidence_project_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("scan_evidence", {});
  await context.dropTable("scan_findings", {});
  await context.dropTable("scan_runs", {});
  await context.dropTable("scan_definitions", {});

  await context.sequelize.query('DROP TYPE IF EXISTS "enum_scan_findings_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_scan_findings_severity";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_scan_runs_trigger_type";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_scan_runs_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_scan_definitions_mode";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_scan_definitions_scan_type";');
}
