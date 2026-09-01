"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { DesignReview, DesignReviewStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { findOverLongRichTextField, isEmptyRichTextHtml } from "@/lib/rich-text";
import { useSyncedState } from "@/lib/use-synced-state";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./design-review-decision-actions.module.css";

export interface DesignReviewDecisionActionsProps {
  readonly reviewId: string;
  readonly status: DesignReviewStatus;
}

type DecideAction = "approve" | "approve_with_notes" | "request_revision" | "reject";

const DECIDE_ACTIONS: readonly DecideAction[] = [
  "approve",
  "approve_with_notes",
  "request_revision",
  "reject",
];

const ACTION_LABEL: Readonly<Record<DecideAction, string>> = {
  approve: "Approve",
  approve_with_notes: "Approve with Notes",
  request_revision: "Request Revision",
  reject: "Reject",
};

// Mirrors DesignReviewsService.decide()'s own NEXT_STATUS_FOR_DECISION — the locally-known target
// status each action produces, used to update local state after a successful mutation instead of
// trusting `result.data` (postMutation()'s own documented contract: success data may degrade to
// undefined on a missing/malformed response body), mirroring ReviewDecisionActions' own already-
// reviewed precedent.
const NEXT_STATUS_FOR_ACTION: Readonly<Record<DecideAction, DesignReviewStatus>> = {
  approve: "approved",
  approve_with_notes: "approved",
  request_revision: "revision_requested",
  reject: "rejected",
};

// Mirrors apps/dashboard-api/src/design-review-center/design-review-center.dto.ts's
// NOTES_MAX_LENGTH — kept in sync by hand, same approach every sibling module's own form/
// status-actions component uses for its own backend-mirrored constants.
const NOTES_MAX_LENGTH = 4000;

/**
 * Decision actions for the Design Review Center detail page — the 4 approval-shaped
 * `POST /design-reviews/:id/decide` actions (approve/approve_with_notes/request_revision/reject),
 * each an atomic compare-and-swap against the review's own CURRENT `status` (`expectedStatus`).
 * Mirrors `ReviewDecisionActions` file-for-file — renders nothing once `status` is terminal
 * (`approved`/`rejected`/`superseded`; unlike Review and Approval Center's own 2-terminal-status
 * workflow, this module has a 3rd — `superseded`, reached only as the automatic side effect of a
 * DIFFERENT review being approved, never directly).
 *
 * Every action opens a small inline optional-notes form before confirming. `notes` uses
 * `RichTextEditor`, per the 2026-08-22 standing rule, sanitized server-side
 * (`design-reviews.service.ts#decide()`) and rendered via the shared `SanitizedRichText` component
 * in the Decision History section, matching every other rich-text field in this app.
 *
 * `status` is re-synced from the server-passed prop via `useSyncedState()` — this component has no
 * sibling process-actions component on this detail page (unlike Review and Approval Center's own
 * `ReviewProcessActions`), but a concurrent external change (e.g. the automatic supersede side
 * effect of approving a DIFFERENT review) is still possible, so re-syncing on refresh stays
 * correct regardless.
 *
 * `DesignReviewsService.decide()` also enforces separation of duties server-side (the submitter can
 * never decide their own review) — a real 403 from that check surfaces here via the normal error
 * path, not a special-cased client-side check, since this component has no way to know who
 * submitted the review it's rendered for.
 */
export function DesignReviewDecisionActions({
  reviewId,
  status: initialStatus,
}: DesignReviewDecisionActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [activeAction, setActiveAction] = useState<DecideAction | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "approved" || status === "rejected" || status === "superseded") {
    return null;
  }

  function openAction(action: DecideAction): void {
    setActiveAction(action);
    setNotes("");
    setError(null);
  }

  function cancel(): void {
    setActiveAction(null);
    setNotes("");
    setError(null);
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeAction) {
      return;
    }
    setError(null);

    const lengthError = findOverLongRichTextField([["Notes", notes]], NOTES_MAX_LENGTH);
    if (lengthError) {
      setError(lengthError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await postMutation<DesignReview>(
        `${getApiBaseUrl()}/design-reviews/${reviewId}/decide`,
        {
          action: activeAction,
          notes: isEmptyRichTextHtml(notes) ? null : notes,
          expectedStatus: status,
        },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStatus(NEXT_STATUS_FOR_ACTION[activeAction]);
      setActiveAction(null);
      setNotes("");
      router.refresh();
    } catch (err) {
      console.error("Failed to record design review decision", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (activeAction) {
    return (
      <form className={styles.notesForm} onSubmit={(event) => void handleConfirm(event)}>
        <p className={styles.notesFormTitle}>{ACTION_LABEL[activeAction]}</p>
        <label htmlFor="decision-notes" className={styles.notesLabel}>
          Notes (optional)
        </label>
        <RichTextEditor id="decision-notes" value={notes} onChange={setNotes} />
        <div className={styles.wrapper}>
          <button type="submit" disabled={submitting} className={styles.actionButton}>
            {submitting ? "…" : `Confirm: ${ACTION_LABEL[activeAction]}`}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={cancel}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className={styles.wrapper}>
      {DECIDE_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => openAction(action)}
          className={action === "reject" ? styles.terminalButton : styles.actionButton}
        >
          {ACTION_LABEL[action]}
        </button>
      ))}
    </div>
  );
}
