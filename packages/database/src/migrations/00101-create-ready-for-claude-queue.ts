import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Ready for Claude Queue module foundation (module #30,
 * `docs/implementation/module-ready-for-claude-queue.md`). One single table,
 * `ready_for_claude_tasks` — the operational work queue that hands a defined unit of work to
 * Claude Code for manual execution (`canonical-inputs/Recommended_Module_Roadmap.md` row 30's own
 * "**Critical rule: V1 is manual Claude Code execution.** No Anthropic API automation").
 *
 * Migration numbers start at `00101` per explicit instruction (`00099`/`00100` reserved for other
 * concurrent work).
 *
 * Design decisions this schema encodes (see the implementation doc for the full account):
 *
 * - **D1 — polymorphic record link.** `target_module_key`/`target_id` are the same shape Review
 *   and Approval Center already established for the identical problem (`00065-create-review-and-
 *   approval-center.ts`): `target_module_key` is validated against the REAL module registry at the
 *   service layer via `AuthorizationService.isValidModuleKey()` (never a database FK — the
 *   registry key is a business identifier, not a row id), and `target_id` is deliberately opaque
 *   and UNVALIDATED, since no generic cross-module record-existence lookup exists anywhere in this
 *   codebase. Both are nullable — a task need not be about any specific record.
 * - **D2 — `dependencies` self-references this same table.** Other Ready for Claude tasks that
 *   must complete before this one. Each id is existence-validated at the service layer against
 *   `ready_for_claude_tasks` itself (a cheap same-table lookup, unlike a cross-module array where
 *   no target table exists yet) — deliberately NOT a real FK constraint, since Postgres cannot
 *   express a per-element foreign key on an array column, and modelling it as a join table would
 *   add a sub-resource this module's own field list (`03_Detailed_Module_Specifications.md §30`)
 *   never names. `NOT NULL DEFAULT '{}'` so "no dependencies" is always the empty array, never
 *   `null` — mirrors `personas.related_service_ids`'s own identical contract.
 * - **D3 — `agent`/`agent_version` stay plain, unvalidated text.** They reference the dashboard's
 *   15 planned business AI agents (Agent Directory, module #26; Agent Specification Library,
 *   module #27 — ADR-0019), neither of which is built yet. Matches this codebase's repeated
 *   precedent for a field naming a not-yet-built module's records (Service Library's `icp_ids`,
 *   Website Strategy Center's own relationship fields, `internal_links.related_strategy_record_id`).
 * - **D4 — a genuinely bespoke 11-state workflow**, not the generic 8-value
 *   `ArtifactApprovalStatus` every content-library module reuses —
 *   `05_Workflow_State_Machines.md §4`'s own diagram is a distinct shape. The single source of
 *   truth for the legal edges (and the RBAC action each edge requires) is
 *   `ReadyForClaudeTasksService`'s own `TRANSITIONS` table, the same discipline Internal Linking
 *   Library's own bespoke 4-state workflow already established. `completed`/`cancelled`/`failed`
 *   are terminal — no outbound transition, and a plain content edit is rejected too.
 * - **D5 — `project_id` is OPTIONAL**, unlike Page Inventory/Keyword & Entity Library/Internal
 *   Linking Library (whose primary record IS project work). A Ready for Claude task can be
 *   organization-wide (an infrastructure task) or tied to one project. `onDelete: "RESTRICT"`
 *   mirrors every sibling `project_id` column — the Projects module's own rule 7 ("No cascading
 *   deletion from `projects` into any website/business-record table") applies here regardless of
 *   the column being nullable. RBAC stays organization-wide, matching Review and Approval
 *   Center's own precedent for a cross-cutting engine.
 * - **D6 — no confidentiality mechanism.** `module_registry.confidentiality_level` for
 *   `ready_for_claude_queue` is `null`, matching every module built without one.
 * - **D7 — `pr_url`/`staging_url` are TEXT columns** validated at the DTO layer with the shared
 *   `safeHttpUrlSchema` (`@webdesk/validation`), closing the stored-XSS class this codebase
 *   already fixed once (Projects' `environment.url`).
 *
 * The user-referencing columns (`operator_user_id`, `developer_user_id`, `reviewer_user_id`,
 * `production_approver_user_id`, `created_by`, `updated_by`) are all nullable, existence-validated
 * FKs into `users` with `onDelete: "SET NULL"` — a disabled/removed user must never block writes
 * to a task, the same choice `internal_links.assigned_approver_user_id` and every
 * `created_by`/`updated_by` column in this codebase already make.
 *
 * `changes_requested_notes` is deliberately NOT named `changes_requested` — that string is a real
 * value of the `status` enum, and a column sharing the name would make every read of either one
 * ambiguous.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("ready_for_claude_tasks", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** Stable, human-readable identifier — never regenerated once assigned, same global (not
     *  per-project) uniqueness contract as `internal_links.public_id`/`pages.public_id`. */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    /** Plain, unsanitized text for this backend-only pass (D8) — no `RichTextEditor` wiring is
     *  needed until a `dashboard-web` UI exists to author it, matching Website Strategy Center's/
     *  Service Library's own original backend-only builds. */
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Ordinal, four-valued — `03_Detailed_Module_Specifications.md §30` names "priority" as a
     *  field; `critical` is included (unlike `internal_links.priority`'s three values) because an
     *  execution queue genuinely distinguishes "do this next" from "stop everything". */
    priority: {
      type: DataTypes.ENUM("low", "medium", "high", "critical"),
      allowNull: false,
      defaultValue: "medium",
    },
    /** D3 — plain, unvalidated text. Neither Agent Directory (#26) nor Agent Specification
     *  Library (#27) exists yet to validate against. */
    agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    agent_version: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    /** D5 — OPTIONAL, unlike every prior project-scoped module. Existence-validated at the
     *  service layer via `ProjectService.findById()` when provided, so a bad id surfaces as a
     *  clean 404 rather than a raw FK-violation 500. */
    project_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "projects", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** D1 — validated against the real module registry at the service layer via
     *  `AuthorizationService.isValidModuleKey()`. Not an FK: `module_registry.key` is a business
     *  identifier column, and Review and Approval Center's own `target_module_key` already
     *  established this exact shape. */
    target_module_key: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    /** D1 — deliberately opaque and UNVALIDATED. No generic cross-module record-existence lookup
     *  capability exists anywhere in this codebase. */
    target_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    /** D4 — a genuinely bespoke 11-state lifecycle (`05_Workflow_State_Machines.md §4`), NOT the
     *  8-value generic artifact lifecycle. `ReadyForClaudeTasksService`'s own `TRANSITIONS` table
     *  is the single source of truth for the legal edges and the RBAC action each one requires.
     *  `completed`/`cancelled`/`failed` are terminal. */
    status: {
      type: DataTypes.ENUM(
        "draft",
        "ready_for_claude",
        "claimed",
        "in_progress",
        "awaiting_review",
        "changes_requested",
        "approved",
        "completed",
        "cancelled",
        "paused",
        "failed",
      ),
      allowNull: false,
      defaultValue: "draft",
    },
    /** Free text — a human-readable "where in the pipeline is this right now" label, distinct
     *  from the machine-enforced `status`. No canonical value list exists in the sources. */
    stage: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** D2 — other tasks in THIS table that must complete first. Each element is existence-
     *  validated at the service layer against `ready_for_claude_tasks` itself. `NOT NULL DEFAULT
     *  '{}'` so "no dependencies" is always `[]`, never `null` (mirrors
     *  `personas.related_service_ids`). Typed `uuid[]` (not `varchar[]`) because, unlike Persona
     *  Library's unvalidated identifier lists, these ARE real ids of real rows in a real table
     *  that already exists. */
    dependencies: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    operator_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    developer_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    feature_branch: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    source_commit: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    pr_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    /** D7 — validated with the shared `safeHttpUrlSchema` (`@webdesk/validation`) at the DTO
     *  layer, so only `http:`/`https:` ever reaches storage. */
    pr_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pr_status: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    reviewer_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    code_review_result: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    staging_commit: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    staging_deployment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** D7 — same `safeHttpUrlSchema` validation as `pr_url`. */
    staging_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dashboard_review: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Named to avoid colliding with the `changes_requested` STATUS value — see this migration's
     *  own doc comment above. */
    changes_requested_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    production_approval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    production_approver_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    production_commit: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    production_deployment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    production_verification: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rollback_version: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    audit_reference: {
      type: DataTypes.STRING(255),
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

  await context.addIndex("ready_for_claude_tasks", ["public_id"], {
    name: "ready_for_claude_tasks_public_id_unique",
    unique: true,
  });
  // Composite, leading with the single most common list filter (`status` — "what's in the queue
  // right now?"), then the real ordering key. `id` is the tiebreaker so two paginated queries
  // can't interleave rows that tie on `updated_at`, matching every sibling module's own list()
  // ordering contract.
  await context.addIndex("ready_for_claude_tasks", ["status", "updated_at", "id"], {
    name: "ready_for_claude_tasks_status_updated_at_id_idx",
  });
  // Unlike every sibling module's project_id index, this one is a bare single-column index rather
  // than a composite leading with project_id — here `project_id` is an OPTIONAL filter (D5), not
  // a mandatory route-derived scope, so it is never guaranteed present in a query's WHERE clause.
  await context.addIndex("ready_for_claude_tasks", ["project_id"], {
    name: "ready_for_claude_tasks_project_id_idx",
  });
  // The polymorphic record link (D1) — a composite, since "which tasks are about THIS record"
  // always supplies both halves, and target_module_key alone is also a real, independently
  // usable list filter that this same index's leading column serves.
  await context.addIndex("ready_for_claude_tasks", ["target_module_key", "target_id"], {
    name: "ready_for_claude_tasks_target_module_key_target_id_idx",
  });
  // Fuzzy-search support on the task title, same pattern as internal_links_anchor_trgm_idx /
  // personas_name_trgm_idx (per 04_Data_Model_and_Ownership.md:241's trigram-index requirement).
  // `description` deliberately gets no trigram index — a TEXT column far less likely to be a
  // search filter, matching this codebase's own restraint about not indexing every text column.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX ready_for_claude_tasks_title_trgm_idx ON ready_for_claude_tasks USING gin (title gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("ready_for_claude_tasks", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_ready_for_claude_tasks_priority";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_ready_for_claude_tasks_status";');
}
