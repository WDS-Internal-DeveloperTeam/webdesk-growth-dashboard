import type { StatusToken } from "@webdesk/ui";

/**
 * Shared 8-value approval-status vocabulary and its label/badge-token presentation, reused
 * verbatim by both Service Library and Persona Library — `module-persona-library`'s own D3
 * explicitly reuses Service Library's identical workflow. Unlike each module's own backend
 * `TRANSITIONS`/RBAC-action table (which encodes real per-module authorization and could
 * plausibly diverge later even though currently identical — see the accepted, tracked debt on
 * both `ServiceStatusActions` and `PersonaStatusActions`), this is pure UI presentation data with
 * no module-specific reason to be maintained as two independent copies. `PersonaApprovalStatus`
 * and `ServiceApprovalStatus` (`@webdesk/shared-types`) are structurally identical to
 * `ArtifactApprovalStatus` below, so each module's own `-query.ts` file can use this directly
 * without a cast.
 */
export type ArtifactApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

export const ARTIFACT_APPROVAL_STATUS_VALUES: readonly ArtifactApprovalStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "revision_requested",
  "rejected",
  "superseded",
  "archived",
];

export const ARTIFACT_APPROVAL_STATUS_LABEL: Readonly<Record<ArtifactApprovalStatus, string>> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  revision_requested: "Revision Requested",
  rejected: "Rejected",
  superseded: "Superseded",
  archived: "Archived",
};

// 8 real statuses onto a fixed 5-token badge palette necessarily doubles some up — chosen so the
// two states most likely to be confused for each other (a live, editable state and a permanently
// terminal one) never share a token: draft/submitted/approved each get their own unique token;
// under_review/revision_requested share `degraded` (both "still in progress, not yet resolved");
// and the three genuinely terminal/no-longer-valid states (rejected/superseded/archived) share
// `unavailable` together, rather than any of them colliding with an everyday live state.
const ARTIFACT_APPROVAL_STATUS_BADGE: Readonly<
  Record<ArtifactApprovalStatus, { token: StatusToken; label: string }>
> = {
  draft: { token: "unknown", label: "Draft" },
  submitted: { token: "notConfigured", label: "Submitted" },
  under_review: { token: "degraded", label: "Under Review" },
  approved: { token: "healthy", label: "Approved" },
  revision_requested: { token: "degraded", label: "Revision Requested" },
  rejected: { token: "unavailable", label: "Rejected" },
  superseded: { token: "unavailable", label: "Superseded" },
  archived: { token: "unavailable", label: "Archived" },
};

export function artifactApprovalStatusBadge(status: ArtifactApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return ARTIFACT_APPROVAL_STATUS_BADGE[status];
}
