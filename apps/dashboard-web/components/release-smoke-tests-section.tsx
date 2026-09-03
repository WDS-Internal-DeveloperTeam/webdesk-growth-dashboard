"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, DeploymentEnvironment, SmokeTest } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format-timestamp";
import styles from "./release-smoke-tests-section.module.css";

export interface ReleaseSmokeTestsSectionProps {
  readonly projectId: string;
  readonly releaseId: string;
  readonly initialSmokeTests: readonly SmokeTest[];
  /** Hides the add form once the parent release is `completed`/`rolled_back` — a UX nicety only;
   *  the backend independently rejects the create outright once the release reaches either
   *  status. */
  readonly creationBlocked: boolean;
}

interface SmokeTestFormValues {
  readonly environment: DeploymentEnvironment;
  readonly name: string;
  readonly result: "passed" | "failed";
  readonly ranAt: string;
  readonly notes: string;
}

function emptyForm(): SmokeTestFormValues {
  return { environment: "staging", name: "", result: "passed", ranAt: "", notes: "" };
}

// Mirrors apps/dashboard-api/src/release-center/release-center.dto.ts's createSmokeTestSchema.
const NAME_MAX_LENGTH = 255;
const NOTES_MAX_LENGTH = 10_000;

/**
 * `smoke_tests` editing — append-only, the backend exposes no update/delete route at all, matching
 * `ScanEvidenceSection`'s/`ReleaseDeploymentsSection`'s own identical append-only shape. `ranAt` is
 * an optional `datetime-local` input, omitted entirely (not sent as `null`) when left blank, so the
 * backend defaults it to `now()` at the database layer, matching `createSmokeTestSchema`'s own
 * `.optional()` contract for this field — same convention `ReleaseDeploymentsSection` already
 * establishes for `deployedAt`.
 */
export function ReleaseSmokeTestsSection({
  projectId,
  releaseId,
  initialSmokeTests,
  creationBlocked,
}: ReleaseSmokeTestsSectionProps): ReactNode {
  const [smokeTests, setSmokeTests] = useState(initialSmokeTests);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<SmokeTestFormValues>(emptyForm());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSmokeTests(initialSmokeTests);
  }, [initialSmokeTests]);

  const basePath = `${getApiBaseUrl()}/release-center/projects/${projectId}/releases/${releaseId}/smoke-tests`;

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = values.name.trim();
    if (!name) {
      setError("A name is required for each smoke test.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: values.environment,
          name,
          result: values.result,
          ranAt: values.ranAt ? new Date(values.ranAt).toISOString() : undefined,
          notes: values.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<SmokeTest>;
      setSmokeTests((current) => [...current, body.data]);
      setValues(emptyForm());
    } catch (err) {
      console.error("Failed to record smoke test result", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {smokeTests.length === 0 ? (
        <p className={styles.muted}>No smoke tests recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {smokeTests.map((smokeTest) => (
            <li key={smokeTest.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.primaryText}>
                  {smokeTest.name}
                  {" — "}
                  {smokeTest.environment === "staging" ? "Staging" : "Production"}
                  {" — "}
                  <span
                    className={
                      smokeTest.result === "passed" ? styles.resultOk : styles.resultFailed
                    }
                  >
                    {smokeTest.result === "passed" ? "Passed" : "Failed"}
                  </span>
                </span>
                <span className={styles.secondaryText}>{formatTimestamp(smokeTest.ranAt)}</span>
                {smokeTest.notes ? (
                  <span className={styles.secondaryText}>{smokeTest.notes}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!creationBlocked ? (
        <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
          <p className={styles.addFormTitle}>Record a smoke-test result</p>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="new-smoke-test-name" className={styles.label}>
                Name
              </label>
              <input
                id="new-smoke-test-name"
                type="text"
                maxLength={NAME_MAX_LENGTH}
                value={values.name}
                onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="new-smoke-test-environment" className={styles.label}>
                Environment
              </label>
              <select
                id="new-smoke-test-environment"
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
              <label htmlFor="new-smoke-test-result" className={styles.label}>
                Result
              </label>
              <select
                id="new-smoke-test-result"
                value={values.result}
                onChange={(event) =>
                  setValues((v) => ({ ...v, result: event.target.value as "passed" | "failed" }))
                }
                className={styles.select}
              >
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="new-smoke-test-ran-at" className={styles.label}>
                Ran at
              </label>
              <input
                id="new-smoke-test-ran-at"
                type="datetime-local"
                value={values.ranAt}
                onChange={(event) => setValues((v) => ({ ...v, ranAt: event.target.value }))}
                className={styles.input}
              />
              <span className={styles.helperText}>Defaults to now if left blank.</span>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="new-smoke-test-notes" className={styles.label}>
              Notes
            </label>
            <textarea
              id="new-smoke-test-notes"
              maxLength={NOTES_MAX_LENGTH}
              value={values.notes}
              onChange={(event) => setValues((v) => ({ ...v, notes: event.target.value }))}
              className={styles.textarea}
              rows={2}
            />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton} disabled={adding}>
              {adding ? "Recording…" : "Record result"}
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
