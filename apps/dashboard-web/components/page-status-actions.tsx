"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { PageWorkflowStage } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./page-status-actions.module.css";

export interface PageStatusActionsProps {
  readonly projectId: string;
  readonly pageId: string;
  readonly workflowStage: PageWorkflowStage;
}

/**
 * Mirrors the `TRANSITIONS` table in `apps/dashboard-api/src/page-inventory/pages.service.ts` —
 * kept in sync by hand, same approach `ServiceStatusActions`/`PersonaStatusActions`/
 * `ProofClaimStatusActions`/`WebsiteStrategyStatusActions` already use. This is the 5th independent
 * hand-copy of the shared 8-value artifact-approval-status pattern — accepted, tracked debt, same
 * as the prior 4. Only the legal target stages are mirrored here (not the required RBAC action per
 * transition, which varies dynamically per stage — `PagesService.changeWorkflowStage()`'s own
 * `AuthorizationService.assertAllowed()` call remains the authoritative check either way; a caller
 * without the real grant still gets a clean 403, shown via the same `parseApiErrorMessage()`
 * allowlist every mutation in this app uses). Unlike `WebsiteStrategyStatusActions`, this module's
 * own backend DOES allow a direct `approved -> superseded` transition (`TRANSITIONS.approved` in
 * `pages.service.ts`), matching Service/Persona/Proof-and-Claims Library's own original shape, not
 * Website Strategy Center's own deliberate divergence.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<PageWorkflowStage, readonly PageWorkflowStage[]>> = {
  draft: ["submitted", "archived"],
  submitted: ["under_review", "draft", "archived"],
  under_review: ["approved", "revision_requested", "rejected", "archived"],
  revision_requested: ["draft", "submitted", "archived"],
  approved: ["superseded", "archived"],
  rejected: ["draft", "archived"],
  superseded: [],
  archived: [],
};

/** Labels the action that REACHES the given stage, not the stage itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<PageWorkflowStage, string>> = {
  submitted: "Submit for Review",
  under_review: "Start Review",
  approved: "Approve",
  revision_requested: "Request Revision",
  rejected: "Reject",
  draft: "Revert to Draft",
  superseded: "Mark as Superseded",
  archived: "Archive",
};

/** Only transitions whose OWN target stage is terminal (an empty `ALLOWED_TRANSITIONS` entry —
 *  `superseded`/`archived`) prompt a confirmation, matching the identical "only the irreversible
 *  transition confirms" precedent every sibling status-actions component already establishes. */
const CONFIRM_MESSAGE: Partial<Record<PageWorkflowStage, string>> = {
  archived: "Archive this page? Archived pages can't be reactivated.",
  superseded: "Mark this page as superseded? Superseded pages can't be reactivated.",
};

/**
 * Workflow-stage-transition actions for the Page Inventory detail page's header — the real 8-value
 * `workflowStage` workflow, reused verbatim from Service/Persona/Proof-and-Claims Library's own
 * (task package D8). No approved design brief names an `ApprovalBlock` component for this module,
 * and the same reasoning that kept every sibling status-actions component from using it applies
 * identically here: `changePageWorkflowStageSchema` accepts only `{workflowStage}`, no
 * submitter/reviewer identity or rejection/revision reason, so a component expecting that data
 * would need to fabricate it.
 *
 * Unlike every sibling module, this endpoint is `POST .../workflow-stage` (not `.../status`), its
 * body field is `workflowStage` (not `approvalStatus`), and the route itself is project-scoped
 * (`page-inventory/projects/:projectId/pages/:pageId/workflow-stage`) — `projectId` is a required
 * prop here, threaded into the URL, since pages are the first project-scoped module built so far.
 *
 * Renders only the transitions the backend would actually accept from the page's current stage, so
 * an invalid-transition response is unreachable through this UI in normal use. Submits via a direct
 * browser `fetch()` with `credentials: "include"` — required for `dashboard-api`'s
 * `OriginCheckGuard` to see a real browser `Origin` header, same pattern every mutation form in this
 * app already uses.
 */
export function PageStatusActions({
  projectId,
  pageId,
  workflowStage: initialStage,
}: PageStatusActionsProps): ReactNode {
  const router = useRouter();
  const [workflowStage, setWorkflowStage] = useState(initialStage);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PageWorkflowStage | null>(null);

  const targets = ALLOWED_TRANSITIONS[workflowStage] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStage: PageWorkflowStage): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStage];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStage);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/page-inventory/projects/${projectId}/pages/${pageId}/workflow-stage`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowStage: nextStage }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update the
      // rendered button set from the just-confirmed transition immediately, rather than waiting on
      // router.refresh() to reconcile it, so buttons never re-enable against the stale
      // pre-transition stage.
      setWorkflowStage(nextStage);
      router.refresh();
    } catch (err) {
      console.error("Failed to change page workflow stage", err);
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
