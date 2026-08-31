"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ComponentApprovalStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./component-status-actions.module.css";

export interface ComponentStatusActionsProps {
  readonly recordId: string;
  readonly approvalStatus: ComponentApprovalStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/component-library/components.service.ts` — kept in sync by hand, same
 * approach `DesignTokenStatusActions`/`WebsiteStrategyStatusActions`/`ServiceStatusActions`/
 * `PersonaStatusActions`/`ProofClaimStatusActions` already use. This is the 6th independent
 * hand-copy of the shared 8-value artifact-approval-status pattern — accepted, tracked debt, same
 * as the prior 5.
 *
 * DELIBERATE DIVERGENCE, identical to `DesignTokenStatusActions`'s own: `approved`'s target list
 * here is `["archived"]` ONLY, not `["superseded", "archived"]`. The backend's own `TRANSITIONS`
 * table has no `approved -> superseded` edge for this module — "supersede" is never a distinct
 * user action here; it only ever happens as an automatic side effect of a DIFFERENT version's own
 * `-> approved` transition succeeding (`ComponentsService.changeApprovalStatus()`'s own doc
 * comment explains why a direct `approved -> superseded` request would otherwise be a real bug).
 * Mirroring that here too, rather than leaving the stale `superseded` target in, keeps this
 * component from ever rendering a button whose own click would 400.
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<ComponentApprovalStatus, readonly ComponentApprovalStatus[]>
> = {
  draft: ["submitted", "archived"],
  submitted: ["under_review", "draft", "archived"],
  under_review: ["approved", "revision_requested", "rejected", "archived"],
  revision_requested: ["draft", "submitted", "archived"],
  approved: ["archived"],
  rejected: ["draft", "archived"],
  superseded: [],
  archived: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention
 *  `DesignTokenStatusActions.ACTION_LABEL`/`WebsiteStrategyStatusActions.ACTION_LABEL` establish.
 *  No "Mark as Superseded" entry — unreachable through this UI (see this file's own top doc
 *  comment), unlike the sibling copies of this map, which still carry one for their own reachable
 *  `approved -> superseded` transition. */
const ACTION_LABEL: Readonly<Record<ComponentApprovalStatus, string>> = {
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
 *  `archived` here, since `superseded` is unreachable through this UI) prompt a confirmation,
 *  matching the identical "only the irreversible transition confirms" precedent
 *  `DesignTokenStatusActions`/`WebsiteStrategyStatusActions`/`PersonaStatusActions`/
 *  `ServiceStatusActions` already establish. No `superseded` entry — the map that carries it on
 *  the sibling copies would be dead code here. */
const CONFIRM_MESSAGE: Partial<Record<ComponentApprovalStatus, string>> = {
  archived: "Archive this component? Archived components can't be reactivated.",
};

/**
 * Status-transition actions for the Component Library detail page's header — the real 8-value
 * `approvalStatus` workflow, reused verbatim from Design Token Library's/Website Strategy Center's/
 * Service Library's/Persona Library's/Proof and Claims Library's own (minus the one
 * `approved -> superseded` edge this module's backend doesn't allow — see this file's own top doc
 * comment). No approved design brief names an `ApprovalBlock` component for this module, and the
 * same reasoning that kept the sibling status-actions components from using it applies identically
 * here: `changeComponentApprovalStatusSchema` accepts only `{approvalStatus}`, no submitter/
 * reviewer identity or rejection/revision reason, so a component expecting that data would need to
 * fabricate it. Renders only the transitions `POST /component-library/components/:recordId/status`
 * would actually accept from the record's current status, so an invalid-transition response is
 * unreachable through this UI in normal use.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern every
 * sibling status-actions component already uses.
 */
export function ComponentStatusActions({
  recordId,
  approvalStatus: initialStatus,
}: ComponentStatusActionsProps): ReactNode {
  const router = useRouter();
  const [approvalStatus, setApprovalStatus] = useSyncedState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ComponentApprovalStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[approvalStatus] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: ComponentApprovalStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/component-library/components/${recordId}/status`,
        { approvalStatus: nextStatus },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern DesignTokenStatusActions/WebsiteStrategyStatusActions/
      // PersonaStatusActions/ServiceStatusActions/ProjectStatusActions use: update the rendered
      // button set from the just-confirmed transition immediately, rather than waiting on
      // router.refresh() to reconcile it, so buttons never re-enable against the stale
      // pre-transition status.
      setApprovalStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change component approval status", err);
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
