"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Review, ReviewStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { findOverLongRichTextField, isEmptyRichTextHtml } from "@/lib/rich-text";
import { useSyncedState } from "@/lib/use-synced-state";
import { RichTextEditor } from "./rich-text-editor";
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

// Mirrors ReviewsService.decide()'s own NEXT_STATUS_FOR_DECISION — the locally-known target status
// each action produces, used to update local state after a successful mutation instead of trusting
// `result.data` (code-review finding: `postMutation()`'s own documented contract says its success
// data "degrades to undefined rather than throwing" on a missing/malformed response body, so every
// caller should "update local state from a value they already know, never from the response" — the
// same convention `ContentTemplateStatusActions` already follows).
const NEXT_STATUS_FOR_ACTION: Readonly<Record<DecideAction, ReviewStatus>> = {
  approve: "approved",
  approve_with_notes: "approved",
  request_revision: "revision_requested",
  reject: "rejected",
};

// Mirrors apps/dashboard-api/src/review-and-approval-center/review-and-approval-center.dto.ts's
// NOTES_MAX_LENGTH — kept in sync by hand, same approach every sibling module's own form/
// status-actions component uses for its own backend-mirrored constants.
const NOTES_MAX_LENGTH = 4000;

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
 * even though it's not required). `notes` uses `RichTextEditor`, per the 2026-08-22 standing rule
 * (code-review finding — the original version of this doc comment claimed "every sibling module's
 * own status-actions reason field never uses the rich-text editor," a precedent that turned out
 * not to exist: no sibling `*StatusActions` component has a comparable field to compare against,
 * and Website Strategy Center's own `notes` field already uses `RichTextEditor` under this same
 * rule). Sanitized server-side (`reviews.service.ts#decide()`) and rendered via the shared
 * `SanitizedRichText` component in the Decision History section below, matching every other
 * rich-text field in this app.
 *
 * `status` is re-synced from the server-passed prop via `useSyncedState()` (mirrors
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
  const [status, setStatus] = useSyncedState(initialStatus);
  const [activeAction, setActiveAction] = useState<DecideAction | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    const lengthError = findOverLongRichTextField([["Notes", notes]], NOTES_MAX_LENGTH);
    if (lengthError) {
      setError(lengthError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await postMutation<Review>(`${getApiBaseUrl()}/reviews/${reviewId}/decide`, {
        action: activeAction,
        notes: isEmptyRichTextHtml(notes) ? null : notes,
        expectedStatus: status,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern ContentTemplateStatusActions/ProjectStatusActions use: update
      // the rendered state from the just-confirmed transition immediately, from the LOCALLY KNOWN
      // target status (not `result.data.status`, which `postMutation()` may not actually carry —
      // see NEXT_STATUS_FOR_ACTION's own doc comment), rather than waiting on router.refresh() to
      // reconcile it.
      setStatus(NEXT_STATUS_FOR_ACTION[activeAction]);
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
      {/* No error render here (code-review finding, dead code removed): `error` can only become
          non-null inside handleConfirm(), which only runs while activeAction is truthy — every
          path back to activeAction === null also clears error in the same statement/batch. The
          notes-form view above is the only place an error can ever actually be shown. */}
    </div>
  );
}
