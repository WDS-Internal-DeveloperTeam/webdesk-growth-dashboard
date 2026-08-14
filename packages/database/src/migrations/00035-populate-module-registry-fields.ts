import type { QueryInterface } from "sequelize";

/**
 * Populates the fields added by migration 00034 for all 43 existing
 * `module_registry` rows (matched by their already-seeded `key`, migration
 * 00015 — no new rows are created here).
 *
 * Sources: `webdesk-dashboard-documentation-v1/01_Dashboard_Master_Specification.md`,
 * `02_Version_1_Module_Inclusion_Matrix.md`, `03_Detailed_Module_Specifications.md`.
 * See `docs/implementation/phase-1f-module-registry.md` for the full source
 * citation per field and the honesty notes below.
 *
 * Deliberate, honest defaults (brief §6/§13's own caution against
 * overclaiming):
 * - `implementation_status`: "not_started" for all 43 — no module's real
 *   business functionality exists yet; Phase 1F builds shell/registry only.
 * - `feature_status`: "Not Started" for all 43, matching brief §13's exact
 *   placeholder vocabulary — a friendlier phrasing of the same true fact,
 *   not a different claim.
 * - `v1_inclusion_status`: "included" for all 43 — none of the 43 approved
 *   modules are marked Deferred/Future in the Module Inclusion Matrix
 *   (some are "Simplified V1" or "Foundation Only" in scope, which is a
 *   P1/P2 priority distinction, not an inclusion-status distinction).
 * - `documentation_reference`: the whole spec file path (a genuinely
 *   resolvable reference) rather than a per-module anchor the source
 *   document doesn't actually define — avoids a reference that looks
 *   specific but doesn't resolve (brief §26: "Documentation reference
 *   resolves").
 * - `help_document_reference`, `owner`: left null/"TBD" — no per-module
 *   help content or steward is documented anywhere in the approved specs
 *   (confirmed by direct search); shown honestly as unavailable rather
 *   than invented (brief §35).
 * - `view_permission_action`: plain `"view"` for all 43 — NOT a per-module
 *   `${key}_view` string. The already-seeded 458-grant RBAC matrix
 *   (migration 00013) grants a single `"view"` action per PERMISSION
 *   GROUP (the 21-row `modules` table), shared by every product module
 *   under that group — exactly brief §3's "multiple UI modules may map to
 *   the same permission group." A per-module `${key}_view` action string
 *   would match nothing in the real seeded grants, silently leaving
 *   navigation empty for every role until 43 new zero-seeded actions were
 *   separately authorized and granted — which this migration does not do
 *   (brief §27: "no module may invent authorization outside the central
 *   catalog without approved migration/change"). `retention_view`/
 *   `contacts_view`/`system_health_view` are a different, narrower case:
 *   real Phase 1E sub-resources that needed finer granularity than their
 *   shared `system_settings` group's own `view` grant, added as their own
 *   explicit, reviewed migrations — not a precedent for inventing one
 *   action per product module here.
 *
 * Navigation grouping/order into the 10 approved wireframe nav labels
 * (`07_Low_Fidelity_Wireframes.md` §1: Home, Projects, Pages, Libraries,
 * Workflow, Scans, Technical, Releases, Help, Settings) is this
 * implementer's own reasoned assignment — no document states a per-module
 * nav-group assignment — flagged here as such, same discipline as the
 * existing 43→21 permission-group mapping in migration 00015's own doc
 * comment.
 */

interface RegistryFieldUpdate {
  readonly key: string;
  readonly displayName: string;
  readonly description: string;
  readonly navigationGroup: string;
  readonly navigationOrder: number;
  readonly route: string;
  readonly iconReference: string;
  readonly dependencies: readonly string[] | null;
  readonly confidentialityLevel: string | null;
}

const DOC_REFERENCE = "webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md";

