/**
 * The 10 "primary records" named verbatim in `03_Detailed_Module_Specifications.md §3` — see
 * `docs/task-packages/module-business-knowledge-center.md` D5. No field-level differentiation
 * between record types is stated anywhere in the canonical spec, so all ten share one uniform
 * shape (D2) rather than ten bespoke tables.
 */
export type BusinessKnowledgeRecordType =
  | "company_profile"
  | "persona_icp"
  | "marketing_profile"
  | "vto"
  | "service_taxonomy"
  | "engagement_model"
  | "approved_messaging"
  | "competitor"
  | "geographic_scope"
  | "strategic_priority";

/**
 * Verbatim from `03_Detailed_Module_Specifications.md §3`'s "Rules" text: "documents may be
 * Mandatory, Advisory, Draft, Deprecated, or Restricted." Doubles as both the lifecycle state and
 * the confidentiality classification — see the task package's D3/D4 for why no separate
 * confidentiality field exists.
 */
export type BusinessKnowledgeRecordStatus =
  "mandatory" | "advisory" | "draft" | "deprecated" | "restricted";

export interface BusinessKnowledgeRecordEntity {
  readonly id: string;
  readonly recordType: BusinessKnowledgeRecordType;
  readonly title: string;
  readonly content: string;
  readonly status: BusinessKnowledgeRecordStatus;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
