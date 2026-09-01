import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Case Study Library — module #24 on the Recommended Module Roadmap
 * (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §8`,
 * `04_Data_Model_and_Ownership.md:138-140`). Depends on Case Study Studio (module #23, already
 * live — migration `00091`), which is named as the module registry's own seeded dependency
 * (`00035-populate-module-registry-fields.ts`).
 *
 * D1 — an EXTENSION table, not a duplicate/copy of Case Study Studio's own fields. One
 * `case_study_library_records` row extends exactly one `case_studies` row (a real DB-level FK,
 * enforced unique via `case_study_library_records_case_study_id_unique` — one library record per
 * case study). It stores ONLY the fields Case Study Studio's own schema does not already have:
 * related pages, technologies, and testimonials. Reading a library record's status/visibility/
 * client/title/etc. means joining in the parent `case_studies` row at the service layer
 * (`CaseStudyLibraryService`) — this table never duplicates/copies any of the parent's own
 * columns.
 *
 * D2 — `related_page_ids` is existence-validated at the app layer against the real, already-live
 * Page Inventory `pages` table (org-wide, via a new `PagesService.existingPageIds()`), NOT a DB-
 * level FK — matches every other cross-module unvalidated-array-but-app-validated precedent in
 * this codebase (e.g. `case_studies.related_service_ids`), since a case study can legitimately
 * reference a page that lives in any project.
 *
 * D3 — `technologies` is a plain, unvalidated string array (no dedicated "technologies" module
 * exists anywhere in this codebase), mirroring Service Library's own `icp_ids` precedent.
 *
 * D4 — `testimonials` is a JSONB array of `{quote, author, role}` objects — short, structured
 * plain-text fields (author/role are person names/titles, not long-form content), validated for
 * shape/length at the Zod DTO layer only, NOT rich-text/HTML. No sanitization mechanism is wired
 * for this column, distinct from every rich-text-converted field elsewhere in this codebase.
 *
 * D5 — a library record may only be CREATED once the parent case study's own `status` is one of
 * `published`, `unpublished`, or `archived` — matching the canonical spec's own framing of this
 * module as "published and unpublished case study records." Enforced at the service layer
 * (`CaseStudyLibraryService.create()`), not the schema, since `case_studies.status` lives in a
 * different table this migration cannot `CHECK` against.
 *
 * D6 — no confidentiality/redaction mechanism: mirrors Case Study Studio's own D9 precedent
 * exactly (`00091-create-case-study-studio.ts`) — the module registry's own seeded
 * `confidentiality_level` text for `case_study_library` ("record-level
 * (Public/Internal Only/Confidential/Client Approval Required)") describes the joined parent's
 * own `visibility` workflow vocabulary, not a new per-field redaction axis this module
 * introduces or enforces on read.
 *
 * Organization-wide, not project-scoped — no `project_id` column, matching Case Study Studio's
 * own precedent.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("case_study_library_records", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    /** Stable, human-readable identifier — never regenerated once assigned. */
    public_id: { type: DataTypes.STRING(64), allowNull: false },
    /** The parent case study — a real DB-level FK (unlike every unvalidated-array cross-module
     *  relationship elsewhere in this codebase), since this table and `case_studies` are
     *  genuinely coupled 1:1 by design (D1), not a loose, independently-evolving relationship.
     *  `RESTRICT` on delete — this codebase has no hard-delete route for `case_studies` anyway,
     *  but a restrict is the honest statement of intent regardless. */
    case_study_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "case_studies", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    /** Existence-validated against the real `pages` table (D2), org-wide (no project filter). */
    related_page_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Plain, unvalidated (D3). */
    technologies: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    /** Array of `{quote, author, role}` objects — shape/length validated at the Zod DTO layer only
     *  (D4). Plain structured text, not HTML — no sanitization mechanism wired. */
    testimonials: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
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
  await context.addIndex("case_study_library_records", ["public_id"], {
    name: "case_study_library_records_public_id_unique",
    unique: true,
  });
  await context.addIndex("case_study_library_records", ["case_study_id"], {
    name: "case_study_library_records_case_study_id_unique",
    unique: true,
  });
  await context.addIndex("case_study_library_records", ["updated_at"], {
    name: "case_study_library_records_updated_at_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("case_study_library_records", {});
}