const UPDATES: readonly RegistryFieldUpdate[] = [
  {
    key: "home",
    displayName: "Home",
    description:
      "Executive dashboard summarizing project health, pending approvals, tasks, and blockers. Widgets are permission-filtered; never infers deployment state from the module roadmap.",
    navigationGroup: "home",
    navigationOrder: 1,
    route: "/home",
    iconReference: "home",
    dependencies: [
      "page_inventory",
      "ready_for_claude_queue",
      "review_and_approval_center",
      "scan_center",
      "release_center",
      "notification_center",
      "audit_logs_and_system_health",
    ],
    confidentialityLevel: null,
  },
  {
    key: "projects",
    displayName: "Projects",
    description:
      "Project configuration: objectives, phases, roadmap, team, environments, and repositories. Release authority and confidential-field access must be explicitly granted.",
    navigationGroup: "projects",
    navigationOrder: 1,
    route: "/projects",
    iconReference: "briefcase",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "business_knowledge_center",
    displayName: "Business Knowledge Center",
    description:
      "Company profile, persona/ICP summary, marketing profile, VTO, service taxonomy, engagement models, messaging, competitors, geographic scope, and strategic priorities.",
    navigationGroup: "libraries",
    navigationOrder: 1,
    route: "/business-knowledge-center",
    iconReference: "book-open",
    dependencies: null,
    confidentialityLevel:
      "record-level (Mandatory/Advisory/Draft/Deprecated/Restricted per record)",
  },
  {
    key: "website_strategy_center",
    displayName: "Website Strategy Center",
    description:
      "Navigation plan, page clusters, pillar/platform/industry/location strategy, conversion/search/internal-link plans, with compare/approve/supersede workflow.",
    navigationGroup: "libraries",
    navigationOrder: 2,
    route: "/website-strategy-center",
    iconReference: "map",
    dependencies: ["page_inventory", "internal_linking_library"],
    confidentialityLevel: null,
  },
  {
    key: "page_inventory",
    displayName: "Page Inventory",
    description:
      "Canonical page registry: page identity, URL, WordPress IDs, type, index status, template, phase, stage, target keyword, canonical URL, design version, and repo files.",
    navigationGroup: "pages",
    navigationOrder: 1,
    route: "/page-inventory",
    iconReference: "layout-list",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "page_workspace",
    displayName: "Page Workspace",
    description:
      "Per-page end-to-end workflow across Overview through History tabs, with versioned artifacts. Approval applies to the exact version; reopening creates a new version.",
    navigationGroup: "pages",
    navigationOrder: 2,
    route: "/page-workspace",
    iconReference: "file-text",
    dependencies: ["page_inventory"],
    confidentialityLevel: null,
  },
  {
    key: "case_study_studio",
    displayName: "Case Study Studio",
    description:
      "Intake-to-publish authoring flow with mandatory consent, claim-source linkage, metric verification, asset licence, and embargo/scheduled publishing.",
    navigationGroup: "libraries",
    navigationOrder: 3,
    route: "/case-study-studio",
    iconReference: "file-check",
    dependencies: ["proof_and_claims_library", "asset_library"],
    confidentialityLevel: null,
  },
  {
    key: "case_study_library",
    displayName: "Case Study Library",
    description:
      "Published and unpublished case study records, with relationships to services, pages, technologies, industries, claims, assets, and testimonials.",
    navigationGroup: "libraries",
    navigationOrder: 4,
    route: "/case-study-library",
    iconReference: "library",
    dependencies: ["case_study_studio"],
    confidentialityLevel:
      "record-level (Public/Internal Only/Confidential/Client Approval Required)",
  },
  {
    key: "portfolio_library",
    displayName: "Portfolio Library",
    description:
      "Project/client portfolio records: URL, categories, tags, industry, platform, service type, launch date, screenshots, proof, and publication status.",
    navigationGroup: "libraries",
    navigationOrder: 5,
    route: "/portfolio-library",
    iconReference: "gallery-vertical",
    dependencies: null,
    confidentialityLevel: "record-level (has a visibility field; level unspecified)",
  },
  {
    key: "brand_library",
    displayName: "Brand Library",
    description:
      "Logos, colors, typography, photography, illustration, and icon rules with tone, dos/don'ts, deprecated assets, and per-asset status/version/approval.",
    navigationGroup: "libraries",
    navigationOrder: 6,
    route: "/brand-library",
    iconReference: "palette",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "design_reference_library",
    displayName: "Design Reference Library",
    description:
      "Source URL, screenshot, page/section type, likes/dislikes, desktop/mobile behavior, motion/accessibility/performance notes, tags, and approval status.",
    navigationGroup: "libraries",
    navigationOrder: 7,
    route: "/design-reference-library",
    iconReference: "image",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "asset_library",
    displayName: "Asset Library",
    description:
      "Asset identity, file reference, MIME type, size, checksum, dimensions, licence, consent, alt-text guidance, visibility, retention, and scan status.",
    navigationGroup: "libraries",
    navigationOrder: 8,
    route: "/asset-library",
    iconReference: "folder-open",
    dependencies: null,
    confidentialityLevel:
      "record-level; files may show 'Scan Not Configured' — never claimed malware-free",
  },
  {
    key: "design_token_library",
    displayName: "Design Token Library",
    description:
      "Colors, semantic status colors, light/dark themes, typography, spacing, grids, breakpoints, borders, shadows, motion, and focus/form/interactive states.",
    navigationGroup: "libraries",
    navigationOrder: 9,
    route: "/design-token-library",
    iconReference: "swatch-book",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "component_library",
    displayName: "Component Library",
    description:
      "Navigation, heroes, buttons, cards, forms, proof bars, accordions, testimonials, CTAs, and tables, with Figma reference, token bindings, markup, states, a11y notes, and tests.",
    navigationGroup: "libraries",
    navigationOrder: 10,
    route: "/component-library",
    iconReference: "component",
    dependencies: ["design_token_library"],
    confidentialityLevel: null,
  },
  {
    key: "section_and_pattern_library",
    displayName: "Section and Pattern Library",
    description:
      "Homepage storytelling, service, industry, location, landing conversion, portfolio showcase, social proof, trust, and objection-handling patterns.",
    navigationGroup: "libraries",
    navigationOrder: 11,
    route: "/section-and-pattern-library",
    iconReference: "layout-grid",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "page_template_library",
    displayName: "Page Template Library",
    description:
      "Homepage, service, platform, industry, location, case-study, portfolio, landing, and article templates with required/optional sections and content requirements.",
    navigationGroup: "libraries",
    navigationOrder: 12,
    route: "/page-template-library",
    iconReference: "layout-template",
    dependencies: ["section_and_pattern_library", "component_library", "wireframe_library"],
    confidentialityLevel: null,
  },
  {
    key: "wireframe_library",
    displayName: "Wireframe Library",
    description:
      "Page/module wireframes with viewport, version, source file, annotations, interaction notes, related template, status, reviewer, and approval.",
    navigationGroup: "libraries",
    navigationOrder: 13,
    route: "/wireframe-library",
    iconReference: "layout-panel-left",
    dependencies: ["page_template_library"],
    confidentialityLevel: null,
  },
  {
    key: "motion_and_interaction_library",
    displayName: "Motion and Interaction Library",
    description:
      "Page transitions, states, form feedback, menus, modals, loaders, media controls, and screen-reader announcement specs.",
    navigationGroup: "libraries",
    navigationOrder: 14,
    route: "/motion-and-interaction-library",
    iconReference: "play",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "design_review_center",
    displayName: "Design Review Center",
    description:
      "Creative direction, UX, conversion, UI, accessibility-by-design, responsive, component-consistency, motion, and performance-impact review workflow.",
    navigationGroup: "libraries",
    navigationOrder: 15,
    route: "/design-review-center",
    iconReference: "check-circle",
    dependencies: [
      "component_library",
      "design_token_library",
      "section_and_pattern_library",
      "page_template_library",
      "wireframe_library",
      "motion_and_interaction_library",
    ],
    confidentialityLevel: null,
  },
  {
    key: "service_library",
    displayName: "Service Library",
    description:
      "Public, internal, and restricted-commercial views of services: canonical/public name, category, audience, capabilities, outcomes, exclusions, ICPs, and related pages.",
    navigationGroup: "libraries",
    navigationOrder: 16,
    route: "/service-library",
    iconReference: "list-checks",
    dependencies: ["persona_library", "case_study_library", "page_inventory"],
    confidentialityLevel:
      "pricing/commercial fields excluded by default; restricted owner-only if added",
  },
  {
    key: "persona_library",
    displayName: "Persona Library",
    description:
      "Buyer persona records: type, company size, roles, industries, geography, goals, pains, triggers, objections, decision criteria, and messaging preferences.",
    navigationGroup: "libraries",
    navigationOrder: 17,
    route: "/persona-library",
    iconReference: "users",
    dependencies: ["service_library"],
    confidentialityLevel: null,
  },
  {
    key: "proof_and_claims_library",
    displayName: "Proof and Claims Library",
    description:
      "Claims with type, source, verification, approved wording, restrictions, and expiry/review date. Public content cannot use an unverified claim.",
    navigationGroup: "libraries",
    navigationOrder: 18,
    route: "/proof-and-claims-library",
    iconReference: "shield-check",
    dependencies: ["case_study_studio", "service_library"],
    confidentialityLevel: null,
  },
  {
    key: "keyword_and_entity_library",
    displayName: "Keyword and Entity Library",
    description:
      "Keyword/query records with type, intent, funnel stage, geography, metrics, source, entity, service/page assignments, cannibalization notes, and approval status.",
    navigationGroup: "libraries",
    navigationOrder: 19,
    route: "/keyword-and-entity-library",
    iconReference: "search",
    dependencies: ["website_strategy_center", "page_inventory"],
    confidentialityLevel:
      "advisory until Search Strategy + Growth Director review + human approval",
  },
  {
    key: "internal_linking_library",
    displayName: "Internal Linking Library",
    description:
      "Internal link records: source, target, relationship, anchor text, context, link type, priority, status, and implementation/verification dates.",
    navigationGroup: "libraries",
    navigationOrder: 20,
    route: "/internal-linking-library",
    iconReference: "link",
    dependencies: ["page_inventory", "website_strategy_center"],
    confidentialityLevel: null,
  },
  {
    key: "content_template_library",
    displayName: "Content Template Library",
    description:
      "Page-type content templates: required/optional sections, proof rules, SEO/AEO/GEO requirements, schema, CTA rules, and content-depth guidance.",
    navigationGroup: "libraries",
    navigationOrder: 21,
    route: "/content-template-library",
    iconReference: "file-stack",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "agent_directory",
    displayName: "Agent Directory",
    description:
      "Registered agent metadata: mission summary, version, status, permissions, knowledge libraries, outputs, approval gates, and test status. Version 1 has no automatic execution — manual usage only.",
    navigationGroup: "libraries",
    navigationOrder: 22,
    route: "/agent-directory",
    iconReference: "bot",
    dependencies: ["agent_specification_library", "knowledge_library"],
    confidentialityLevel: null,
  },
  {
    key: "agent_specification_library",
    displayName: "Agent Specification Library",
    description:
      "Approved agent specifications, drafts, version comparison, approval status, tests, and dependencies.",
    navigationGroup: "libraries",
    navigationOrder: 23,
    route: "/agent-specification-library",
    iconReference: "file-cog",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "knowledge_library",
    displayName: "Knowledge Library",
    description:
      "Reference sources with type, title, location, owner, date, confidentiality, and an approved-for-agent-use flag.",
    navigationGroup: "libraries",
    navigationOrder: 24,
    route: "/knowledge-library",
    iconReference: "book-marked",
    dependencies: null,
    confidentialityLevel:
      "explicit per-record confidentiality field (enum values not yet specified)",
  },
  {
    key: "workflow_and_task_template_library",
    displayName: "Workflow and Task Template Library",
    description:
      "Existing-page audit, new-page opportunity, search brief, content, case study, design, development, code review, security, QA, and release task templates.",
    navigationGroup: "libraries",
    navigationOrder: 25,
    route: "/workflow-and-task-template-library",
    iconReference: "list-tree",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "ready_for_claude_queue",
    displayName: "Ready for Claude Queue",
    description:
      "Manual execution queue: task/agent/project/record/stage, dependencies, operator, branch, commit, PR, reviewer, deployment verification, rollback, and retries.",
    navigationGroup: "workflow",
    navigationOrder: 1,
    route: "/ready-for-claude-queue",
    iconReference: "list-todo",
    dependencies: ["workflow_and_task_template_library"],
    confidentialityLevel: null,
  },
  {
    key: "review_and_approval_center",
    displayName: "Review and Approval Center",
    description:
      "Assigned reviews with version comparison, comments, and approve/notes/revision/reject/pause/delegate actions where permitted.",
    navigationGroup: "workflow",
    navigationOrder: 2,
    route: "/review-and-approval-center",
    iconReference: "clipboard-check",
    dependencies: [
      "page_workspace",
      "case_study_studio",
      "ready_for_claude_queue",
      "design_review_center",
    ],
    confidentialityLevel: null,
  },
  {
    key: "scan_center",
    displayName: "Scan Center",
    description:
      "Full website, selected page, repository, WordPress health, security, accessibility, performance, link, metadata, and structured-data scans (manual and scheduled). Discovers facts only — never silently overwrites or auto-repairs production.",
    navigationGroup: "scans",
    navigationOrder: 1,
    route: "/scan-center",
    iconReference: "scan-search",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "change_center",
    displayName: "Change Center",
    description:
      "Theme, plugin, core, database, integration, SEO, analytics, security, accessibility, performance, and redirect change records, with accept/reject/merge/defer/apply/verify workflow.",
    navigationGroup: "scans",
    navigationOrder: 2,
    route: "/change-center",
    iconReference: "git-compare",
    dependencies: ["scan_center"],
    confidentialityLevel: null,
  },
  {
    key: "import_and_export_center",
    displayName: "Import and Export Center",
    description:
      "Versioned import/export templates with dry-run preview, row-level errors, duplicate policy, idempotency, file limits, and partial-success/rollback rules.",
    navigationGroup: "technical",
    navigationOrder: 1,
    route: "/import-and-export-center",
    iconReference: "arrow-left-right",
    dependencies: null,
    confidentialityLevel: "export excludes confidential fields unless separately authorized",
  },
  {
    key: "technical_center",
    displayName: "Technical Center",
    description:
      "Coding standards, linting, tests, coverage, dependency/vulnerability, WordPress/PHP compatibility, code review, security, accessibility, and performance reports.",
    navigationGroup: "technical",
    navigationOrder: 2,
    route: "/technical-center",
    iconReference: "wrench",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "release_center",
    displayName: "Release Center",
    description:
      "Staging, production, hotfix, and rollback releases with repositories, commit SHAs, PRs, approvals, deployments, smoke tests, and verification records.",
    navigationGroup: "releases",
    navigationOrder: 1,
    route: "/release-center",
    iconReference: "rocket",
    dependencies: ["ready_for_claude_queue", "technical_center", "review_and_approval_center"],
    confidentialityLevel: null,
  },
  {
    key: "decision_and_activity_log",
    displayName: "Decision and Activity Log",
    description:
      "Business, content, design, staging/production approval, rollback, failed-deployment, backup/restore, code review, PR, scan, import, and security-exception events.",
    navigationGroup: "settings",
    navigationOrder: 1,
    route: "/decision-and-activity-log",
    iconReference: "history",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "help_center",
    displayName: "Help Center",
    description:
      "Onboarding, workflow, and troubleshooting documentation: project setup, publishing, review/approval, import/export, security/QA, backup/rollback, FAQ, and known issues.",
    navigationGroup: "help",
    navigationOrder: 1,
    route: "/help-center",
    iconReference: "life-buoy",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "notification_center",
    displayName: "Notification Center",
    description:
      "In-app and SMTP notification records with delivery status and multi-address distribution lists per operational area.",
    navigationGroup: "settings",
    navigationOrder: 2,
    route: "/notification-center",
    iconReference: "bell",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "users_roles_permissions",
    displayName: "Users, Roles and Permissions",
    description:
      "SSO users, emergency local admins, roles, project/module/action permissions, confidential-field access, release authority, sessions, and MFA status.",
    navigationGroup: "settings",
    navigationOrder: 3,
    route: "/users-roles-and-permissions",
    iconReference: "user-cog",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "integrations",
    displayName: "Integrations",
    description:
      "GitHub, WordPress, Vercel Blob, PostgreSQL, SMTP, Sentry, uptime, and vulnerability-scan integration status. Secret values are never stored here — only metadata and verification status.",
    navigationGroup: "settings",
    navigationOrder: 4,
    route: "/integrations",
    iconReference: "plug",
    dependencies: null,
    confidentialityLevel: "secret values never stored — metadata/verification status only",
  },
  {
    key: "system_settings",
    displayName: "System Settings",
    description:
      "Configurable statuses, categories, taxonomies, file limits, scan schedules, Git rules, backup rules, retention, contacts, escalation SLAs, and environments.",
    navigationGroup: "settings",
    navigationOrder: 5,
    route: "/system-settings",
    iconReference: "settings",
    dependencies: null,
    confidentialityLevel: null,
  },
  {
    key: "audit_logs_and_system_health",
    displayName: "Audit Logs and System Health",
    description:
      "Login events, permission changes, data changes, Git sync, webhook status, jobs/queues/scans, cron, backups, storage, application errors, and security events. Immutable events required for critical actions.",
    navigationGroup: "settings",
    navigationOrder: 6,
    route: "/audit-logs-and-system-health",
    iconReference: "shield-alert",
    dependencies: null,
    confidentialityLevel:
      "immutable events required for critical actions (master spec security section)",
  },
];

