/**
 * The approved 43-module key manifest — the ONLY source
 * `scripts/validate-module-registry.ts` diffs the live `module_registry`
 * table against for additions/removals (Phase 1F brief §26: "no
 * unauthorized 44th module is silently added, no approved module
 * disappears"). Sourced from
 * `webdesk-dashboard-documentation-v1/02_Version_1_Module_Inclusion_Matrix.md`,
 * the same 43 keys as migration `00015-seed-module-registry.ts`'s own
 * `REGISTRY` array. Editing this file is itself the explicit, reviewable
 * act of approving a registry change — not something a later phase's
 * code should touch casually. Per brief §26's own instruction, this is
 * NOT enforced as a permanent "always exactly 43" rule at the type level —
 * it is tied to this versioned, git-reviewable list, which a later
 * approved specification change would update deliberately.
 */
export const EXPECTED_MODULE_REGISTRY_SPECIFICATION_VERSION =
  "02_Version_1_Module_Inclusion_Matrix.md (Phase 1F baseline, 2026-08-13)";

export const EXPECTED_MODULE_REGISTRY_KEYS: readonly string[] = [
  "home",
  "projects",
  "business_knowledge_center",
  "website_strategy_center",
  "page_inventory",
  "page_workspace",
  "case_study_studio",
  "case_study_library",
  "portfolio_library",
  "brand_library",
  "design_reference_library",
  "asset_library",
  "design_token_library",
  "component_library",
  "section_and_pattern_library",
  "page_template_library",
  "wireframe_library",
  "motion_and_interaction_library",
  "design_review_center",
  "service_library",
  "persona_library",
  "proof_and_claims_library",
  "keyword_and_entity_library",
  "internal_linking_library",
  "content_template_library",
  "agent_directory",
  "agent_specification_library",
  "knowledge_library",
  "workflow_and_task_template_library",
  "ready_for_claude_queue",
  "review_and_approval_center",
  "scan_center",
  "change_center",
  "import_and_export_center",
  "technical_center",
  "release_center",
  "decision_and_activity_log",
  "help_center",
  "notification_center",
  "users_roles_permissions",
  "integrations",
  "system_settings",
  "audit_logs_and_system_health",
];
