"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PageLifecycleStage } from "@webdesk/shared-types";
import { postMutation } from "../lib/api-errors";
import {
  allowedLifecycleTargets,
  LIFECYCLE_REASON_REQUIRED,
  LIFECYCLE_STAGE_LABEL,
} from "../lib/page-workspace-query";
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
  const [currentStage, setCurrentStage] = useState(stage);
  const [currentPrevious, setCurrentPrevious] = useState(previousStage);

  // Resync when the server sends a newer value (e.g. after another action's refresh).
  useEffect(() => {
    setCurrentStage(stage);
    setCurrentPrevious(previousStage);
  }, [stage, previousStage]);

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
      `/page-workspace/projects/${projectId}/pages/${pageId}/lifecycle`,
      { stage: next, ...(reason ? { reason } : {}) },
    );
    if (!result.ok) {
      setError(result.message ?? "Could not change the lifecycle stage.");
      setBusy(false);
      return;
    }
    setCurrentStage(next);
    setCurrentPrevious(next === currentStage ? currentPrevious : null);
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
