"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Release, ReleaseStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isUuid } from "@/lib/uuid";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./release-status-actions.module.css";

export interface ReleaseStatusActionsProps {
  readonly projectId: string;
  readonly releaseId: string;
  readonly status: ReleaseStatus;
}

/**
 * Mirrors the `TRANSITIONS` map in `apps/dashboard-api/src/release-center/releases.service.ts`
 * byte-for-byte — kept in sync by hand, the same convention every sibling status-actions component
 * in this app already uses. Only the legal target statuses are mirrored here (not the required
 * RBAC action per transition, which varies dynamically per status — `ReleasesService.changeStatus()`'s
 * own `AuthorizationService.assertAllowed()` call remains the authoritative check either way; a
 * caller without the real grant still gets a clean 403, shown via the same `parseApiErrorMessage()`/
 * `postMutation()` allowlist every mutation in this app uses).
 *
 * `rolled_back` has NO outbound edges — it's the module's own fully terminal state. `completed`
 * is ALSO reachable again from itself via `completed -> hotfix_required` — a genuine, deliberate
 * re-entry the backend's own `TRANSITIONS` table names, not an oversight.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ReleaseStatus, readonly ReleaseStatus[]>> = {
  proposed: ["checks_running"],
  checks_running: ["ready_for_staging", "checks_failed"],
  checks_failed: ["checks_running", "proposed"],
  ready_for_staging: ["staging_deployed"],
  staging_deployed: ["staging_verification", "rolled_back"],
  staging_verification: ["staging_approved", "verification_failed"],
  verification_failed: ["staging_deployed", "production_deployed"],
  staging_approved: ["production_approval"],
  production_approval: ["production_deployed"],
  production_deployed: ["production_verification", "hotfix_required", "rolled_back"],
  production_verification: ["completed", "verification_failed", "hotfix_required"],
  completed: ["hotfix_required", "rolled_back"],
  hotfix_required: ["rolled_back"],
  rolled_back: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. `checks_running` is
 *  reachable from both `proposed` and `checks_failed`, sharing one label — the target, not the
 *  source, drives what the button says. */
const ACTION_LABEL: Readonly<Record<ReleaseStatus, string>> = {
  proposed: "Revert to Proposed",
  checks_running: "Run Checks",
  checks_failed: "Mark Checks Failed",
  ready_for_staging: "Mark Ready for Staging",
  staging_deployed: "Deploy to Staging",
  staging_verification: "Start Staging Verification",
  staging_approved: "Approve Staging",
  verification_failed: "Mark Verification Failed",
  production_approval: "Request Production Approval",
  production_deployed: "Deploy to Production",
  production_verification: "Start Production Verification",
  completed: "Mark Completed",
  hotfix_required: "Flag Hotfix Required",
  rolled_back: "Roll Back",
};

const NOTES_MAX_LENGTH = 10_000;
const REASON_MAX_LENGTH = 10_000;
const ROLLED_BACK_SHA_MAX_LENGTH = 40;

/**
 * Status-transition actions for the release detail page's header — the real 14-status
 * `ReleaseStatus` workflow (see `ALLOWED_TRANSITIONS`' own doc comment). No approved design brief
 * names an `ApprovalBlock` component for this module, and the same reasoning that already keeps
 * every sibling status-actions component from using it applies here: `changeReleaseStatusSchema`
 * accepts no real submitter/reviewer identity, only an optional `notes`/`reason`/`rolledBackSha`/
 * `replacementReleaseId` payload.
 *
 * `notes` is a single, always-visible plain `<textarea>` above the action buttons (not
 * `RichTextEditor`) — a deliberate, documented exception to the 2026-08-22 standing rich-text
 * rule: `changeReleaseStatusSchema`'s own DTO comment states `notes`/`reason` are "deliberately
 * plain, unsanitized text — no `dashboard-web` UI exists yet, matching Scan Center's/Technical
 * Center's own 'stay plain until a UI decision is made' precedent," and that backend sanitization
 * change was never made for this module. Treating it as HTML on the frontend without a paired
 * backend sanitization change (every other rich-text conversion in this codebase always paired the
 * two) would be dishonest, so it stays plain here too.
 *
 * `reason`/`rolledBackSha` (required) and `replacementReleaseId` (optional, client-side
 * UUID-format-checked) render only once `rolled_back` is one of the currently legal targets, and
 * the Roll Back button stays disabled until `reason`/`rolledBackSha` are both non-empty and any
 * entered `replacementReleaseId` looks like a real UUID. Only the transition into `rolled_back`
 * confirms via `window.confirm()` — the one truly irreversible-in-spirit action here (it has zero
 * outbound edges), matching every sibling status-actions component's own "only the irreversible
 * transition confirms" precedent; `completed -> hotfix_required` is a real re-entry, not a
 * terminal exit, so it does not confirm.
 */
