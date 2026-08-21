/**
 * The Service Library module foundation (`docs/task-packages/module-service-library.md`) —
 * persistence-layer shapes for `service_categories`, `services`, `deliverables`,
 * `platforms_technologies`, `engagement_models`, `service_deliverables`, `service_platforms`,
 * `service_engagement_models` (migration `00050`). Organization-wide, not project-scoped (D4) —
 * these describe WebDesk Solution's own service offering, not something that varies per client
 * project.
 */

export type ServiceConfidentiality = "public" | "internal" | "restricted";
export type ServicePublicationStatus = "draft" | "published" | "unpublished";
export type ServiceApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

export interface ServiceCategoryEntity {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly parentCategoryId: string | null;
  readonly publicDescription: string | null;
  readonly internalDescription: string | null;
  readonly sortOrder: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The primary entity. `icpIds`/`relatedPageIds`/`relatedCaseStudyIds` are unvalidated identifier
 *  lists, not foreign keys — `persona_library`/`page_inventory`/`case_study_library` don't exist
 *  yet (task package D1). */
export interface ServiceEntity {
  readonly id: string;
  readonly publicId: string;
  readonly canonicalName: string;
  readonly publicName: string | null;
  readonly categoryId: string;
  readonly parentServiceId: string | null;
  readonly shortPublicDescription: string | null;
  readonly audience: string | null;
  readonly problems: string | null;
  readonly capabilities: string | null;
  readonly outcomes: string | null;
  readonly exclusions: string | null;
  readonly internalDescription: string | null;
  readonly icpIds: readonly string[];
  readonly relatedPageIds: readonly string[];
  readonly relatedCaseStudyIds: readonly string[];
  readonly confidentiality: ServiceConfidentiality;
  readonly publicationStatus: ServicePublicationStatus;
  readonly approvalStatus: ServiceApprovalStatus;
  readonly ownerUserId: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DeliverableEntity {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlatformTechnologyEntity {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly platformType: string | null;
  readonly certifiedPartnership: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EngagementModelEntity {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly preferred: boolean;
  readonly approvalRequired: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceDeliverableEntity {
  readonly id: string;
  readonly serviceId: string;
  readonly deliverableId: string;
  readonly createdAt: string;
}

export interface ServicePlatformEntity {
  readonly id: string;
  readonly serviceId: string;
  readonly platformId: string;
  readonly createdAt: string;
}

export interface ServiceEngagementModelEntity {
  readonly id: string;
  readonly serviceId: string;
  readonly engagementModelId: string;
  readonly createdAt: string;
}
