import { randomUUID } from "node:crypto";
import type { QueryInterface } from "sequelize";

/**
 * Seeds the 43 real modules from `02_Version_1_Module_Inclusion_Matrix.md`,
 * each mapped to the `modules` (21-row) permission group that gates it.
 * The mapping is this implementer's own reasoned cross-reference between
 * two approved documents that don't cross-reference each other — not
 * itself drawn verbatim from a single source — and is flagged as such for
 * the required second-role review, per
 * docs/implementation/phase-1d-permission-catalog.md §3. No permission
 * grants are created by this migration; it is a pure lookup table.
 */

const REGISTRY: ReadonlyArray<{ key: string; name: string; permissionGroupKey: string }> = [
  { key: "home", name: "Home", permissionGroupKey: "project_configuration" },
  { key: "projects", name: "Projects", permissionGroupKey: "project_configuration" },
  {
    key: "business_knowledge_center",
    name: "Business Knowledge Center",
    permissionGroupKey: "business_knowledge",
  },
  {
    key: "website_strategy_center",
    name: "Website Strategy Center",
    permissionGroupKey: "website_strategy",
  },
  { key: "page_inventory", name: "Page Inventory", permissionGroupKey: "page_inventory" },
  { key: "page_workspace", name: "Page Workspace", permissionGroupKey: "page_content" },
  { key: "case_study_studio", name: "Case Study Studio", permissionGroupKey: "case_studies" },
  { key: "case_study_library", name: "Case Study Library", permissionGroupKey: "case_studies" },
  { key: "portfolio_library", name: "Portfolio Library", permissionGroupKey: "portfolio" },
  { key: "brand_library", name: "Brand Library", permissionGroupKey: "creative_design" },
  {
    key: "design_reference_library",
    name: "Design Reference Library",
    permissionGroupKey: "creative_design",
  },
  { key: "asset_library", name: "Asset Library", permissionGroupKey: "creative_design" },
  {
    key: "design_token_library",
    name: "Design Token Library",
    permissionGroupKey: "creative_design",
  },
  { key: "component_library", name: "Component Library", permissionGroupKey: "creative_design" },
  {
    key: "section_and_pattern_library",
    name: "Section and Pattern Library",
    permissionGroupKey: "creative_design",
  },
  {
    key: "page_template_library",
    name: "Page Template Library",
    permissionGroupKey: "creative_design",
  },
  { key: "wireframe_library", name: "Wireframe Library", permissionGroupKey: "creative_design" },
  {
    key: "motion_and_interaction_library",
    name: "Motion and Interaction Library",
    permissionGroupKey: "creative_design",
  },
  {
    key: "design_review_center",
    name: "Design Review Center",
    permissionGroupKey: "review_center",
  },
  { key: "service_library", name: "Service Library", permissionGroupKey: "service_persona_proof" },
  { key: "persona_library", name: "Persona Library", permissionGroupKey: "service_persona_proof" },
  {
    key: "proof_and_claims_library",
    name: "Proof and Claims Library",
    permissionGroupKey: "service_persona_proof",
  },
  {
    key: "keyword_and_entity_library",
    name: "Keyword and Entity Library",
    permissionGroupKey: "keyword_internal_links",
  },
  {
    key: "internal_linking_library",
    name: "Internal Linking Library",
    permissionGroupKey: "keyword_internal_links",
  },
  {
    key: "content_template_library",
    name: "Content Template Library",
    permissionGroupKey: "page_content",
  },
  { key: "agent_directory", name: "Agent Directory", permissionGroupKey: "ready_for_claude" },
  {
    key: "agent_specification_library",
    name: "Agent Specification Library",
    permissionGroupKey: "ready_for_claude",
  },
  { key: "knowledge_library", name: "Knowledge Library", permissionGroupKey: "business_knowledge" },
  {
    key: "workflow_and_task_template_library",
    name: "Workflow and Task Template Library",
    permissionGroupKey: "ready_for_claude",
  },
  {
    key: "ready_for_claude_queue",
    name: "Ready for Claude Queue",
    permissionGroupKey: "ready_for_claude",
  },
  {
    key: "review_and_approval_center",
    name: "Review and Approval Center",
    permissionGroupKey: "review_center",
  },
  { key: "scan_center", name: "Scan Center", permissionGroupKey: "scans" },
  { key: "change_center", name: "Change Center", permissionGroupKey: "change_center" },
  // Source module #34 covers both import and export; kept as ONE registry row to match the
  // approved 43-module count exactly. Gated here by "imports" as its primary permission group —
  // export-specific checks (e.g. an actual export button) must reference the "exports" permission
  // group directly (already a distinct row in `modules`), not through this registry entry.
  {
    key: "import_and_export_center",
    name: "Import and Export Center",
    permissionGroupKey: "imports",
  },
  { key: "technical_center", name: "Technical Center", permissionGroupKey: "development_code" },
  { key: "release_center", name: "Release Center", permissionGroupKey: "releases" },
  // Decision/Activity Log and Audit Logs/System Health are both audit-log-subsystem territory
  // (ADR-0017, Task 7) — provisionally gated by system_settings until Task 7 defines their own
  // permission model; not a claim that system_settings is their final, approved gate.
  {
    key: "decision_and_activity_log",
    name: "Decision and Activity Log",
    permissionGroupKey: "system_settings",
  },
  { key: "help_center", name: "Help Center", permissionGroupKey: "system_settings" },
  {
    key: "notification_center",
    name: "Notification Center",
    permissionGroupKey: "system_settings",
  },
  {
    key: "users_roles_permissions",
    name: "Users, Roles and Permissions",
    permissionGroupKey: "users_roles",
  },
  { key: "integrations", name: "Integrations", permissionGroupKey: "system_settings" },
  { key: "system_settings", name: "System Settings", permissionGroupKey: "system_settings" },
  {
    key: "audit_logs_and_system_health",
    name: "Audit Logs and System Health",
    permissionGroupKey: "system_settings",
  },
];

export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const now = new Date();

  const moduleRows = (await context.sequelize.query("SELECT id, key FROM modules", {
    type: "SELECT",
  })) as Array<{ id: string; key: string }>;
  const moduleIdByKey = new Map(moduleRows.map((row) => [row.key, row.id]));

  if (moduleIdByKey.size !== 21) {
    throw new Error(
      `Expected 21 permission-group modules to already be seeded (migration 00013), found ${moduleIdByKey.size}`,
    );
  }

  const rows = REGISTRY.map((entry) => {
    const permissionGroupId = moduleIdByKey.get(entry.permissionGroupKey);
    if (!permissionGroupId) {
      throw new Error(
        `Unknown permission group key in module registry seed: ${entry.permissionGroupKey}`,
      );
    }
    return {
      id: randomUUID(),
      key: entry.key,
      name: entry.name,
      permission_group_id: permissionGroupId,
      created_at: now,
      updated_at: now,
    };
  });

  if (rows.length !== 43) {
    throw new Error(`Expected exactly 43 module registry rows, built ${rows.length}`);
  }

  await context.bulkInsert("module_registry", rows);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.bulkDelete("module_registry", {});
}
