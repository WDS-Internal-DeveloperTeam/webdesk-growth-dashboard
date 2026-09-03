import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Release Center module foundation (module `release_center`,
 * `docs/implementation/module-release-center.md`). Six tables, one per the canonical spec's own
 * named field group (`03_Detailed_Module_Specifications.md §36`): `releases` (parent — release
 * type/title/the real 14-status workflow), `release_artifacts` ("repositories and SHAs, PRs"),
 * `release_approvals` (an append-only decision log, mirroring `case_study_approvals` file-for-file),
 * `deployments` (an append-only history of deploy attempts), `smoke_tests` (an append-only list of
 * smoke-test results), `rollback_records` ("rolled-back SHA, reason, replacement release" — a
 * literal field-for-field match).
 *
 * Project-scoped (D2) — `project_id` is denormalized onto every child table (not just derivable
 * via join through `releases`) for cheap query/IDOR scoping at every layer, mirroring Technical
 * Center's/Scan Center's own established pattern for a multi-table project-scoped pipeline.
 * `project_id` uses `onDelete: "RESTRICT"` everywhere, matching every other project-scoped
 * module's own choice. Every `release_id` FK uses `onDelete: "CASCADE"` — a child row is
 * meaningless without its parent (this never actually fires in practice, since `releases` rows are
 * never hard-deleted, ADR-0016 — matching `case_study_assets.case_study_id`'s own identical
 * convention).
 *
 * `public_id` is unique per table (not per-project), matching every sibling module.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("releases", {
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
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    release_type: {
      type: DataTypes.ENUM("staging", "production", "hotfix", "rollback"),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    /** The real, named 14-status workflow (`05_Workflow_State_Machines.md §10`) — governed
     *  exclusively via `ReleasesService.changeStatus()`'s own `TRANSITIONS` map, never accepted
     *  through `create()`/`update()`. */
    status: {
      type: DataTypes.ENUM(
        "proposed",
        "checks_running",
        "checks_failed",
        "ready_for_staging",
        "staging_deployed",
        "staging_verification",
        "verification_failed",
        "staging_approved",
        "production_approval",
        "production_deployed",
        "production_verification",
        "completed",
        "hotfix_required",
        "rolled_back",
      ),
      allowNull: false,
      defaultValue: "proposed",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hotfix_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assigned_developer_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    assigned_reviewer_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Server-stamped only, by `ReleaseRepository.updateStatus()`'s own atomic write on the
     *  `production_approval -> production_deployed` transition specifically — never accepted as
     *  caller input. */
    production_approver_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** All seven of these are server-stamped only, via the same atomic `COALESCE(column, NOW())`
     *  "stamp once, never overwrite" write, mirroring `CaseStudyRepository.updateStatus()`'s own
     *  pattern. */
    staging_deployed_at: { type: DataTypes.DATE, allowNull: true },
    staging_verified_at: { type: DataTypes.DATE, allowNull: true },
    production_deployed_at: { type: DataTypes.DATE, allowNull: true },
    production_verified_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    hotfix_required_at: { type: DataTypes.DATE, allowNull: true },
    rolled_back_at: { type: DataTypes.DATE, allowNull: true },
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

  await context.addIndex("releases", ["public_id"], {
    name: "releases_public_id_unique",
    unique: true,
  });
  await context.addIndex("releases", ["project_id", "updated_at", "id"], {
    name: "releases_project_id_updated_at_id_idx",
  });
  await context.addIndex("releases", ["project_id", "status"], {
    name: "releases_project_id_status_idx",
  });
  await context.addIndex("releases", ["project_id", "release_type"], {
    name: "releases_project_id_release_type_idx",
  });
  // Fuzzy-search support on title — the one obvious fuzzy-search target on this table, mirroring
  // technical_check_definitions_name_trgm_idx/scan_definitions_name_trgm_idx.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX releases_title_trgm_idx ON releases USING gin (title gin_trgm_ops);",
  );

  // --- release_artifacts ("repositories and SHAs, PRs") ---
  await context.createTable("release_artifacts", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    release_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "releases", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    /** Denormalized from `releases.project_id` for cheap query/IDOR scoping. */
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    repo_owner: { type: DataTypes.STRING(255), allowNull: false },
    repo_name: { type: DataTypes.STRING(255), allowNull: false },
    commit_sha: { type: DataTypes.STRING(40), allowNull: false },
    /** Validated as a safe http(s) URL at the DTO layer (`safeHttpUrlSchema`,
     *  `@webdesk/validation`) — NOT a DB constraint, matching `ProjectRepositoryEntity`'s own
     *  precedent, this project's own reference implementation for a repository-reference field. */
    pr_url: { type: DataTypes.TEXT, allowNull: true },
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
  // Only `release_id`-scoped queries exist for this table (create/list/remove all filter by
  // release_id) — no separate `project_id`-only index, code-review finding: the original
  // migration added one with no matching query shape anywhere in this module.
  await context.addIndex("release_artifacts", ["release_id"], {
    name: "release_artifacts_release_id_idx",
  });

  // --- release_approvals ("approvals" — an append-only decision log, mirroring
  // case_study_approvals file-for-file) ---
  await context.createTable("release_approvals", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    release_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "releases", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    approval_stage: { type: DataTypes.ENUM("staging", "production"), allowNull: false },
    decision: {
      type: DataTypes.ENUM("approved", "rejected", "hotfix_required"),
      allowNull: false,
    },
    decided_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  // Only `release_id`-scoped queries exist for this table — same code-review finding as
  // release_artifacts above, no separate `project_id`-only index.
  await context.addIndex("release_approvals", ["release_id"], {
    name: "release_approvals_release_id_idx",
  });

  // --- deployments ("deployments" — an append-only history of every deploy attempt; real
  // re-deploys are possible even after releases.staging_deployed_at/production_deployed_at are
  // first stamped, since those columns record only the FIRST success) ---
  await context.createTable("deployments", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    release_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "releases", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    environment: { type: DataTypes.ENUM("staging", "production"), allowNull: false },
    outcome: { type: DataTypes.ENUM("succeeded", "failed"), allowNull: false },
    deployed_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    deployed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  // Only `release_id`-scoped queries exist for this table — same code-review finding, no separate
  // `(project_id, environment)` index with no matching query.
  await context.addIndex("deployments", ["release_id"], {
    name: "deployments_release_id_idx",
  });

  // --- smoke_tests ("smoke tests") ---
  await context.createTable("smoke_tests", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    release_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "releases", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    environment: { type: DataTypes.ENUM("staging", "production"), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    result: { type: DataTypes.ENUM("passed", "failed"), allowNull: false },
    ran_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  // Only `release_id`-scoped queries exist for this table — same code-review finding, no separate
  // `(project_id, environment)` index with no matching query.
  await context.addIndex("smoke_tests", ["release_id"], {
    name: "smoke_tests_release_id_idx",
  });

  // --- rollback_records ("rolled-back SHA, reason, replacement release" — a literal
  // field-for-field match) ---
  await context.createTable("rollback_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** The release being rolled back. */
    release_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "releases", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    rolled_back_sha: { type: DataTypes.STRING(40), allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    /** Self-referential, existence-validated within the same project at the service layer
     *  (`ReleasesService.changeStatus()`'s own `replacementReleaseId` check) — mirrors
     *  `ServiceEntity.parentServiceId`'s own real-FK-with-`SET NULL` precedent, not
     *  `page_templates.replacement_record_id`'s own app-layer-only shape, since the spec names this
     *  relationship explicitly. */
    replacement_release_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "releases", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    rolled_back_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    rolled_back_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  // Doubles as the real "at most one rollback per release" constraint, not just a lookup
  // accelerator — kept even though every other project_id-only index in this migration was
  // removed as speculative (code-review finding), since this one is load-bearing regardless.
  await context.addIndex("rollback_records", ["release_id"], {
    name: "rollback_records_release_id_unique",
    unique: true,
  });
  await context.addIndex("rollback_records", ["replacement_release_id"], {
    name: "rollback_records_replacement_release_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("rollback_records", {});
  await context.dropTable("smoke_tests", {});
  await context.dropTable("deployments", {});
  await context.dropTable("release_approvals", {});
  await context.dropTable("release_artifacts", {});
  await context.dropTable("releases", {});

  await context.sequelize.query('DROP TYPE IF EXISTS "enum_smoke_tests_result";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_smoke_tests_environment";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_deployments_outcome";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_deployments_environment";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_release_approvals_decision";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_release_approvals_approval_stage";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_releases_status";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_releases_release_type";');
}
