"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, Deployment, DeploymentEnvironment } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format-timestamp";
import styles from "./release-deployments-section.module.css";

export interface ReleaseDeploymentsSectionProps {
  readonly projectId: string;
  readonly releaseId: string;
  readonly initialDeployments: readonly Deployment[];
  /** Hides the add form once the parent release is `completed`/`rolled_back` — a UX nicety only;
   *  the backend independently rejects the create outright once the release reaches either
   *  status. */
  readonly creationBlocked: boolean;
}

interface DeploymentFormValues {
  readonly environment: DeploymentEnvironment;
  readonly outcome: "succeeded" | "failed";
  readonly deployedAt: string;
  readonly notes: string;
}

function emptyForm(): DeploymentFormValues {
  return { environment: "staging", outcome: "succeeded", deployedAt: "", notes: "" };
}

// Mirrors apps/dashboard-api/src/release-center/release-center.dto.ts's createDeploymentSchema.
const NOTES_MAX_LENGTH = 10_000;

/**
 * `deployments` editing — append-only (`DeploymentEntity`'s own doc comment: real re-deploys are
 * possible even after `Release.stagingDeployedAt`/`productionDeployedAt` are first stamped, so this
 * table records every attempt): the backend exposes no update/delete route at all, matching
 * `ScanEvidenceSection`'s own identical append-only shape, which this component's structure mirrors
 * directly. `deployedAt` is an optional `datetime-local` input, converted to a full ISO datetime
 * string before submit; omitted entirely (not sent as `null`) when left blank, so the backend
 * defaults it to `now()` at the database layer, matching `createDeploymentSchema`'s own
 * `.optional()` (not `.nullish()`) contract for this one field.
 */
export function ReleaseDeploymentsSection({
  projectId,
  releaseId,
  initialDeployments,
  creationBlocked,
}: ReleaseDeploymentsSectionProps): ReactNode {
  const [deployments, setDeployments] = useState(initialDeployments);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<DeploymentFormValues>(emptyForm());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setDeployments(initialDeployments);
  }, [initialDeployments]);

  const basePath = `${getApiBaseUrl()}/release-center/projects/${projectId}/releases/${releaseId}/deployments`;

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: values.environment,
          outcome: values.outcome,
          deployedAt: values.deployedAt ? new Date(values.deployedAt).toISOString() : undefined,
          notes: values.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<Deployment>;
      setDeployments((current) => [...current, body.data]);
      setValues(emptyForm());
    } catch (err) {
      console.error("Failed to record deployment", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {deployments.length === 0 ? (
        <p className={styles.muted}>No deploy attempts recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {deployments.map((deployment) => (
            <li key={deployment.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.primaryText}>
                  {deployment.environment === "staging" ? "Staging" : "Production"}
                  {" — "}
                  <span
                    className={
                      deployment.outcome === "succeeded" ? styles.outcomeOk : styles.outcomeFailed
                    }
                  >
                    {deployment.outcome === "succeeded" ? "Succeeded" : "Failed"}
                  </span>
                </span>
                <span className={styles.secondaryText}>
                  {formatTimestamp(deployment.deployedAt)}
                </span>
                {deployment.notes ? (
                  <span className={styles.secondaryText}>{deployment.notes}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!creationBlocked ? (
        <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
          <p className={styles.addFormTitle}>Record a deploy attempt</p>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="new-deployment-environment" className={styles.label}>
                Environment
              </label>
              <select
                id="new-deployment-environment"
                value={values.environment}
                onChange={(event) =>
                  setValues((v) => ({
                    ...v,
                    environment: event.target.value as DeploymentEnvironment,
                  }))
                }
                className={styles.select}
              >
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="new-deployment-outcome" className={styles.label}>
                Outcome
              </label>
              <select
                id="new-deployment-outcome"
                value={values.outcome}
                onChange={(event) =>
                  setValues((v) => ({
                    ...v,
                    outcome: event.target.value as "succeeded" | "failed",
                  }))
                }
                className={styles.select}
              >
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="new-deployment-deployed-at" className={styles.label}>
                Deployed at
              </label>
              <input
                id="new-deployment-deployed-at"
                type="datetime-local"
                value={values.deployedAt}
                onChange={(event) => setValues((v) => ({ ...v, deployedAt: event.target.value }))}
                className={styles.input}
              />
              <span className={styles.helperText}>Defaults to now if left blank.</span>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="new-deployment-notes" className={styles.label}>
              Notes
            </label>
            <textarea
              id="new-deployment-notes"
              maxLength={NOTES_MAX_LENGTH}
              value={values.notes}
              onChange={(event) => setValues((v) => ({ ...v, notes: event.target.value }))}
              className={styles.textarea}
              rows={2}
            />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton} disabled={adding}>
              {adding ? "Recording…" : "Record deploy attempt"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
