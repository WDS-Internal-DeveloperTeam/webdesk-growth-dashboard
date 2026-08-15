/**
 * The Projects module foundation (`docs/task-packages/module-projects-foundation.md`) —
 * persistence-layer shapes for `projects`, `project_environments`, `project_repositories`,
 * `project_users`, `project_objectives`, `roadmap_items` (migrations `00036`-`00043`). Projects
 * are the canonical client-engagement context this dashboard manages — never a customer/account
 * multi-tenancy concept (task package §3's disambiguation note).
 */

export type ProjectStatus = "active" | "paused" | "archived";
export type ProjectConfidentiality = "public" | "internal" | "confidential" | "restricted";
export type RepositoryProvider = "github";
export type ObjectiveStatus = "open" | "complete";
export type RoadmapItemStatus = "not_started" | "active" | "complete" | "skipped";

export interface ProjectEntity {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly activePhaseId: string | null;
  readonly ownerUserId: string | null;
  readonly confidentiality: ProjectConfidentiality;
  readonly retentionCategory: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectEnvironmentEntity {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly url: string | null;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectRepositoryEntity {
  readonly id: string;
  readonly projectId: string;
  readonly provider: RepositoryProvider;
  readonly repoOwner: string;
  readonly repoName: string;
  readonly defaultBranch: string;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The project team roster — grants no authorization by itself (task package D4). */
export interface ProjectUserEntity {
  readonly id: string;
  readonly projectId: string;
  readonly userId: string;
  readonly addedAt: string;
  readonly addedBy: string | null;
}

export interface ProjectObjectiveEntity {
  readonly id: string;
  readonly projectId: string;
  readonly description: string;
  readonly status: ObjectiveStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Represents both "phases" and "roadmap" from the module spec's prose (task package D3). */
export interface RoadmapItemEntity {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly sequence: number;
  readonly status: RoadmapItemStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
