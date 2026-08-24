"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { KeywordApprovalStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./keyword-status-actions.module.css";

export interface KeywordStatusActionsProps {
  readonly projectId: string;
  readonly keywordId: string;
  readonly approvalStatus: KeywordApprovalStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/keyword-and-entity-library/keywords.service.ts` — kept in sync by hand,
 * same approach `PageStatusActions`/`ServiceStatusActions`/`PersonaStatusActions`/
 * `ProofClaimStatusActions`/`WebsiteStrategyStatusActions` already use. This is (at least) the 6th
 * independent hand-copy of the shared 8-value artifact-approval-status transitions shape — already
 * accepted, tracked debt across this codebase, not fixed here. Only the legal target statuses are
 * mirrored here (not the required RBAC action per transition, which varies dynamically per status —
 * `KeywordsService.changeApprovalStatus()`'s own `AuthorizationService.assertAllowed()` call
 * remains the authoritative check either way; a caller without the real grant still gets a clean
 * 403, shown via the same `parseApiErrorMessage()` allowlist every mutation in this app uses).
 * Matches Service/Persona/Proof-and-Claims Library's own shape (a direct `approved -> superseded`
 * transition is allowed), not Website Strategy Center's own deliberate divergence.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<KeywordApprovalStatus, readonly KeywordApprovalStatus[]>> =
  {
    draft: ["submitted", "archived"],
    submitted: ["under_review", "draft", "archived"],
    under_review: ["approved", "revision_requested", "rejected", "archived"],
    revision_requested: ["draft", "submitted", "archived"],
    approved: ["superseded", "archived"],
    rejected: ["draft", "archived"],
    superseded: [],
    archived: [],
  };

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<KeywordApprovalStatus, string>> = {
  submitted: "Submit for Review",
  under_review: "Start Review",
  approved: "Approve",
  revision_requested: "Request Revision",
  rejected: "Reject",
  draft: "Revert to Draft",
  superseded: "Mark as Superseded",
  archived: "Archive",
};

/** Only transitions whose OWN target status is terminal (an empty `ALLOWED_TRANSITIONS` entry —
 *  `superseded`/`archived`) prompt a confirmation, matching the identical "only the irreversible
 *  transition confirms" precedent every sibling status-actions component already establishes. */
const CONFIRM_MESSAGE: Partial<Record<KeywordApprovalStatus, string>> = {
  archived: "Archive this keyword? Archived keywords can't be reactivated.",
  superseded: "Mark this keyword as superseded? Superseded keywords can't be reactivated.",
};

/**
 * Approval-status-transition actions for the keyword detail page's header — reuses the shared
 * 8-value `ArtifactApprovalStatus` workflow (task package D9). No approved design brief names an
 * `ApprovalBlock` component for this module, and the same reasoning that kept every sibling
 * status-actions component from using it applies identically here:
 * `changeKeywordApprovalStatusSchema` accepts only `{approvalStatus}`, no submitter/reviewer
 * identity or rejection/revision reason, so a component expecting that data would need to fabricate
 * it.
 *
 * The route is project-scoped (`keyword-and-entity-library/projects/:projectId/keywords/:id/status`)
 * — `projectId` is a required prop, threaded into the URL, matching `PageStatusActions`'s own
 * project-scoped shape. Renders only the transitions the backend would actually accept from the
 * keyword's current status, so an invalid-transition response is unreachable through this UI in
 * normal use. Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header.
 */
export function KeywordStatusActions({
  projectId,
  keywordId,
  approvalStatus: initialStatus,
}: KeywordStatusActionsProps): ReactNode {
  const router = useRouter();
  const [approvalStatus, setApprovalStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<KeywordApprovalStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[approvalStatus] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: KeywordApprovalStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}/status`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: nextStatus }),
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
      setApprovalStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change keyword approval status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      {targets.map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => {
            void handleTransition(target);
          }}
          disabled={pending !== null}
          className={
            ALLOWED_TRANSITIONS[target].length === 0 ? styles.terminalButton : styles.actionButton
          }
        >
          {pending === target ? "…" : ACTION_LABEL[target]}
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
