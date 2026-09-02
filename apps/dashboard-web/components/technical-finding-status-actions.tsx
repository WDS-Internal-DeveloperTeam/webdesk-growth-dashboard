"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { TechnicalFinding, TechnicalFindingStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./technical-finding-status-actions.module.css";

export interface TechnicalFindingStatusActionsProps {
  readonly projectId: string;
  readonly findingId: string;
  readonly status: TechnicalFindingStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/technical-center/technical-findings.service.ts` — kept in sync by hand,
 * the same convention every sibling status-actions component in this app already uses (this one
 * is byte-for-byte identical to `ScanFindingStatusActions`' own `ALLOWED_TRANSITIONS`, since both
 * backends share the identical disposition-lifecycle shape). Only the legal target statuses are
 * mirrored here (the required RBAC action — `review` for every real transition here — is checked
 * dynamically server-side, matching `TechnicalCheckRunStatusActions`'/`ScanFindingStatusActions`'
 * own identical layered-guard reasoning).
 *
 * `resolved`/`dismissed` are both TERMINAL — findings, once disposed, are not reopened in this
 * pass, so this component renders nothing once `status` reaches either.
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<TechnicalFindingStatus, readonly TechnicalFindingStatus[]>
> = {
  open: ["acknowledged", "resolved", "dismissed"],
  acknowledged: ["open", "resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<TechnicalFindingStatus, string>> = {
  open: "Reopen",
  acknowledged: "Acknowledge",
  resolved: "Resolve",
  dismissed: "Dismiss",
};

/** `resolved`/`dismissed` are both terminal — the one transition genuinely irreversible in this
 *  4-state workflow — so both get a confirmation, matching `ScanFindingStatusActions`'/
 *  `ProjectStatusActions`' own "confirm only the transition the state machine can never reverse"
 *  precedent. */
const CONFIRM_STATUSES: ReadonlySet<TechnicalFindingStatus> = new Set(["resolved", "dismissed"]);

/**
 * Status-transition actions for the technical finding detail page's header — a bespoke 4-state
 * disposition lifecycle (see `ALLOWED_TRANSITIONS`' own doc comment), NOT the shared 8-value
 * `ArtifactApprovalStatus` every content-library module reuses. No approved design brief names an
 * `ApprovalBlock` component for this module, and the same reasoning that already keeps
 * `ScanFindingStatusActions` from using it applies here: `changeTechnicalFindingStatusSchema`
 * accepts only `{status}`, no submitter/reviewer identity or rejection/revision reason.
 *
 * `status` is re-synced from the server-passed prop via `useSyncedState()`, matching every module
 * built after 2026-08-27. Submits via `postMutation()` (`credentials: "include"`, required for
 * `dashboard-api`'s `OriginCheckGuard`) — `POST .../findings/:id/status`.
 */
export function TechnicalFindingStatusActions({
  projectId,
  findingId,
  status: initialStatus,
}: TechnicalFindingStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<TechnicalFindingStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: TechnicalFindingStatus): Promise<void> {
    if (CONFIRM_STATUSES.has(nextStatus)) {
      const confirmed = window.confirm(`${ACTION_LABEL[nextStatus]} this finding?`);
      if (!confirmed) {
        return;
      }
    }

    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation<TechnicalFinding>(
        `${getApiBaseUrl()}/technical-center/projects/${projectId}/findings/${findingId}/status`,
        { status: nextStatus },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update the
      // rendered button set from the just-confirmed transition immediately, from the LOCALLY
      // KNOWN target status, rather than waiting on router.refresh() to reconcile it.
      setStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change technical finding status", err);
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
            target === "resolved" || target === "dismissed"
              ? styles.terminalButton
              : styles.actionButton
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
