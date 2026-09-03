/**
 * The Release Center module foundation (module `release_center`,
 * `docs/implementation/module-release-center.md`) — persistence-layer shapes for `releases`,
 * `release_artifacts`, `release_approvals`, `deployments`, `smoke_tests`, `rollback_records`
 * (migration `00111`).
 *
 * `releases` is the parent — a real, named 14-status workflow
 * (`05_Workflow_State_Machines.md §10`), governed exclusively via
 * `ReleaseRepository.updateStatus()`'s own atomic compare-and-swap, mirroring
 * `CaseStudyRepository`'s own pattern. The five child tables are all project-scoped (`projectId`
 * denormalized from `releases.projectId`), and `release_approvals`/`deployments`/`smoke_tests` are
 * all append-only (no `update()`/`remove()` method anywhere), matching `CaseStudyApprovalRepository`'s
 * own established convention for an audit-adjacent decision/history log.
 */

export type ReleaseType = "staging" | "production" | "hotfix" | "rollback";

export type ReleaseStatus =
  | "proposed"
  | "checks_running"
  | "checks_failed"
  | "ready_for_staging"
  | "staging_deployed"
  | "staging_verification"
  | "verification_failed"
  | "staging_approved"
  | "production_approval"
  | "production_deployed"
  | "production_verification"
  | "completed"
  | "hotfix_required"
  | "rolled_back";

/**
 * The parent record. `stagingDeployedAt`/`stagingVerifiedAt`/`productionDeployedAt`/
 * `productionVerifiedAt`/`completedAt`/`hotfixRequiredAt`/`rolledBackAt`/`productionApproverUserId`
 * are all server-stamped only, by `ReleaseRepository.updateStatus()`'s own atomic
 * `COALESCE(column, NOW())` write — never accepted as caller input, never overwritten once first
 * set.
 */
export interface ReleaseEntity {
  readonly id: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly releaseType: ReleaseType;
  readonly title: string;
  readonly status: ReleaseStatus;
  readonly notes: string | null;
  readonly hotfixReason: string | null;
  readonly assignedDeveloperUserId: string | null;
  readonly assignedReviewerUserId: string | null;
  readonly productionApproverUserId: string | null;
  readonly stagingDeployedAt: string | null;
  readonly stagingVerifiedAt: string | null;
  readonly productionDeployedAt: string | null;
  readonly productionVerifiedAt: string | null;
  readonly completedAt: string | null;
  readonly hotfixRequiredAt: string | null;
  readonly rolledBackAt: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * "Repositories and SHAs, PRs" — create/list/delete (delete rejected once the parent release is
 * `completed`/`rolled_back`, enforced at the service layer). `prUrl` is validated as a safe
 * http(s) URL at the DTO layer (`safeHttpUrlSchema`), not a DB constraint.
 */
export interface ReleaseArtifactEntity {
  readonly id: string;
  readonly releaseId: string;
  readonly projectId: string;
  readonly repoOwner: string;
  readonly repoName: string;
  readonly commitSha: string;
  readonly prUrl: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ReleaseApprovalStage = "staging" | "production";
export type ReleaseApprovalDecision = "approved" | "rejected" | "hotfix_required";

/**
 * An append-only decision log — auto-inserted inside the same transaction as the parent release's
 * own CAS status write whenever a transition's action is `approve` (D1). Read-only via
 * `GET .../releases/:id/approvals`.
 */
export interface ReleaseApprovalEntity {
  readonly id: string;
  readonly releaseId: string;
  readonly projectId: string;
  readonly approvalStage: ReleaseApprovalStage;
  readonly decision: ReleaseApprovalDecision;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type DeploymentEnvironment = "staging" | "production";
export type DeploymentOutcome = "succeeded" | "failed";

/**
 * An append-only history of every deploy attempt — real re-deploys are possible even after
 * `releases.stagingDeployedAt`/`productionDeployedAt` are first stamped, since those columns
 * record only the FIRST success; this table records every attempt. Create/list only.
 */
export interface DeploymentEntity {
  readonly id: string;
  readonly releaseId: string;
  readonly projectId: string;
  readonly environment: DeploymentEnvironment;
  readonly outcome: DeploymentOutcome;
  readonly deployedByUserId: string | null;
  readonly deployedAt: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type SmokeTestResult = "passed" | "failed";

/** Create/list only. */
export interface SmokeTestEntity {
  readonly id: string;
  readonly releaseId: string;
  readonly projectId: string;
  readonly environment: DeploymentEnvironment;
  readonly name: string;
  readonly result: SmokeTestResult;
  readonly ranAt: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * "Rolled-back SHA, reason, replacement release" — a literal, field-for-field match of the
 * canonical spec's own named fields. Auto-inserted inside the same transaction as the parent
 * release's own CAS status write on any `-> rolled_back` transition. At most one per release
 * (`rollback_records_release_id_unique`), read-only via `GET .../releases/:id/rollback`.
 * `replacementReleaseId` is existence-validated within the same project at the service layer.
 */
export interface RollbackRecordEntity {
  readonly id: string;
  readonly releaseId: string;
  readonly projectId: string;
  readonly rolledBackSha: string;
  readonly reason: string;
  readonly replacementReleaseId: string | null;
  readonly rolledBackByUserId: string | null;
  readonly rolledBackAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
