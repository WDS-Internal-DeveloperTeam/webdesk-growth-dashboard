import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Technical Center module foundation (module `technical_center`,
 * `docs/implementation/module-technical-center.md`). Three tables forming a real pipeline,
 * mirroring Scan Center's own three-of-its-four-table shape almost exactly (migration `00103`):
 * `technical_check_definitions` (what to check, and how) -> `technical_check_runs` (one execution
 * of a definition) -> `technical_findings` (issues surfaced by a completed run). No
 * `technical_evidence` table — no genuine "supporting artifact" need was identified for this
 * module (see the entities file's own doc comment).
 *
 * `project_id` uses `onDelete: "RESTRICT"` on all three tables, mirroring every other
 * project-scoped module's own choice — the Projects module's own task-package rule 7
 * ("No cascading deletion from `projects` into any website/business-record table") applies
 * directly here. `project_id` is denormalized onto `technical_check_runs`/`technical_findings`
 * (not just derivable via join through their parent row) for cheap query/IDOR scoping at every
 * layer — the same pattern Scan Center's own `scan_runs`/`scan_findings` establish.
 *
 * Neither of these three tables ever supports a hard delete (ADR-0016) — only status/enable
 * transitions.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("technical_check_definitions", {
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
     *  (not per-project), same contract as `scan_definitions.public_id`. */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    check_type: {
      type: DataTypes.ENUM(
        "coding_standards",
        "linting",
        "automated_tests",
        "coverage",
        "dependency_vulnerability",
        "wordpress_compatibility",
        "php_compatibility",
        "code_review",
        "security",
        "accessibility",
        "performance",
        "browser_compatibility",
        "visual_regression",
      ),
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM("manual", "scheduled"),
      allowNull: false,
      defaultValue: "manual",
    },
    /** A URL/path/repo-ref/package-name describing what's being checked — deliberately NOT
     *  URL-validated at either layer; not every check target is a URL. */
    target: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** e.g. production/staging/development — plain free text, no closed enum sourced anywhere. */
    environment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** Only meaningful when `mode = 'scheduled'` — not enforced at the DB layer, matching
     *  `scan_definitions.schedule_cron`'s own restraint. */
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

  await context.addIndex("technical_check_definitions", ["public_id"], {
    name: "technical_check_definitions_public_id_unique",
    unique: true,
  });
  await context.addIndex("technical_check_definitions", ["project_id", "updated_at", "id"], {
    name: "technical_check_definitions_project_id_updated_at_id_idx",
  });
  await context.addIndex("technical_check_definitions", ["project_id", "check_type"], {
    name: "technical_check_definitions_project_id_check_type_idx",
  });
  // Fuzzy-search support on name — TechnicalCheckDefinitionRepository.list()'s own `search` filter
  // does an `Op.iLike` match on this column, mirroring scan_definitions_name_trgm_idx.
  // `CREATE EXTENSION IF NOT EXISTS` is idempotent, so calling it again below is safe.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX technical_check_definitions_name_trgm_idx ON technical_check_definitions USING gin (name gin_trgm_ops);",
  );

  await context.createTable("technical_check_runs", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** Denormalized from `technical_check_definitions.project_id` for cheap query/IDOR scoping —
     *  every route reads and writes this table exclusively through the `:projectId` route path
     *  segment. */
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
    technical_check_definition_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "technical_check_definitions", key: "id" },
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
    /** Server-stamped only, by `TechnicalCheckRunRepository.updateStatus()`'s own atomic
     *  `COALESCE` write when the target status is `running` — never accepted as caller input,
     *  never overwritten once first set. */
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

  await context.addIndex("technical_check_runs", ["public_id"], {
    name: "technical_check_runs_public_id_unique",
    unique: true,
  });
  await context.addIndex("technical_check_runs", ["project_id", "updated_at", "id"], {
    name: "technical_check_runs_project_id_updated_at_id_idx",
  });
  await context.addIndex("technical_check_runs", ["project_id", "status"], {
    name: "technical_check_runs_project_id_status_idx",
  });
  await context.addIndex("technical_check_runs", ["technical_check_definition_id"], {
    name: "technical_check_runs_technical_check_definition_id_idx",
  });

  await context.createTable("technical_findings", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** Denormalized from `technical_check_runs.project_id`. */
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
    technical_check_run_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "technical_check_runs", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Plain free text — no canonical value list is sourced anywhere for this field (`check_type`
     *  on the parent definition already carries the real taxonomy). */
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
    /** A URL/selector/file path/line the finding pertains to. */
    location: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("open", "acknowledged", "resolved", "dismissed"),
      allowNull: false,
      defaultValue: "open",
    },
    /** Server-stamped only, by `TechnicalFindingRepository.updateStatus()`'s own atomic
     *  `COALESCE` write when the target status is `resolved`/`dismissed` — never overwritten once
     *  first set. */
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

  await context.addIndex("technical_findings", ["public_id"], {
    name: "technical_findings_public_id_unique",
    unique: true,
  });
  await context.addIndex("technical_findings", ["project_id", "updated_at", "id"], {
    name: "technical_findings_project_id_updated_at_id_idx",
  });
  await context.addIndex("technical_findings", ["technical_check_run_id"], {
    name: "technical_findings_technical_check_run_id_idx",
  });
  await context.addIndex("technical_findings", ["project_id", "severity"], {
    name: "technical_findings_project_id_severity_idx",
  });
  await context.addIndex("technical_findings", ["project_id", "status"], {
    name: "technical_findings_project_id_status_idx",
  });
  // Fuzzy-search support on title — the one obvious fuzzy-search target on this table, mirroring
  // scan_findings_title_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX technical_findings_title_trgm_idx ON technical_findings USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("technical_findings", {});
  await context.dropTable("technical_check_runs", {});
  await context.dropTable("technical_check_definitions", {});

  await context.sequelize.query('DROP TYPE IF EXISTS "enum_technical_findings_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_technical_findings_severity";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_technical_check_runs_trigger_type";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_technical_check_runs_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_technical_check_definitions_mode";');
  await context.sequelize.query(
    'DROP TYPE IF EXISTS "enum_technical_check_definitions_check_type";',
  );
}
