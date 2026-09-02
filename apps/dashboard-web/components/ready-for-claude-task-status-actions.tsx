"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ReadyForClaudeTask, ReadyForClaudeTaskStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./ready-for-claude-task-status-actions.module.css";

export interface ReadyForClaudeTaskStatusActionsProps {
  readonly taskId: string;
  readonly status: ReadyForClaudeTaskStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/ready-for-claude-queue/ready-for-claude-tasks.service.ts` — kept in sync
 * by hand, the same convention every sibling status-actions component in this app already uses.
 * Only the legal target statuses are mirrored here (not the required RBAC action per transition,
 * which varies dynamically — `submit`/`edit`/`review`/`approve`, per the real seeded
 * `ready_for_claude` RBAC row). `ReadyForClaudeTasksService.changeStatus()`'s own
 * `AuthorizationService.assertAllowed()` call remains the sole authoritative check either way; a
 * caller without the real grant still gets a clean 403, shown via the same
 * `parseApiErrorMessage()`/`postMutation()` allowlist every mutation in this app uses.
 *
 * `completed`/`cancelled`/`failed` are TERMINAL — no outbound transition exists from any of them,
 * so this component renders nothing once `status` reaches one, matching every sibling
 * status-actions component's own self-hiding convention for a terminal state.
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<ReadyForClaudeTaskStatus, readonly ReadyForClaudeTaskStatus[]>
> = {
  draft: ["ready_for_claude", "cancelled"],
  ready_for_claude: ["claimed", "cancelled"],
  claimed: ["in_progress", "cancelled"],
  in_progress: ["paused", "failed", "awaiting_review"],
  paused: ["in_progress"],
  awaiting_review: ["changes_requested", "approved"],
  changes_requested: ["ready_for_claude"],
  approved: ["completed"],
  completed: [],
  cancelled: [],
  failed: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<ReadyForClaudeTaskStatus, string>> = {
  draft: "Back to Draft",
  ready_for_claude: "Mark Ready for Claude",
  claimed: "Claim",
  in_progress: "Start",
  awaiting_review: "Submit for Review",
  changes_requested: "Request Changes",
  approved: "Approve",
  completed: "Complete",
  cancelled: "Cancel",
  paused: "Pause",
  failed: "Mark Failed",
};

/** Only `cancelled` prompts a confirmation — the one transition genuinely destructive to a task's
 *  own forward progress (every other transition either advances the workflow or, for `paused ->
 *  in_progress`/`changes_requested -> ready_for_claude`, is a normal, reversible re-entry into an
 *  earlier stage). Matches `ProjectStatusActions`'s own "confirm only the transition the state
 *  machine can never reverse" precedent — `cancelled` is TERMINAL here, unlike a project's own
 *  `archived`, but the same reasoning applies. */
const CONFIRM_STATUSES: ReadonlySet<ReadyForClaudeTaskStatus> = new Set(["cancelled"]);

/**
 * Status-transition actions for the Ready for Claude task detail page — a genuinely bespoke
 * 11-state workflow (D4), NOT the shared 8-value `ArtifactApprovalStatus` every content-library
 * module reuses, and a DIFFERENT bespoke shape than Internal Linking Library's own 4-state
 * workflow. No approved design brief names an `ApprovalBlock` component for this module, and the
 * same reasoning that already kept every sibling status-actions component from using it applies
 * identically here: `changeReadyForClaudeTaskStatusSchema` accepts only `{status, expectedStatus}`,
 * no submitter/reviewer identity or rejection/revision reason.
 *
 * Unlike `InternalLinkStatusActions`'s `{status}`-only body, this module's own status route
 * REQUIRES `expectedStatus` too — threaded straight into the repository's atomic compare-and-swap,
 * so a caller acting on a stale view of the task gets a clean 409 instead of silently overwriting
 * a transition someone else already made. `status` is re-synced from the server-passed prop via
 * `useSyncedState()`, matching `ReviewDecisionActions`'s/`ContentTemplateStatusActions`'s own
 * precedent — this detail page has no sibling process-actions component that could itself trigger
 * a concurrent change, but staying consistent with the shared hook costs nothing and protects
 * against any future addition that does.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — the same pattern every mutation component in this app already uses.
 */
export function ReadyForClaudeTaskStatusActions({
  taskId,
  status: initialStatus,
}: ReadyForClaudeTaskStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ReadyForClaudeTaskStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: ReadyForClaudeTaskStatus): Promise<void> {
    if (CONFIRM_STATUSES.has(nextStatus)) {
      const confirmed = window.confirm(
        `${ACTION_LABEL[nextStatus]} this task? This cannot be undone.`,
      );
      if (!confirmed) {
        return;
      }
    }

    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation<ReadyForClaudeTask>(
        `${getApiBaseUrl()}/ready-for-claude-queue/tasks/${taskId}/status`,
        { status: nextStatus, expectedStatus: status },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update the
      // rendered button set from the just-confirmed transition immediately, from the LOCALLY
      // KNOWN target status (never `result.data.status`, which `postMutation()`'s own documented
      // contract says may not actually be present on a malformed/missing response body), rather
      // than waiting on router.refresh() to reconcile it.
      setStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change Ready for Claude task status", err);
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
          className={target === "cancelled" ? styles.terminalButton : styles.actionButton}
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
