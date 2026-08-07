import { randomUUID } from "node:crypto";
import type { QueryInterface } from "sequelize";

/**
 * Seeds the real, already-approved role/module/permission matrix from
 * `06_Roles_and_Permissions.md §3` — not placeholder data (ADR-0010's own
 * "Open setup values" says "None," the role model is fully specified).
 *
 * Letter-code expansion, per §2's action legend: V=view, C=create,
 * E=edit, S=submit, R=review, A=approve, X=export, M=configure.
 * P="Publish/Unpublish" expands to TWO actions (publish, unpublish);
 * L="Release/Rollback" expands to TWO actions (release, rollback).
 *
 * Deliberately NOT encoded here (documented, not silently dropped):
 * - "(assigned)" qualifiers (Review Center, Change Center, Imports) —
 *   object-level scoping ("only records assigned to me"), which is that
 *   future feature's own responsibility to enforce once built, not
 *   something a role×module×action grant can express.
 * - "(subject to fields)" / "if allowed" (Exports) — the confidential-
 *   field axis, a separate action (`view_confidential`/`edit_confidential`)
 *   a future Exports feature would additionally check.
 * - The matrix's "Confidential fields" row is not a module — per
 *   `06_Roles_and_Permissions.md §5`, confidential-field access is
 *   "Configurable"/"Limited by need" even for Super Admin, meaning an
 *   explicit future grant, not a pre-seeded blanket one. No
 *   `view_confidential`/`edit_confidential` rows are seeded for any role.
 */

const ROLES = [
  { key: "super_admin", name: "Super Admin" },
  { key: "owner_growth_approver", name: "Owner / Growth Approver" },
  { key: "marketing_editor", name: "Marketing Editor" },
  { key: "designer_creative_reviewer", name: "Designer / Creative Reviewer" },
  { key: "developer", name: "Developer" },
  { key: "qa_security_reviewer", name: "QA / Security Reviewer" },
  { key: "read_only", name: "Read-Only" },
] as const;

const MODULES = [
  { key: "project_configuration", name: "Project configuration" },
  { key: "business_knowledge", name: "Business Knowledge" },
  { key: "website_strategy", name: "Website Strategy" },
  { key: "page_inventory", name: "Page Inventory" },
  { key: "page_content", name: "Page content" },
  { key: "creative_design", name: "Creative/design" },
  { key: "development_code", name: "Development/code" },
  { key: "security_qa", name: "Security/QA" },
  { key: "case_studies", name: "Case studies" },
  { key: "portfolio", name: "Portfolio" },
  { key: "service_persona_proof", name: "Service/persona/proof" },
  { key: "keyword_internal_links", name: "Keyword/internal links" },
  { key: "ready_for_claude", name: "Ready for Claude" },
  { key: "review_center", name: "Review Center" },
  { key: "scans", name: "Scans" },
  { key: "change_center", name: "Change Center" },
  { key: "imports", name: "Imports" },
  { key: "exports", name: "Exports" },
  { key: "releases", name: "Releases" },
  { key: "users_roles", name: "Users/roles" },
  { key: "system_settings", name: "System settings" },
] as const;

type RoleKey = (typeof ROLES)[number]["key"];
type ModuleKey = (typeof MODULES)[number]["key"];

const LETTER_ACTIONS: Record<string, readonly string[]> = {
  V: ["view"],
  C: ["create"],
  E: ["edit"],
  S: ["submit"],
  R: ["review"],
  A: ["approve"],
  P: ["publish", "unpublish"],
  L: ["release", "rollback"],
  X: ["export"],
  M: ["configure"],
};

function expand(code: string): readonly string[] {
  return code.split("").flatMap((letter) => {
    const actions = LETTER_ACTIONS[letter];
    if (!actions) {
      throw new Error(`Unknown action letter code: ${letter}`);
    }
    return actions;
  });
}