export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const now = new Date();

  const keys = await context.sequelize.query("SELECT key FROM module_registry", { type: "SELECT" });
  if ((keys as unknown[]).length !== 43) {
    throw new Error(
      `Expected exactly 43 existing module_registry rows before populating fields, found ${(keys as unknown[]).length}`,
    );
  }
  if (UPDATES.length !== 43) {
    throw new Error(`Expected exactly 43 field-update entries, built ${UPDATES.length}`);
  }

  for (const update of UPDATES) {
    const [, metadata] = await context.sequelize.query(
      `UPDATE module_registry SET
         display_name = :displayName,
         description = :description,
         navigation_group = :navigationGroup,
         navigation_order = :navigationOrder,
         route = :route,
         icon_reference = :iconReference,
         v1_inclusion_status = 'included',
         implementation_status = 'not_started',
         view_permission_action = :viewPermissionAction,
         feature_status = 'Not Started',
         documentation_reference = :documentationReference,
         owner = 'TBD',
         dependencies = :dependencies,
         confidentiality_level = :confidentialityLevel,
         badge_support = true,
         registry_version = 1,
         last_reviewed_at = :now
       WHERE key = :key`,
      {
        replacements: {
          key: update.key,
          displayName: update.displayName,
          description: update.description,
          navigationGroup: update.navigationGroup,
          navigationOrder: update.navigationOrder,
          route: update.route,
          iconReference: update.iconReference,
          viewPermissionAction: "view",
          documentationReference: DOC_REFERENCE,
          dependencies: update.dependencies ? JSON.stringify(update.dependencies) : null,
          confidentialityLevel: update.confidentialityLevel,
          now,
        },
      },
    );
    const affectedRows = (metadata as { rowCount: number }).rowCount;
    if (affectedRows !== 1) {
      throw new Error(
        `Expected to update exactly 1 row for module_registry key "${update.key}", updated ${affectedRows}`,
      );
    }
  }

  // Real, distinct routes now exist on every row — safe to enforce NOT NULL + uniqueness.
  await context.sequelize.query(`ALTER TABLE module_registry ALTER COLUMN route SET NOT NULL;`);
  await context.addIndex("module_registry", ["route"], {
    name: "module_registry_route_idx",
    unique: true,
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // Drop the NOT NULL + unique constraint before resetting every row to the same blank route.
  await context.removeIndex("module_registry", "module_registry_route_idx");
  await context.sequelize.query(`ALTER TABLE module_registry ALTER COLUMN route DROP NOT NULL;`);

  await context.sequelize.query(
    `UPDATE module_registry SET
       display_name = NULL,
       description = NULL,
       navigation_group = 'settings',
       navigation_order = 0,
       route = '',
       icon_reference = NULL,
       v1_inclusion_status = 'included',
       implementation_status = 'not_started',
       view_permission_action = 'view',
       feature_status = NULL,
       documentation_reference = NULL,
       owner = NULL,
       dependencies = NULL,
       confidentiality_level = NULL,
       badge_support = false,
       registry_version = 1,
       last_reviewed_at = NULL`,
  );
}
