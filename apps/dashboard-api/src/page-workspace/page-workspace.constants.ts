import type { PageArtifactType } from "@webdesk/database";

/** NestJS DI tokens — kept in one file, same pattern as
 *  ../page-inventory/page-inventory.constants.ts. */
export const PAGE_ARTIFACT_REPOSITORY = Symbol("PAGE_ARTIFACT_REPOSITORY");
export const PAGE_ARTIFACT_VERSION_REPOSITORY = Symbol("PAGE_ARTIFACT_VERSION_REPOSITORY");
export const PAGE_LIFECYCLE_REPOSITORY = Symbol("PAGE_LIFECYCLE_REPOSITORY");

/**
 * The baseline RBAC group for this module, from the module registry's own seeded mapping
 * (`page_workspace` -> `page_content`, migration `00015`). Used for the route-level
 * `@RequirePermission` decorator only — the REAL per-request check is
 * `ARTIFACT_PERMISSION_GROUP` below.
 */
export const PAGE_WORKSPACE_BASE_MODULE_KEY = "page_content";

/**
 * Task package D2 — the single most important authorization decision in this module.
 *
 * The registry maps `page_workspace` to `page_content` alone, but the 15 artifact types span
 * four permission groups, and the real seeded matrix (`00013-seed-rbac-matrix.ts`) makes gating
 * everything on `page_content` functionally wrong:
 *
 * | Role                       | page_content | creative_design | development_code | security_qa |
 * | -------------------------- | ------------ | --------------- | ---------------- | ----------- |
 * | developer                  | V            | V               | VCES             | VR          |
 * | designer_creative_reviewer | VR           | VCERAS          | V                | V           |
 * | qa_security_reviewer       | VR           | V               | VR               | VCERAS      |
 *
 * Gate the whole module on `page_content` and a developer could never edit the Implementation
 * artifact, a designer never the UI Specification, QA never the QA artifact — contradicting what
 * the approved matrix plainly grants them. So each artifact type carries its own group, resolved
 * here and checked dynamically via `AuthorizationService.assertAllowed()` inside the service.
 *
 * This needs NO new RBAC migration: every grant it relies on is already seeded.
 */
export const ARTIFACT_PERMISSION_GROUP: Readonly<Record<PageArtifactType, string>> = {
  overview: "page_content",
  live_snapshot: "page_content",
  audit: "page_content",
  ideal_structure: "page_content",
  search: "page_content",
  content: "page_content",
  creative_direction: "creative_design",
  ux_wireframe: "creative_design",
  ui_specification: "creative_design",
  component_map: "creative_design",
  implementation: "development_code",
  code_review: "development_code",
  deployment: "development_code",
  security: "security_qa",
  qa: "security_qa",
};