/** `06_Roles_and_Permissions.md §3`'s matrix, transcribed row by row. An absent role key means "No" access for that module. */
const MATRIX: Record<ModuleKey, Partial<Record<RoleKey, string>>> = {
  project_configuration: {
    super_admin: "VCEAM",
    owner_growth_approver: "VEA",
    marketing_editor: "V",
    designer_creative_reviewer: "V",
    developer: "V",
    qa_security_reviewer: "V",
    read_only: "V",
  },
  business_knowledge: {
    super_admin: "VCERAMX",
    owner_growth_approver: "VCERAX",
    marketing_editor: "VCES",
    designer_creative_reviewer: "V",
    developer: "V",
    qa_security_reviewer: "V",
    read_only: "V",
  },
  website_strategy: {
    super_admin: "VCERAMX",
    owner_growth_approver: "VCERAX",
    marketing_editor: "VCESR",
    designer_creative_reviewer: "VCR",
    developer: "V",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  page_inventory: {
    super_admin: "VCERAMX",
    owner_growth_approver: "VCERAX",
    marketing_editor: "VCES",
    designer_creative_reviewer: "V",
    developer: "VCE",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  page_content: {
    super_admin: "VCERAPX",
    owner_growth_approver: "VCERAPX",
    marketing_editor: "VCESR",
    designer_creative_reviewer: "VR",
    developer: "V",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  creative_design: {
    super_admin: "VCERAPX",
    owner_growth_approver: "VERAPX",
    marketing_editor: "VR",
    designer_creative_reviewer: "VCERAS",
    developer: "V",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  development_code: {
    super_admin: "VCERL",
    owner_growth_approver: "VRL",
    marketing_editor: "V",
    designer_creative_reviewer: "V",
    developer: "VCES",
    qa_security_reviewer: "VRA",
    read_only: "V",
  },
  security_qa: {
    super_admin: "VCERAL",
    owner_growth_approver: "VRL",
    marketing_editor: "V",
    designer_creative_reviewer: "V",
    developer: "VR",
    qa_security_reviewer: "VCERAS",
    read_only: "V",
  },
  case_studies: {
    super_admin: "VCERAPX",
    owner_growth_approver: "VCERAPX",
    marketing_editor: "VCESR",
    designer_creative_reviewer: "VR",
    developer: "V",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  portfolio: {
    super_admin: "VCERAPX",
    owner_growth_approver: "VCERAPX",
    marketing_editor: "VCESR",
    designer_creative_reviewer: "VR",
    developer: "V",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  service_persona_proof: {
    super_admin: "VCERAMX",
    owner_growth_approver: "VCERAX",
    marketing_editor: "VCESR",
    designer_creative_reviewer: "V",
    developer: "V",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  keyword_internal_links: {
    super_admin: "VCERAMX",
    owner_growth_approver: "VCERAX",
    marketing_editor: "VCESR",
    designer_creative_reviewer: "V",
    developer: "V",
    qa_security_reviewer: "VR",
    read_only: "V",
  },
  ready_for_claude: {
    super_admin: "VCERAM",
    owner_growth_approver: "VCERAM",
    marketing_editor: "VCSE",
    designer_creative_reviewer: "VCSE",
    developer: "VCSE",
    qa_security_reviewer: "VCSE",
    read_only: "V",
  },
  review_center: {
    super_admin: "VCERA",
    owner_growth_approver: "VCERA",
    marketing_editor: "VRA",
    designer_creative_reviewer: "VRA",
    developer: "VRA",
    qa_security_reviewer: "VRA",
    read_only: "V",
  },
  scans: {
    super_admin: "VCERM",
    owner_growth_approver: "VCR",
    marketing_editor: "VR",
    designer_creative_reviewer: "V",
    developer: "VCER",
    qa_security_reviewer: "VCER",
    read_only: "V",
  },
  change_center: {
    super_admin: "VCERA",
    owner_growth_approver: "VCERA",
    marketing_editor: "VRA",
    designer_creative_reviewer: "VRA",
    developer: "VRA",
    qa_security_reviewer: "VRA",
    read_only: "V",
  },
  imports: {
    super_admin: "VCERAX",
    owner_growth_approver: "VCERAX",
    marketing_editor: "VCSEX",
    designer_creative_reviewer: "VCSEX",
    developer: "VCSEX",
    qa_security_reviewer: "VCSEX",
    read_only: "V",
  },
  exports: {
    super_admin: "VX",
    owner_growth_approver: "VX",
    marketing_editor: "VX",
    designer_creative_reviewer: "VX",
    developer: "VX",
    qa_security_reviewer: "VX",
    read_only: "V",
  },
  releases: {
    super_admin: "VCERAL",
    owner_growth_approver: "VCRAL",
    marketing_editor: "V",
    designer_creative_reviewer: "V",
    developer: "VCESR",
    qa_security_reviewer: "VRA",
    read_only: "V",
  },
  users_roles: {
    super_admin: "VCERM",
    owner_growth_approver: "VM",
  },
  system_settings: {
    super_admin: "VCERM",
    owner_growth_approver: "VM",
  },
};

export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const now = new Date();

  const roleRows = ROLES.map((role) => ({
    id: randomUUID(),
    ...role,
    created_at: now,
    updated_at: now,
  }));
  await context.bulkInsert("roles", roleRows);
  const roleIdByKey = new Map(roleRows.map((row) => [row.key, row.id]));

  const moduleRows = MODULES.map((module) => ({
    id: randomUUID(),
    ...module,
    created_at: now,
    updated_at: now,
  }));
  await context.bulkInsert("modules", moduleRows);
  const moduleIdByKey = new Map(moduleRows.map((row) => [row.key, row.id]));

  const permissionRows: Array<{
    id: string;
    role_id: string;
    module_id: string;
    action: string;
    created_at: Date;
    updated_at: Date;
  }> = [];

  for (const [moduleKey, roleGrants] of Object.entries(MATRIX) as Array<
    [ModuleKey, Partial<Record<RoleKey, string>>]
  >) {
    const moduleId = moduleIdByKey.get(moduleKey);
    if (!moduleId) {
      throw new Error(`Unknown module key in seed matrix: ${moduleKey}`);
    }
    for (const [roleKey, code] of Object.entries(roleGrants) as Array<[RoleKey, string]>) {
      const roleId = roleIdByKey.get(roleKey);
      if (!roleId) {
        throw new Error(`Unknown role key in seed matrix: ${roleKey}`);
      }
      for (const action of expand(code)) {
        permissionRows.push({
          id: randomUUID(),
          role_id: roleId,
          module_id: moduleId,
          action,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  await context.bulkInsert("role_permissions", permissionRows);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // Children first (role_permissions has no children of its own to worry
  // about, but user_roles could reference seeded roles by then — this
  // migration only ever runs in a fresh test database in this phase, so
  // a plain delete-all is safe and simpler than a scoped delete).
  await context.bulkDelete("role_permissions", {});
  await context.bulkDelete("modules", {});
  await context.bulkDelete("roles", {});
}
