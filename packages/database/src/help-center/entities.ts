/**
 * The 16 topics named verbatim in `03_Detailed_Module_Specifications.md §38`. No field-level
 * differentiation between topics is stated anywhere in the canonical spec, so all sixteen share
 * one uniform shape (mirrors Business Knowledge Center's own 10-record-type precedent).
 */
export type HelpArticleCategory =
  | "onboarding"
  | "project_setup"
  | "wordpress_publishing"
  | "review_approval"
  | "staging_to_production"
  | "import_export"
  | "search_filtering"
  | "design_libraries"
  | "page_workspace"
  | "security_qa"
  | "backup_rollback"
  | "faq"
  | "videos"
  | "known_issues"
  | "feedback"
  | "version_history";

export interface HelpArticleEntity {
  readonly id: string;
  readonly category: HelpArticleCategory;
  readonly title: string;
  readonly content: string;
  readonly isPublished: boolean;
  /** Server-stamped only, on the first transition to `isPublished = true` — never accepted as
   *  caller input, never overwritten once first set, never cleared on unpublish. */
  readonly publishedAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
