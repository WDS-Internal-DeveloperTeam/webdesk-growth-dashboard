"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ServiceApprovalStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./service-status-actions.module.css";

export interface ServiceStatusActionsProps {
  readonly serviceId: string;
  readonly approvalStatus: ServiceApprovalStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in `apps/dashboard-api/src/service-library/services.service.ts`
 * — kept in sync by hand, same approach `ProjectStatusActions`/`BusinessKnowledgeStatusActions`
 * already use. Only the legal target statuses are mirrored here (not the required RBAC action per
 * transition) — the backend's own `AuthorizationService.assertAllowed()` call remains the
 * authoritative check either way; a caller without the real grant still gets a clean 403, shown
 * via the same `parseApiErrorMessage()` allowlist every mutation in this app uses. `superseded`/
 * `archived` are both terminal (empty target lists).
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<ServiceApprovalStatus, readonly ServiceApprovalStatus[]>
> = {
  draft: ["submitted", "archived"],
  submitted: ["under_review", "draft", "archived"],
  under_review: ["approved", "revision_requested", "rejected", "archived"],
  revision_requested: ["draft", "submitted", "archived"],
  approved: ["superseded", "archived"],
  rejected: ["draft", "archived"],
  superseded: [],
  archived: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention
 *  `ProjectStatusActions.ACTION_LABEL`/`BusinessKnowledgeStatusActions.ACTION_LABEL` establish. */
const ACTION_LABEL: Readonly<Record<ServiceApprovalStatus, string>> = {
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
 *  transition confirms" precedent `ProjectStatusActions`/`BusinessKnowledgeStatusActions` already
 *  establish — not every negative-sounding transition (`rejected` remains fully recoverable:
 *  `rejected -> draft` and `-> archived` are both still legal, so it gets no confirmation). */
const CONFIRM_MESSAGE: Partial<Record<ServiceApprovalStatus, string>> = {
  archived: "Archive this service? Archived services can't be reactivated.",
  superseded: "Mark this service as superseded? Superseded services can't be reactivated.",
};

/**
 * Status-transition actions for the service detail page's header — the real 8-value
 * `approvalStatus` workflow (`docs/task-packages/module-service-library.md` D5). The approved
 * design brief (`docs/design/dashboard-ui/15-representative-screen-specifications.md` §4) calls
 * for the shared `ApprovalBlock` component here; it's deliberately NOT used in this pass —
 * `ApprovalBlock` requires real `submitter`/`submittedAt`/`reviewer` identity and a typed
 * rejection/revision `reason`, none of which `changeServiceApprovalStatusSchema` accepts or
 * persists (`{approvalStatus}` only, no reason field) — using it honestly would mean either
 * fabricating identity/reason data this backend doesn't track, or silently discarding whatever a
 * reviewer typed into a reason field, both against this project's own standing practice. Deferred
 * until the backend's status-transition endpoint captures a real reason; flagged explicitly in
 * `docs/implementation/dashboard-web-service-library.md`, not silently substituted. Renders only
 * the transitions `POST /service-library/services/:id/status` would actually accept from the
 * service's current status, so an invalid-transition response is unreachable through this UI in
 * normal use.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern
 * `ProjectStatusActions`/`BusinessKnowledgeStatusActions` already use.
 */
export function ServiceStatusActions({
  serviceId,
  approvalStatus: initialStatus,
}: ServiceStatusActionsProps): ReactNode {
  const router = useRouter();
  const [approvalStatus, setApprovalStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ServiceApprovalStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[approvalStatus] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: ServiceApprovalStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/service-library/services/${serviceId}/status`,
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
      // Same batched-render pattern ProjectStatusActions/BusinessKnowledgeStatusActions use:
      // update the rendered button set from the just-confirmed transition immediately, rather than
      // waiting on router.refresh() to reconcile it, so buttons never re-enable against the stale
      // pre-transition status.
      setApprovalStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change service approval status", err);
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
