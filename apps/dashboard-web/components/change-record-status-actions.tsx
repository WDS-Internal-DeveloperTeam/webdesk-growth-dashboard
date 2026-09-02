"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ChangeRecordStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/change-center-query";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./change-record-status-actions.module.css";

export interface ChangeRecordStatusActionsProps {
  readonly projectId: string;
  readonly recordId: string;
  readonly status: ChangeRecordStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/change-center/change-records.service.ts` — kept in sync by hand, same
 * approach every sibling status-actions component in this app already uses. Only the legal target
 * statuses are mirrored here (not the required RBAC action per transition, which varies
 * dynamically per status — `ChangeRecordsService.changeStatus()`'s own
 * `AuthorizationService.assertAllowed()` call remains the authoritative check either way; a caller
 * without the real grant still gets a clean 403, shown via the same `parseApiErrorMessage()`
 * allowlist every mutation in this app uses).
 *
 * `rejected`/`verified` are terminal — no outbound transition, so no button is ever rendered for
 * either once reached; a transition INTO either is confirmed via `window.confirm()`, mirroring
 * every sibling status-actions component's own irreversible-transition convention. No approved
 * design brief names an `ApprovalBlock` component for this module, and the same reasoning that
 * kept every sibling status-actions component from using it applies identically here:
 * `changeChangeRecordStatusSchema` accepts only `{status, decisionNotes, rollbackGuidance}`, no
 * submitter/reviewer identity, so a component expecting that data would need to fabricate it.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ChangeRecordStatus, readonly ChangeRecordStatus[]>> = {
  detected: ["under_review"],
  under_review: ["accepted", "rejected", "deferred", "manual_merge_required"],
  manual_merge_required: ["accepted", "rejected", "deferred"],
  deferred: ["under_review"],
  accepted: ["applying"],
  applying: ["applied", "apply_failed"],
  apply_failed: ["applying"],
  applied: ["verified"],
  rejected: [],
  verified: [],
};

const TERMINAL_TARGETS: ReadonlySet<ChangeRecordStatus> = new Set(["rejected", "verified"]);

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<ChangeRecordStatus, string>> = {
  detected: "Reset to Detected",
  under_review: "Start Review",
  accepted: "Accept",
  rejected: "Reject",
  deferred: "Defer",
  manual_merge_required: "Require Manual Merge",
  applying: "Apply",
  applied: "Mark as Applied",
  apply_failed: "Mark as Failed",
  verified: "Mark as Verified",
};

/**
 * Status-transition actions for the Change Center record detail page's header. Optional
 * `decisionNotes`/`rollbackGuidance` inputs are shown alongside the transition buttons —
 * `rollbackGuidance` is only ever meaningful (and only ever sent) on a transition into
 * `apply_failed`, matching `changeChangeRecordStatusSchema`'s own server-side rejection of it on
 * any other target status.
 *
 * The route is project-scoped (`change-center/projects/:projectId/records/:id/status`) —
 * `projectId` is a required prop, threaded into the URL, matching `InternalLinkStatusActions`'s/
 * `PageStatusActions`'s own project-scoped shape. Renders only the transitions the backend would
 * actually accept from the record's current status, so an invalid-transition response is
 * unreachable through this UI in normal use. Submits via a direct browser `fetch()` with
 * `credentials: "include"` — required for `dashboard-api`'s `OriginCheckGuard` to see a real
 * browser `Origin` header.
 */
export function ChangeRecordStatusActions({
  projectId,
  recordId,
  status: statusProp,
}: ChangeRecordStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(statusProp);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [rollbackGuidance, setRollbackGuidance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ChangeRecordStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: ChangeRecordStatus): Promise<void> {
    if (
      TERMINAL_TARGETS.has(nextStatus) &&
      !window.confirm(
        `${ACTION_LABEL[nextStatus]} is permanent — this record can never move out of ${STATUS_LABEL[nextStatus]} again. Continue?`,
      )
    ) {
      return;
    }

    setError(null);
    setPending(nextStatus);
    try {
      const trimmedNotes = decisionNotes.trim();
      const trimmedRollback = rollbackGuidance.trim();
      const response = await fetch(
        `${getApiBaseUrl()}/change-center/projects/${projectId}/records/${recordId}/status`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            decisionNotes: trimmedNotes ? trimmedNotes : undefined,
            rollbackGuidance:
              nextStatus === "apply_failed" && trimmedRollback ? trimmedRollback : undefined,
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update the
      // rendered button set from the just-confirmed transition immediately, rather than waiting on
      // router.refresh() to reconcile it, so buttons never re-enable against the stale
      // pre-transition status.
      setStatus(nextStatus);
      setDecisionNotes("");
      setRollbackGuidance("");
      router.refresh();
    } catch (err) {
      console.error("Failed to change change record status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.notesRow}>
        <input
          type="text"
          value={decisionNotes}
          onChange={(event) => setDecisionNotes(event.target.value)}
          placeholder="Decision notes (optional)"
          className={styles.notesInput}
        />
        {targets.includes("apply_failed") ? (
          <input
            type="text"
            value={rollbackGuidance}
            onChange={(event) => setRollbackGuidance(event.target.value)}
            placeholder="Rollback guidance (used only if marking as Failed)"
            className={styles.notesInput}
          />
        ) : null}
      </div>
      <div className={styles.buttonRow}>
        {targets.map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => {
              void handleTransition(target);
            }}
            disabled={pending !== null}
            className={styles.actionButton}
          >
            {pending === target ? "…" : ACTION_LABEL[target]}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
