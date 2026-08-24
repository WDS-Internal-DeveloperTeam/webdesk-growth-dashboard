"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { InternalLinkStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./internal-link-status-actions.module.css";

export interface InternalLinkStatusActionsProps {
  readonly projectId: string;
  readonly linkId: string;
  readonly status: InternalLinkStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/internal-linking-library/internal-links.service.ts` — kept in sync by
 * hand, same approach every sibling status-actions component in this app already uses. Only the
 * legal target statuses are mirrored here (not the required RBAC action per transition, which
 * varies dynamically per status — `InternalLinksService.changeStatus()`'s own
 * `AuthorizationService.assertAllowed()` call remains the authoritative check either way; a caller
 * without the real grant still gets a clean 403, shown via the same `parseApiErrorMessage()`
 * allowlist every mutation in this app uses).
 *
 * Unlike every sibling status-actions component (which each mirror the shared 8-value
 * `ArtifactApprovalStatus` workflow, with a real terminal state — `archived`/`superseded`), this
 * module's own 4-state workflow has NO terminal state — every status has at least one valid
 * outbound transition. No `window.confirm()` guard is used anywhere here (unlike every sibling
 * component's own irreversible-transition confirmation), since no transition in this workflow is
 * irreversible — a link can always be moved back a step.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<InternalLinkStatus, readonly InternalLinkStatus[]>> = {
  proposed: ["approved"],
  approved: ["implemented", "proposed"],
  implemented: ["verified", "approved"],
  verified: ["implemented"],
};

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<InternalLinkStatus, string>> = {
  proposed: "Revert to Proposed",
  approved: "Approve",
  implemented: "Mark as Implemented",
  verified: "Mark as Verified",
};

/**
 * Status-transition actions for the internal link detail page's header — a genuinely bespoke
 * 4-state workflow (task package D1/D2), NOT the shared 8-value `ArtifactApprovalStatus` every
 * prior module reuses. No approved design brief names an `ApprovalBlock` component for this
 * module, and the same reasoning that kept every sibling status-actions component from using it
 * applies identically here: `changeInternalLinkStatusSchema` accepts only `{status}`, no
 * submitter/reviewer identity or rejection/revision reason, so a component expecting that data
 * would need to fabricate it.
 *
 * The route is project-scoped (`internal-linking-library/projects/:projectId/links/:id/status`) —
 * `projectId` is a required prop, threaded into the URL, matching `PageStatusActions`'s/
 * `KeywordStatusActions`'s own project-scoped shape. Renders only the transitions the backend
 * would actually accept from the link's current status, so an invalid-transition response is
 * unreachable through this UI in normal use. Submits via a direct browser `fetch()` with
 * `credentials: "include"` — required for `dashboard-api`'s `OriginCheckGuard` to see a real
 * browser `Origin` header.
 */
export function InternalLinkStatusActions({
  projectId,
  linkId,
  status: initialStatus,
}: InternalLinkStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<InternalLinkStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: InternalLinkStatus): Promise<void> {
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/internal-linking-library/projects/${projectId}/links/${linkId}/status`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
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
      router.refresh();
    } catch (err) {
      console.error("Failed to change internal link status", err);
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
          className={styles.actionButton}
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