export function ReleaseStatusActions({
  projectId,
  releaseId,
  status: initialStatus,
}: ReleaseStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [rolledBackSha, setRolledBackSha] = useState("");
  const [replacementReleaseId, setReplacementReleaseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ReleaseStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  const rollbackAvailable = targets.includes("rolled_back");
  const trimmedReason = reason.trim();
  const trimmedSha = rolledBackSha.trim();
  const trimmedReplacementId = replacementReleaseId.trim();
  const replacementIdValid = trimmedReplacementId === "" || isUuid(trimmedReplacementId);
  const rollbackReady = trimmedReason !== "" && trimmedSha !== "" && replacementIdValid;

  async function handleTransition(nextStatus: ReleaseStatus): Promise<void> {
    if (nextStatus === "rolled_back") {
      if (!rollbackReady) {
        setError(
          !replacementIdValid
            ? "Replacement release must be a valid UUID."
            : "A reason and the rolled-back commit SHA are both required to roll back a release.",
        );
        return;
      }
      if (!window.confirm("Roll back this release? This cannot be undone.")) {
        return;
      }
    }

    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation<Release>(
        `${getApiBaseUrl()}/release-center/projects/${projectId}/releases/${releaseId}/status`,
        {
          status: nextStatus,
          notes: notes.trim() || null,
          reason: nextStatus === "rolled_back" ? trimmedReason : null,
          rolledBackSha: nextStatus === "rolled_back" ? trimmedSha : null,
          replacementReleaseId:
            nextStatus === "rolled_back" && trimmedReplacementId !== ""
              ? trimmedReplacementId
              : null,
        },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update the
      // rendered button set from the just-confirmed transition immediately, from the LOCALLY KNOWN
      // target status, rather than waiting on router.refresh() to reconcile it.
      setStatus(nextStatus);
      setNotes("");
      setReason("");
      setRolledBackSha("");
      setReplacementReleaseId("");
      router.refresh();
    } catch (err) {
      console.error("Failed to change release status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.field}>
        <label htmlFor="release-status-notes" className={styles.label}>
          Notes (optional)
        </label>
        <textarea
          id="release-status-notes"
          maxLength={NOTES_MAX_LENGTH}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={styles.textarea}
          rows={2}
        />
      </div>

      {rollbackAvailable ? (
        <div className={styles.rollbackFields}>
          <p className={styles.rollbackFieldsTitle}>Roll back details (required to roll back)</p>
          <div className={styles.field}>
            <label htmlFor="release-rollback-reason" className={styles.label}>
              Reason
            </label>
            <textarea
              id="release-rollback-reason"
              maxLength={REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={styles.textarea}
              rows={2}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="release-rollback-sha" className={styles.label}>
              Rolled-back commit SHA
            </label>
            <input
              id="release-rollback-sha"
              type="text"
              maxLength={ROLLED_BACK_SHA_MAX_LENGTH}
              value={rolledBackSha}
              onChange={(event) => setRolledBackSha(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="release-replacement-release-id" className={styles.label}>
              Replacement release ID (optional)
            </label>
            <input
              id="release-replacement-release-id"
              type="text"
              value={replacementReleaseId}
              onChange={(event) => setReplacementReleaseId(event.target.value)}
              className={styles.input}
              placeholder="UUID of the release replacing this one"
            />
            {!replacementIdValid ? (
              <span className={styles.helperText}>Must be a valid UUID.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.buttonRow}>
        {targets.map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => void handleTransition(target)}
            disabled={pending !== null || (target === "rolled_back" && !rollbackReady)}
            className={target === "rolled_back" ? styles.terminalButton : styles.actionButton}
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
