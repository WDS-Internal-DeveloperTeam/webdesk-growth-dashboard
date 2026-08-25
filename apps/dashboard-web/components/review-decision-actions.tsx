"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Review, ReviewStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./review-decision-actions.module.css";

export interface ReviewDecisionActionsProps {
  readonly reviewId: string;
  readonly status: ReviewStatus;
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

// Mirrors apps/dashboard-api/src/review-and-approval-center/review-and-approval-center.dto.ts's
// NOTES_MAX_LENGTH — kept in sync by hand, same approach every sibling module's own form/
// status-actions component uses for its own backend-mirrored constants.
const NOTES_MAX_LENGTH = 2000;

/**
 * Decision actions for the Review and Approval Center detail page — the 4 approval-shaped
 * `POST /reviews/:id/decide` actions (approve/approve_with_notes/request_revision/reject), each an
 * atomic compare-and-swap against the review's own CURRENT `status` (`expectedStatus`). Renders
 * nothing once `status` is terminal (`approved`/`rejected`) — the backend's own `TRANSITIONS`-
 * shaped logic (`ReviewsService.decide()`'s `NEXT_STATUS_FOR_DECISION`) has no route back out of
 * either.
 *
 * Every action opens a small inline optional-notes form before confirming — the backend's own
 * `notes` field is genuinely optional for all 4 actions, including `request_revision` (a
 * reviewer's stated reason for sending work back is exactly the kind of detail worth capturing
 * even though it's not required). `notes` stays a plain `<textarea>`, not `RichTextEditor` — task
 * package's own design keeps this field short/ephemeral, matching every sibling module's own
 * status-actions "reason" field never using the rich-text editor.
 *
 * `status` is re-synced from the server-passed prop via `useEffect` (mirrors
 * `ContentTemplateStatusActions`'s own precedent) — the detail page also renders the sibling
 * `ReviewProcessActions` component, whose own mutations don't change `status` but do trigger the
 * same `router.refresh()`, so this component must still pick up any concurrent external change.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — the same pattern every mutation component in this app already uses.
 * `ReviewsService.decide()` also enforces separation of duties server-side (the submitter can
 * never decide their own review) — a real 403 from that check surfaces here via the normal error
 * path, not a special-cased client-side check, since this component has no way to know who
 * submitted the review it's rendered for.
 */
export function ReviewDecisionActions({
  reviewId,
  status: initialStatus,
}: ReviewDecisionActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [activeAction, setActiveAction] = useState<DecideAction | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  if (status === "approved" || status === "rejected") {
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
    setSubmitting(true);
    try {
      const result = await postMutation<Review>(`${getApiBaseUrl()}/reviews/${reviewId}/decide`, {
        action: activeAction,
        notes: notes.trim() || null,
        expectedStatus: status,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern ContentTemplateStatusActions/ProjectStatusActions use: update
      // the rendered state from the just-confirmed transition immediately, rather than waiting on
      // router.refresh() to reconcile it.
      setStatus(result.data.status);
      setActiveAction(null);
      setNotes("");
      router.refresh();
    } catch (err) {
      console.error("Failed to record review decision", err);
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
        <textarea
          id="decision-notes"
          rows={3}
          maxLength={NOTES_MAX_LENGTH}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={styles.notesTextarea}
        />
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
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
