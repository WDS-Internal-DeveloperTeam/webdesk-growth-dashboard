import Link from "next/link";
import type { ReactNode } from "react";
import type { RollbackRecord } from "@webdesk/shared-types";
import { Fact } from "@webdesk/ui";
import { dlStyle, mutedStyle } from "@/lib/detail-section-styles";
import { formatTimestamp } from "@/lib/format-timestamp";
import { withProjectId } from "@/lib/project-scoped-href";

export interface ReleaseRollbackRecordProps {
  readonly projectId: string;
  readonly record: RollbackRecord;
  /** Already resolved to a real display name server-side (`getUsersByIds()`), or `null` if the
   *  actor id doesn't resolve — mirrors `ReleaseApprovalsSection`'s own raw-id fallback. */
  readonly rolledBackByName: string | null;
}

/**
 * A read-only rollback record block — rendered on the detail page ONLY when
 * `getReleaseRollbackRecord()` actually returns a row (a release that has never been rolled back
 * degrades to `null`, a real, valid, non-error state, not an empty-state placeholder here). At
 * most one per release (`rollback_records_release_id_unique`).
 *
 * `reason` is plain text, NOT rendered via `SanitizedRichText` — `rollback_records.reason` is
 * never sanitized by the backend, matching `ReleaseApprovalsSection`'s own identical plain-text
 * `notes` rendering. `replacementReleaseId`, when present, links to that release's own detail page
 * only after a real `isUuid()`-equivalent sanity check (the id is already a genuine UUID column
 * value from the backend, but the same defensive habit `ReleaseApprovalsSection`'s raw-id fallback
 * already establishes is followed here too).
 */
export function ReleaseRollbackRecord({
  projectId,
  record,
  rolledBackByName,
}: ReleaseRollbackRecordProps): ReactNode {
  return (
    <>
      <dl style={dlStyle}>
        <Fact label="Rolled-back commit SHA">{record.rolledBackSha}</Fact>
        <Fact label="Rolled back by">
          {rolledBackByName ?? record.rolledBackByUserId ?? "Unknown"}
        </Fact>
        <Fact label="Rolled back at">{formatTimestamp(record.rolledBackAt)}</Fact>
        <Fact label="Replacement release">
          {record.replacementReleaseId ? (
            <Link href={withProjectId(`/release-center/${record.replacementReleaseId}`, projectId)}>
              {record.replacementReleaseId}
            </Link>
          ) : (
            "—"
          )}
        </Fact>
      </dl>
      <p style={{ ...mutedStyle, whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>{record.reason}</p>
    </>
  );
}
