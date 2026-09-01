import type { ReactNode } from "react";
import type { CaseStudyApproval } from "@webdesk/shared-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import { SanitizedRichText } from "./sanitized-rich-text";
import styles from "./case-study-approvals-section.module.css";

const APPROVAL_TYPE_LABEL: Readonly<Record<CaseStudyApproval["approvalType"], string>> = {
  internal: "Internal",
  client: "Client",
};

const DECISION_LABEL: Readonly<Record<CaseStudyApproval["decision"], string>> = {
  approved: "Approved",
  rejected: "Rejected",
  revision_requested: "Revision Requested",
};

export interface CaseStudyApprovalsSectionProps {
  readonly approvals: readonly CaseStudyApproval[];
  /** Already resolved to real display names server-side (`getUsersByIds()`, degrading any
   *  unresolvable id — a disabled/removed account, or simply a lookup failure — to an absent key)
   *  rather than this component resolving ids itself, mirroring `InternalLinkForm`'s own
   *  `initialApprover`/`ProjectForm`'s own owner-resolution split. A missing key falls back to the
   *  raw id, still real and honest, just unresolved. */
  readonly decidedByNameById: ReadonlyMap<string, string>;
}

/**
 * A read-only, server-rendered list of `case_study_approvals` rows (D4/D7) — no add/edit/delete UI
 * exists for this sub-resource, since every row is written only as a side effect of
 * `CaseStudiesService.changeStatus()` on the parent, never directly (mirrors Review and Approval
 * Center's own `review_decisions` table, which this table's own shape is modeled on). `notes` is
 * server-sanitized rich text (`CaseStudiesService.changeStatus()`'s own
 * `sanitizeNullableRichText()`), rendered via the shared `SanitizedRichText` component — the only
 * place this app may use `dangerouslySetInnerHTML` for rich-text content.
 */
export function CaseStudyApprovalsSection({
  approvals,
  decidedByNameById,
}: CaseStudyApprovalsSectionProps): ReactNode {
  if (approvals.length === 0) {
    return <p className={styles.muted}>No approval decisions recorded yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {approvals.map((approval) => (
        <li key={approval.id} className={styles.row}>
          <div className={styles.rowHeader}>
            <span className={styles.badge}>{APPROVAL_TYPE_LABEL[approval.approvalType]}</span>
            <span className={styles.decision}>{DECISION_LABEL[approval.decision]}</span>
            <span className={styles.meta}>
              {approval.decidedByUserId
                ? (decidedByNameById.get(approval.decidedByUserId) ?? approval.decidedByUserId)
                : "Unknown"}
              {" · "}
              {formatTimestamp(approval.decidedAt)}
            </span>
          </div>
          {approval.notes ? (
            <SanitizedRichText html={approval.notes} className={styles.notes} />
          ) : (
            <p className={styles.muted}>No notes.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
