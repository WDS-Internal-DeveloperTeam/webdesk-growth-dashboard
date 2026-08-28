"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { AssetApprovalStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./asset-library-status-actions.module.css";

export interface AssetLibraryStatusActionsProps {
  readonly assetId: string;
  readonly approvalStatus: AssetApprovalStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in `apps/dashboard-api/src/asset-library/assets.service.ts` —
 * kept in sync by hand, the same approach `BrandLibraryStatusActions`/`ContentTemplateStatusActions`/
 * `PersonaStatusActions`/`ServiceStatusActions`/`ProjectStatusActions`/`BusinessKnowledgeStatusActions`
 * already use. Reused verbatim from Brand Library's own identical 8-state workflow, since the
 * backend's own `TRANSITIONS` table is itself a direct copy (`docs/implementation/module-asset-library.md`
 * D5) — only the legal target statuses are mirrored here (not the required RBAC action per
 * transition); the backend's own `AuthorizationService.assertAllowed()` call remains the
 * authoritative check either way, and a caller without the real grant still gets a clean 403,
 * shown via the same `parseApiErrorMessage()` allowlist every mutation in this app uses.
 * `superseded`/`archived` are both terminal (empty target lists).
 *
 * This is now the 7th independent hand-copy of this exact pattern — accepted, tracked debt, same
 * reasoning each prior copy already records for itself (a real fix means the backend's own GET
 * response computing and returning legal next transitions, a larger architectural change out of
 * scope for a single module's own build).
 */
const ALLOWED_TRANSITIONS: Readonly<Record<AssetApprovalStatus, readonly AssetApprovalStatus[]>> = {
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
 *  sibling `*StatusActions` component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<AssetApprovalStatus, string>> = {
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
 *  transition confirms" precedent every sibling `*StatusActions` component already establishes. */
const CONFIRM_MESSAGE: Partial<Record<AssetApprovalStatus, string>> = {
  archived: "Archive this asset? Archived assets can't be reactivated.",
  superseded: "Mark this asset as superseded? Superseded assets can't be reactivated.",
};

/**
 * Status-transition actions for the asset detail page's header — the real 8-value `approvalStatus`
 * workflow, reused verbatim from Brand Library's own. No approved design brief names an
 * `ApprovalBlock` component for this module, and the same reasoning that kept every sibling
 * `*StatusActions` component from using it applies identically here:
 * `changeAssetApprovalStatusSchema` accepts only `{approvalStatus}`, no submitter/reviewer identity
 * or rejection/revision reason, so a component expecting that data would need to fabricate it.
 * Renders only the transitions `POST .../:id/status` would actually accept from the asset's current
 * status, so an invalid-transition response is unreachable through this UI in normal use.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern every
 * mutation in this app already uses.
 */
export function AssetLibraryStatusActions({
  assetId,
  approvalStatus: initialStatus,
}: AssetLibraryStatusActionsProps): ReactNode {
  const router = useRouter();
  // useSyncedState re-syncs from the server-passed prop whenever it changes — without this, a
  // transition made via a second tab/operator, or a status-independent change on the same page
  // (e.g. the sibling AssetLibraryPublishActions component's own router.refresh()), would go
  // unreflected here until this component's own next successful transition. Does not fire on this
  // component's own optimistic setApprovalStatus() call below, since that already matches the
  // prop's next value once router.refresh() resolves.
  const [approvalStatus, setApprovalStatus] = useSyncedState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AssetApprovalStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[approvalStatus] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: AssetApprovalStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/asset-library/assets/${assetId}/status`,
        {
          approvalStatus: nextStatus,
        },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern every sibling *StatusActions component uses: update the
      // rendered button set from the just-confirmed transition immediately, rather than waiting on
      // router.refresh() to reconcile it, so buttons never re-enable against the stale
      // pre-transition status.
      setApprovalStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change asset approval status", err);
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
