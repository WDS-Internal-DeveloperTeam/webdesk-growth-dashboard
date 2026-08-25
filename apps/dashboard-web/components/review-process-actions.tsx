"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Review, ReviewStatus, UserSummary } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import { UserPicker } from "./user-picker";
import styles from "./review-process-actions.module.css";

export interface ReviewProcessActionsProps {
  readonly reviewId: string;
  readonly status: ReviewStatus;
  readonly isPaused: boolean;
  /** The review's real, current `assignedToUserId` (from the `Review` entity itself) — always
   *  correct, used as `POST .../delegate`'s `expectedAssignedToUserId` compare-and-swap value.
   *  Distinct from `assignedToUser` below, which may be `null` even when this isn't, if
   *  `GET /users/:userId` resolution failed (a 403 — most roles lack `users_roles:view` — or a
   *  network error); the raw id stays authoritative for the CAS either way, so a resolution
   *  failure can never cause a spurious "changed concurrently" conflict. */
  readonly assignedToUserId: string | null;
  /** The resolved display summary for `assignedToUserId`, or `null` if unassigned OR resolution
   *  failed — pre-selects the delegate `UserPicker`'s own value when available. */
  readonly assignedToUser: UserSummary | null;
}

/**
 * Process-management actions (Pause/Resume, Delegate) — orthogonal to the approval-shaped
 * `ReviewDecisionActions` sibling component: neither changes `status`, and neither is mirrored
 * into `audit_events` (task package D5 — `review_decisions` is their only record). Hidden entirely
 * once `status` is terminal (`approved`/`rejected`) — the backend still 409s a stale/late attempt
 * either way (both `updatePaused()`/`updateAssignee()` are their own atomic compare-and-swaps), but
 * hiding here is the same honest-UX precedent every sibling status-actions component already
 * establishes for its own terminal state.
 *
 * Pause/Resume needs no confirmation — reversible, advisory only (task package D2). Delegate uses
 * the existing `UserPicker` control; its own button is disabled until a genuinely different
 * assignee is chosen, so a same-assignee no-op mutation is never attempted.
 */
export function ReviewProcessActions({
  reviewId,
  status,
  isPaused: initialIsPaused,
  assignedToUserId: initialAssignedToUserId,
  assignedToUser: initialAssignedToUser,
}: ReviewProcessActionsProps): ReactNode {
  const router = useRouter();
  // Re-synced from the server-passed props whenever they change, via the shared useSyncedState()
  // hook (code-review finding: this project's own standing feedback names "duplication/reuse
  // misses" as its #1 recurring review-finding category — this component's own pair of hand-
  // written useEffect resyncs was itself the 5th independent hand-copy of the identical
  // ContentTemplatePublishActions-established pattern). initialAssignedToUserId/
  // initialAssignedToUser always change together (both derive from the same review prop one
  // level up), so syncing them via two independent calls is safe.
  const [isPaused, setIsPaused] = useSyncedState(initialIsPaused);
  const [assignedToUserId, setAssignedToUserId] = useSyncedState(initialAssignedToUserId);
  const [selectedUser, setSelectedUser] = useSyncedState<UserSummary | null>(initialAssignedToUser);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [pausePending, setPausePending] = useState(false);
  const [delegatePending, setDelegatePending] = useState(false);

  if (status === "approved" || status === "rejected") {
    return null;
  }

  async function handleTogglePause(): Promise<void> {
    setPauseError(null);
    setPausePending(true);
    // The locally-known target value — `postMutation()`'s own documented contract says its
    // success `data` may degrade to `undefined` on a missing/malformed response body, so this
    // updates local state from what was actually sent, not `result.data.isPaused` (code-review
    // finding, mirrors ReviewDecisionActions' own identical fix).
    const nextIsPaused = !isPaused;
    try {
      const result = await postMutation<Review>(`${getApiBaseUrl()}/reviews/${reviewId}/pause`, {
        isPaused: nextIsPaused,
        expectedIsPaused: isPaused,
      });
      if (!result.ok) {
        setPauseError(result.message);
        return;
      }
      setIsPaused(nextIsPaused);
      router.refresh();
    } catch (err) {
      console.error("Failed to change review pause state", err);
      setPauseError("Something went wrong. Please try again.");
    } finally {
      setPausePending(false);
    }
  }

  async function handleDelegate(): Promise<void> {
    if (!selectedUser) {
      return;
    }
    setDelegateError(null);
    setDelegatePending(true);
    try {
      const result = await postMutation<Review>(`${getApiBaseUrl()}/reviews/${reviewId}/delegate`, {
        assignedToUserId: selectedUser.id,
        expectedAssignedToUserId: assignedToUserId,
      });
      if (!result.ok) {
        setDelegateError(result.message);
        return;
      }
      // The locally-known target value, not `result.data.assignedToUserId` — same reasoning as
      // handleTogglePause() above (code-review finding).
      setAssignedToUserId(selectedUser.id);
      router.refresh();
    } catch (err) {
      console.error("Failed to delegate review", err);
      setDelegateError("Something went wrong. Please try again.");
    } finally {
      setDelegatePending(false);
    }
  }

  const canDelegate = selectedUser !== null && selectedUser.id !== assignedToUserId;

  return (
    <div className={styles.wrapper}>
      <div className={styles.pauseGroup}>
        <button
          type="button"
          onClick={() => void handleTogglePause()}
          disabled={pausePending}
          className={styles.actionButton}
        >
          {pausePending ? "…" : isPaused ? "Resume" : "Pause"}
        </button>
        {pauseError ? (
          <p role="alert" className={styles.error}>
            {pauseError}
          </p>
        ) : null}
      </div>

      <div className={styles.delegateGroup}>
        <UserPicker
          id="review-delegate-picker"
          label="Delegate to"
          value={selectedUser}
          onChange={setSelectedUser}
        />
        <button
          type="button"
          onClick={() => void handleDelegate()}
          disabled={!canDelegate || delegatePending}
          className={styles.actionButton}
        >
          {delegatePending ? "…" : "Delegate"}
        </button>
        {delegateError ? (
          <p role="alert" className={styles.error}>
            {delegateError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
