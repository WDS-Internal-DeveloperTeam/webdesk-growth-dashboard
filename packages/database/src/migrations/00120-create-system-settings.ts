import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The System Settings module foundation (`docs/implementation/module-system-settings.md`, module
 * #42). One single table, `system_settings`, matching Business Knowledge Center's/Persona
 * Library's/Service Library's/Brand Library's own single-generic-table precedent for a
 * heterogeneous flat field list with no per-type schema basis in the canonical spec
 * (`03_Detailed_Module_Specifications.md §42`: "statuses, categories, taxonomies, file limits,
 * scan schedules, Git rules, backup rules, retention, contacts, escalation SLAs, documentation
 * rules, and environments" — a bare list with no field-level schema).
 *
 * Scope is narrower than that bare list (see the implementation doc's own "Scope decision"): scan
 * schedules (Scan Center's `scan_definitions`), retention (`retention_policies`/
 * `retention_holds`), and contacts (`operational_contacts`) already have their own dedicated,
 * already-live tables and are explicitly OUT of scope here, to avoid a second source of truth for
 * something already built.
 *
 * Organization-wide, not project-scoped — no `project_id` column, matching every other
 * settings/library module's own precedent (Business Knowledge Center, Service Library, Persona
 * Library, Brand Library).
 *
 * `setting_type` distinguishes the module's 9 real in-scope setting kinds (D1) — immutable after
 * creation, mirroring `brand_library_records.record_type`'s own identical "changing it after
 * creation would be a different record" contract.
 *
 * `value` is a bounded JSONB column (D2) — each `settingType`'s real shape differs (a file limit is
 * a byte count + allowed MIME list; a Git rule is a branch-naming pattern; an environment is a
 * name + URL + type). Validated at the DTO layer only (a local `boundedJsonObjectSchema()` helper,
 * mirroring `import-and-export-center.dto.ts`'s own identical 50,000-byte-cap helper — this
 * implementation doc's own "reuses the shared helper" framing turned out to be aspirational: no
 * such export actually exists in `@webdesk/validation` today, so this module declares its own
 * local copy rather than a nonexistent import; see the "As-built" section below), no per-
 * `settingType` schema validation beyond that, since no spec exists to validate against.
 *
 * `key` is a stable, human-assigned slug (D3), unique per `(setting_type, key)` — not globally
 * unique, so e.g. `git_rule:branch-pattern` and `documentation_rule:branch-pattern` can coexist.
 * Enforced via a real composite DB-level UNIQUE index, not a partial one — `is_active` is a real
 * config toggle, not a lifecycle/archival state, so a caller must not be able to create a second
 * row with the same `(setting_type, key)` just because the first is inactive.
 *
 * `is_active` is a real, orthogonal boolean (D4) — gated on the `configure` (`M`) RBAC action, not
 * `edit`, mirroring the already-established publish/unpublish orthogonal-action pattern (Content
 * Template Library, Brand Library) but as a single toggle rather than a publish/unpublish pair,
 * since there is no publish-shaped semantic here — just "set active"/"set inactive".
 *
 * No `approval_status`/`version`/`is_published`/`published_at` columns — this module has no
 * approval workflow (D5: the seeded `system_settings` RBAC group's `review`/`R` action is left
 * deliberately unwired, not fabricated a meaning) and no publish concept.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("system_settings", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned, matching
     *  `brand_library_records.public_id`'s own comment. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** Immutable after creation (D1) — changing it after creation would be a different record,
     *  never accepted through the update route. */
    setting_type: {
      type: DataTypes.ENUM(
        "status_definition",
        "category_definition",
        "taxonomy_definition",
        "file_limit",
        "git_rule",
        "backup_rule",
        "escalation_sla",
        "documentation_rule",
        "environment",
      ),
      allowNull: false,
    },
    /** A stable, human-assigned slug (D3) — unique per `(setting_type, key)`, not globally
     *  unique. Editable via the content-update route (unlike `setting_type`), so a real Git-rule
     *  typo can be corrected without deleting and recreating the row. */
    key: { type: DataTypes.STRING(200), allowNull: false },
    /** Bounded JSONB (D2) — each `settingType`'s real shape differs, validated at the DTO layer
     *  only (a 50,000-byte serialized-size cap), no per-`settingType` schema validation. */
    value: { type: DataTypes.JSONB, allowNull: false },
    description: { type: DataTypes.STRING(2000), allowNull: true },
    /** Orthogonal to nothing here (no approval workflow exists) — governed via the dedicated
     *  `:id/active-state` route, gated on the `configure` action, not `edit` (D4). */
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

  await context.addIndex("system_settings", ["public_id"], {
    name: "system_settings_public_id_unique",
    unique: true,
  });
  // Real composite UNIQUE index (D3) — not partial (no is_active exclusion): a second row with
  // the identical (setting_type, key) pair must be rejected regardless of whether the first is
  // active or inactive, since is_active is a config toggle, not an archival/lifecycle state.
  await context.addIndex("system_settings", ["setting_type", "key"], {
    name: "system_settings_type_key_unique",
    unique: true,
  });
  await context.addIndex("system_settings", ["setting_type"], {
    name: "system_settings_setting_type_idx",
  });
  await context.addIndex("system_settings", ["is_active"], {
    name: "system_settings_is_active_idx",
  });
  await context.addIndex("system_settings", ["updated_at"], {
    name: "system_settings_updated_at_idx",
  });
  // Fuzzy-search support on key, mirroring brand_library_records_title_trgm_idx (migration
  // 00070)/content_templates_page_type_trgm_idx (migration 00064) — the same
  // `04_Data_Model_and_Ownership.md:241` trigram-index requirement applies equally here.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX system_settings_key_trgm_idx ON system_settings USING gin (key gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("system_settings", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_system_settings_setting_type";');
}
