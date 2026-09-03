import type { ReactNode } from "react";
import type { ReleaseApproval } from "@webdesk/shared-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import styles from "./release-approvals-section.module.css";

const STAGE_LABEL: Readonly<Record<ReleaseApproval["approvalStage"], string>> = {
  staging: "Staging",
  production: "Production",
};

const DECISION_LABEL: Readonly<Record<ReleaseApproval["decision"], string>> = {
  approved: "Approved",
  rejected: "Rejected",
  hotfix_required: "Hotfix Required",
};

export interface ReleaseApprovalsSectionProps {
  readonly approvals: readonly ReleaseApproval[];
  /** Already resolved to real display names server-side (`getUsersByIds()`, degrading any
   *  unresolvable id to an absent key) rather than this component resolving ids itself, mirroring
   *  `CaseStudyApprovalsSection`'s own identical split. A missing key falls back to the raw id,
   *  still real and honest, just unresolved. */
  readonly decidedByNameById: ReadonlyMap<string, string>;
}

/**
 * A read-only, server-rendered list of `release_approvals` rows (D1) — no add/edit/delete UI
 * exists for this sub-resource, since every row is written only as a side effect of
 * `ReleasesService.changeStatus()` on the parent, never directly (mirrors `CaseStudyApprovalsSection`'s
 * own `case_study_approvals` precedent, itself modeled on Review and Approval Center's
 * `review_decisions` table). Ordered most-recent-first, matching `listApprovals()`'s own backend
 * ordering.
 *
 * `notes` is rendered as plain text, NOT via the shared `SanitizedRichText` component —
 * `ReleasesService.changeStatus()` never sanitizes this field (`changeReleaseStatusSchema`'s own
 * DTO comment: "deliberately plain, unsanitized text"), so treating it as HTML here would be
 * dishonest and would bypass this app's own sanitize-then-render discipline for genuine rich text.
 */
export function ReleaseApprovalsSection({
  approvals,
  decidedByNameById,
}: ReleaseApprovalsSectionProps): ReactNode {
  if (approvals.length === 0) {
    return <p className={styles.muted}>No approval decisions recorded yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {approvals.map((approval) => (
        <li key={approval.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.badge}>{STAGE_LABEL[approval.approvalStage]}</span>
            <span
              className={
                approval.decision === "approved"
                  ? styles.decisionApproved
                  : approval.decision === "rejected"
                    ? styles.decisionRejected
                    : styles.decisionHotfix
              }
            >
              {DECISION_LABEL[approval.decision]}
            </span>
            <span className={styles.meta}>
              {approval.decidedByUserId
                ? (decidedByNameById.get(approval.decidedByUserId) ?? approval.decidedByUserId)
                : "Unknown"}
              {" · "}
              {formatTimestamp(approval.decidedAt)}
            </span>
          </div>
          {approval.notes ? (
            <p className={styles.notes}>{approval.notes}</p>
          ) : (
            <p className={styles.muted}>No notes.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
