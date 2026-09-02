"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ScanRun } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { withProjectId } from "@/lib/project-scoped-href";
import styles from "./trigger-scan-run-button.module.css";

export interface TriggerScanRunButtonProps {
  readonly projectId: string;
  readonly scanDefinitionId: string;
  readonly isEnabled: boolean;
}

/**
 * A single-purpose action on the scan definition detail page: `POST .../runs` with a fresh,
 * locally-generated `publicId` (no natural caller-supplied identifier exists for a run, the same
 * reasoning `ScanRunsService.changeStatus()`'s own `FND-${randomUUID()}` finding-publicId
 * generation already establishes for scan findings) and `triggerType: "manual"` (the only trigger
 * type a human clicking a button in this UI can ever produce — `scheduled` is reserved for a
 * future real scheduler this codebase doesn't have yet). On success, navigates straight to the new
 * run's own detail page, where its status-transition actions live.
 *
 * Disabled (with an explanatory note, not hidden) when the definition itself is disabled —
 * `ScanRunsService.create()` rejects a request against a disabled definition with a clean 400, but
 * surfacing that as an inert-and-explained button is more honest than letting a caller submit a
 * request only to see it rejected.
 */
export function TriggerScanRunButton({
  projectId,
  scanDefinitionId,
  isEnabled,
}: TriggerScanRunButtonProps): ReactNode {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const result = await postMutation<ScanRun>(
        `${getApiBaseUrl()}/scan-center/projects/${projectId}/runs`,
        {
          scanDefinitionId,
          publicId: `RUN-${crypto.randomUUID()}`,
          triggerType: "manual",
        },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (!result.data?.id) {
        setError("The scan run was created, but its details couldn't be loaded. Please refresh.");
        return;
      }
      router.push(withProjectId(`/scan-center/runs/${result.data.id}`, projectId));
    } catch (err) {
      console.error("Failed to trigger scan run", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        disabled={!isEnabled || submitting}
        onClick={() => void handleClick()}
        className={styles.actionButton}
      >
        {submitting ? "Starting…" : "Trigger scan run"}
      </button>
      {!isEnabled ? (
        <span className={styles.helperText}>Enable this definition first to trigger a run.</span>
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
