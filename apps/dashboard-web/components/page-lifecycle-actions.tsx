"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PageLifecycleStage } from "@webdesk/shared-types";
import { getApiBaseUrl } from "../lib/auth";
import { postMutation } from "../lib/api-errors";
import {
  allowedLifecycleTargets,
  INTERRUPT_STAGES,
  LIFECYCLE_REASON_REQUIRED,
  LIFECYCLE_STAGE_LABEL,
  workspaceApiPath,
} from "../lib/page-workspace-query";
import { useSyncedState } from "../lib/use-synced-state";
import styles from "./page-artifact-panel.module.css";

export interface PageLifecycleActionsProps {
  readonly projectId: string;
  readonly pageId: string;
  readonly stage: PageLifecycleStage;
  readonly previousStage: PageLifecycleStage | null;
}

/**
 * The page's delivery-lifecycle transition control.
 *
 * Roadmap row 12 is explicit that nothing advances a stage as a side effect — this is the only
 * control in the UI that moves it, and every press is a single, deliberate, separately
 * permission-checked call. Only transitions legal from the current stage are offered, including
 * the dynamic "resume" edge back to whatever `lifecyclePreviousStage` recorded.
 */
export function PageLifecycleActions({
  projectId,
  pageId,
  stage,
  previousStage,
}: PageLifecycleActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local mirror so the button set re-renders in the same batch that re-enables it, rather than
  // waiting on router.refresh() to land — the race a Projects code review caught once already.
  // useSyncedState() resyncs each from its own prop whenever the server sends a newer value (e.g.
  // after another action's refresh) — reused rather than hand-rolled a 6th/7th time (code-review
  // finding, `dashboard-web-page-workspace`).
  const [currentStage, setCurrentStage] = useSyncedState(stage);
  const [currentPrevious, setCurrentPrevious] = useSyncedState(previousStage);

  const targets = allowedLifecycleTargets(currentStage, currentPrevious);
  if (targets.length === 0) {
    return null;
  }

  async function moveTo(next: PageLifecycleStage) {
    let reason: string | null = null;
    if (LIFECYCLE_REASON_REQUIRED.includes(next)) {
      reason = window.prompt(`Reason for "${LIFECYCLE_STAGE_LABEL[next]}"?`);
      if (!reason || !reason.trim()) return;
    }

    setBusy(true);
    setError(null);
    const result = await postMutation(
      `${getApiBaseUrl()}${workspaceApiPath(projectId, pageId)}/lifecycle`,
      { stage: next, ...(reason ? { reason } : {}) },
    );
    if (!result.ok) {
      setError(result.message ?? "Could not change the lifecycle stage.");
      setBusy(false);
      return;
    }
    // Mirrors the backend's own nextPreviousStage(): entering an interrupt stage records where the
    // page is resuming FROM — carrying the existing currentPrevious forward if it was already
    // interrupted (so a chain of interrupts never loses the original resume point), or capturing
    // the stage just left otherwise. Leaving the interrupt set entirely clears it. The prior
    // `next === currentStage` check was dead code (no legal transition ever targets the stage
    // being left), so currentPrevious was unconditionally cleared here — code-review finding,
    // `dashboard-web-page-workspace`.
    const leavingStage = currentStage;
    setCurrentStage(next);
    setCurrentPrevious(
      INTERRUPT_STAGES.includes(next)
        ? INTERRUPT_STAGES.includes(leavingStage)
          ? currentPrevious
          : leavingStage
        : null,
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className={styles.actions}>
        {targets.map((target) => (
          <button
            key={target}
            type="button"
            className={styles.actionButton}
            onClick={() => moveTo(target)}
            disabled={busy}
          >
            {LIFECYCLE_STAGE_LABEL[target]}
          </button>
        ))}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
