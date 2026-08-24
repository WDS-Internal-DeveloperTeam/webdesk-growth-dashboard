import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Internal Linking Library module foundation (`docs/task-packages/module-internal-linking-library.md`,
 * module #9). One single table, `internal_links` (task package §3, sourced from
 * `04_Data_Model_and_Ownership.md`'s "Business and content libraries" section, which names a
 * single table for this module — unlike Keyword & Entity Library's 4-table split). A link IS the
 * relationship (source page -> target page) with no independent sub-resources of its own
 * (task package D3).
 *
 * `project_id` uses `onDelete: "RESTRICT"`, mirroring `keywords.project_id`'s/`pages.project_id`'s
 * own choice (`00058-create-page-inventory.ts`/`00060-create-keyword-and-entity-library.ts`) — the
 * Projects module's own task package rule 7 ("No cascading deletion from `projects` into any
 * website/business-record table") applies directly here.
 *
 * `source_page_id`/`target_page_id` are also `onDelete: "RESTRICT"` (task package D4) — a link
 * must never be silently orphaned by a page deletion; Page Inventory has no hard-delete anyway
 * (ADR-0016), so this is a belt-and-suspenders consistency choice, not a functional necessity
 * today.
 *
 * `status` is a genuinely bespoke, 4-value workflow (`proposed`/`approved`/`implemented`/
 * `verified`, task package D1) — the first bespoke workflow vocabulary in this codebase; every
 * prior module reuses the identical 8-value generic artifact lifecycle. `implemented_at`/
 * `verified_at` are server-stamped only, by `InternalLinkRepository.updateStatus()`'s own atomic
 * conditional `COALESCE` write (task package D2) — never accepted as caller input, and never
 * overwritten once first set (the field records "when did this first happen", not "when was this
 * state last (re-)entered").
 *
 * `assigned_approver_user_id` (task package D7) is a nullable, existence-validated FK into
 * `users`, `onDelete: "SET NULL"` — mirrors `created_by`/`updated_by`'s own identical choice
 * elsewhere in this codebase (a disabled/removed user should never block writes to a link).
 *
 * `related_strategy_record_id` (task package D8) is a plain, UNVALIDATED uuid-shaped string
 * column — deliberately NOT a real FK into `website_strategy_records`, since Website Strategy
 * Center was already shipped without a validation hook for this exact relationship (its own
 * module doc comment records D8 "fabricates no cross-module relationship fields" specifically
 * because of this cycle) — retrofitting one means editing already-reviewed, already-live code,
 * out of scope for this module's own build.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("internal_links", {
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
    /** Stable, human-readable identifier — never regenerated once assigned, same "unique per row"
     *  (global, not per-project) contract as `pages.public_id`/`keywords.public_id`. */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    /** Existence-and-same-project validated at the service layer (task package D4), via
     *  `PagesService.existsInProject()`. Must not equal `target_page_id` — enforced at the
     *  service layer with a clean 400, not a database constraint (task package D4: no existing
     *  sibling precedent for a same-table self-reference CHECK, and the check needs no
     *  cross-row query). */
    source_page_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "pages", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    target_page_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "pages", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Plain free text — no canonical value list exists anywhere in the sources for this field
     *  (task package D5). */
    relationship: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    anchor: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** A placement/surrounding-context description could reasonably run to a paragraph
     *  (task package D5) — a generously-sized TEXT column, capped at the DTO layer with a Zod
     *  `.max(2000)`. */
    context: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    link_type: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** No numeric or discrete scale is given in the spec, but "priority" is unambiguously ordinal
     *  (task package D6) — matches `keywords.confidence`'s own identical shape for an unsourced-
     *  but-clearly-ordinal field. */
    priority: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: true,
    },
    /** A genuinely bespoke 4-state workflow (task package D1/D2) — NOT the 8-value generic
     *  artifact lifecycle every prior module reuses. `proposed -> approved -> implemented ->
     *  verified`, plus one backward step from each non-initial state
     *  (`InternalLinksService`'s own `TRANSITIONS` table records the exact shape). No archival/
     *  deletion mechanism in this pass (task package D2, flagged as a known, deliberately
     *  out-of-scope gap). */
    status: {
      type: DataTypes.ENUM("proposed", "approved", "implemented", "verified"),
      allowNull: false,
      defaultValue: "proposed",
    },
    detector: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    /** "Who is expected to review this link" (an assignment) — distinct from the actual
     *  audit-trail record of who performed the `approve` action, already captured via
     *  `AuditService` (task package D7). Existence-validated via `UsersService.findById()`,
     *  mirroring `ProjectService.assertOwnerExists()`'s own precedent. */
    assigned_approver_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** Deliberately NOT a real FK (task package D8) — see this migration's own doc comment above
     *  for why. */
    related_strategy_record_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    /** Server-stamped only, by `InternalLinkRepository.updateStatus()`'s own atomic `COALESCE`
     *  write when the target status is `implemented`/`verified` respectively AND the column is
     *  currently null — never accepted as caller input, never overwritten once first set
     *  (task package D2). */
    implemented_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verified_at: {
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

  await context.addIndex("internal_links", ["public_id"], {
    name: "internal_links_public_id_unique",
    unique: true,
  });
  await context.addIndex("internal_links", ["project_id", "updated_at", "id"], {
    name: "internal_links_project_id_updated_at_id_idx",
  });
  // Composite, not bare single-column — every list() call filters on project_id (it's a required,
  // route-derived field, never optional), and sourcePageId/targetPageId are real, client-reachable
  // optional query filters on the same endpoint ("list all links from/to this page, within this
  // project"). A bare source_page_id/target_page_id index would force a cross-project scan
  // filtered by project_id afterward; leading with project_id lets Postgres satisfy both filters
  // from one index.
  await context.addIndex("internal_links", ["project_id", "source_page_id"], {
    name: "internal_links_project_id_source_page_id_idx",
  });
  await context.addIndex("internal_links", ["project_id", "target_page_id"], {
    name: "internal_links_project_id_target_page_id_idx",
  });
  // Fuzzy-search support on anchor text, same pattern as keywords_query_text_trgm_idx/
  // pages_page_name_trgm_idx (per 04_Data_Model_and_Ownership.md:241's trigram-index requirement).
  // `context` deliberately gets no trigram index — a TEXT column less likely to need fuzzy search
  // as a filter, matching this codebase's own restraint about not indexing every text column.
  await context.sequelize.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await context.sequelize.query(
    "CREATE INDEX internal_links_anchor_trgm_idx ON internal_links USING gin (anchor gin_trgm_ops);",
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("internal_links", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_internal_links_priority";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_internal_links_status";');
}
