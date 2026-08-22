"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { PersonaApprovalStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./persona-status-actions.module.css";

export interface PersonaStatusActionsProps {
  readonly personaId: string;
  readonly approvalStatus: PersonaApprovalStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in `apps/dashboard-api/src/persona-library/personas.service.ts`
 * — kept in sync by hand, same approach `ServiceStatusActions`/`ProjectStatusActions`/
 * `BusinessKnowledgeStatusActions` already use. Reused verbatim from Service Library's own
 * identical 8-state workflow, since the backend's own `TRANSITIONS` table is itself a direct copy
 * (D3) — only the legal target statuses are mirrored here (not the required RBAC action per
 * transition); the backend's own `AuthorizationService.assertAllowed()` call remains the
 * authoritative check either way, and a caller without the real grant still gets a clean 403,
 * shown via the same `parseApiErrorMessage()` allowlist every mutation in this app uses.
 * `superseded`/`archived` are both terminal (empty target lists).
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<PersonaApprovalStatus, readonly PersonaApprovalStatus[]>
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
 *  `ServiceStatusActions.ACTION_LABEL`/`ProjectStatusActions.ACTION_LABEL` establish. */
const ACTION_LABEL: Readonly<Record<PersonaApprovalStatus, string>> = {
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
 *  transition confirms" precedent `ServiceStatusActions`/`ProjectStatusActions` already establish —
 *  not every negative-sounding transition (`rejected` remains fully recoverable:
 *  `rejected -> draft` and `-> archived` are both still legal, so it gets no confirmation). */
const CONFIRM_MESSAGE: Partial<Record<PersonaApprovalStatus, string>> = {
  archived: "Archive this persona? Archived personas can't be reactivated.",
  superseded: "Mark this persona as superseded? Superseded personas can't be reactivated.",
};

/**
 * Status-transition actions for the persona detail page's header — the real 8-value
 * `approvalStatus` workflow, reused verbatim from Service Library's own. No approved design brief
 * names an `ApprovalBlock` component for this module (unlike Service Library's own), and the same
 * reasoning that kept `ServiceStatusActions` from using it applies identically here:
 * `changePersonaApprovalStatusSchema` accepts only `{approvalStatus}`, no submitter/reviewer
 * identity or rejection/revision reason, so a component expecting that data would need to
 * fabricate it. Renders only the transitions `POST /persona-library/personas/:id/status` would
 * actually accept from the persona's current status, so an invalid-transition response is
 * unreachable through this UI in normal use.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern
 * `ServiceStatusActions`/`ProjectStatusActions`/`BusinessKnowledgeStatusActions` already use.
 */
export function PersonaStatusActions({
  personaId,
  approvalStatus: initialStatus,
}: PersonaStatusActionsProps): ReactNode {
  const router = useRouter();
  const [approvalStatus, setApprovalStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PersonaApprovalStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[approvalStatus] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: PersonaApprovalStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/persona-library/personas/${personaId}/status`,
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
      // Same batched-render pattern ServiceStatusActions/ProjectStatusActions use: update the
      // rendered button set from the just-confirmed transition immediately, rather than waiting
      // on router.refresh() to reconcile it, so buttons never re-enable against the stale
      // pre-transition status.
      setApprovalStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change persona approval status", err);
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
