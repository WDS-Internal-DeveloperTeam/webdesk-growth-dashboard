"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ScanFindingSeverity, ScanRun, ScanRunStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { SCAN_FINDING_SEVERITY_LABEL, SCAN_FINDING_SEVERITY_VALUES } from "@/lib/scan-center-query";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./scan-run-status-actions.module.css";

export interface ScanRunStatusActionsProps {
  readonly projectId: string;
  readonly runId: string;
  readonly status: ScanRunStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in `apps/dashboard-api/src/scan-center/scan-runs.service.ts` —
 * kept in sync by hand, the same convention every sibling status-actions component in this app
 * already uses. Only the legal target statuses are mirrored here (not the required RBAC action per
 * transition — every real transition here requires `edit`, checked dynamically server-side, since
 * the seeded `scans` RBAC group has no submit/review/approve letters to split by;
 * `ScanRunsService.changeStatus()`'s own `AuthorizationService.assertAllowed()` call remains the
 * sole authoritative check either way, and a caller without the real grant still gets a clean 403,
 * shown via the same `parseApiErrorMessage()`/`postMutation()` allowlist every mutation in this app
 * uses).
 *
 * Every terminal state (`completed`/`partially_completed`/`failed`/`timed_out`/`cancelled`) has no
 * outbound transition — unlike Internal Linking Library's own 4-state loop, this workflow really
 * does end, so this component renders nothing once `status` reaches one.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ScanRunStatus, readonly ScanRunStatus[]>> = {
  requested: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["completed", "partially_completed", "failed", "timed_out", "cancelled"],
  completed: [],
  partially_completed: [],
  failed: [],
  timed_out: [],
  cancelled: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<ScanRunStatus, string>> = {
  requested: "Reset to Requested",
  queued: "Queue",
  running: "Mark as Running",
  completed: "Mark Completed",
  partially_completed: "Mark Partially Completed",
  failed: "Mark Failed",
  timed_out: "Mark Timed Out",
  cancelled: "Cancel run",
};

/** `queued`/`running` submit immediately with no extra data — the run's own status is the only
 *  thing changing. `cancelled` also submits immediately (no extra data the backend accepts for
 *  it), but behind a confirmation, matching `ProjectStatusActions`'s/`ReadyForClaudeTaskStatusActions`'s
 *  own "confirm only the transition the state machine can never reverse" precedent — it's terminal
 *  here, with no way back. */
const CONFIRM_STATUSES: ReadonlySet<ScanRunStatus> = new Set(["cancelled"]);

/** These four targets open a small inline form first, since `changeScanRunStatusSchema` accepts
 *  optional extra data alongside exactly these transitions (`errorSummary` for `failed`/
 *  `timed_out`; `findings` for `completed`/`partially_completed` — the ONLY way any `ScanFinding`
 *  row is ever created, there being no standalone create route for that table). */
const NEEDS_INLINE_FORM: ReadonlySet<ScanRunStatus> = new Set([
  "failed",
  "timed_out",
  "completed",
  "partially_completed",
]);

const ERROR_SUMMARY_TARGETS: ReadonlySet<ScanRunStatus> = new Set(["failed", "timed_out"]);
const FINDINGS_TARGETS: ReadonlySet<ScanRunStatus> = new Set(["completed", "partially_completed"]);

const ERROR_SUMMARY_MAX_LENGTH = 10_000;
const FINDING_TITLE_MAX_LENGTH = 255;
const FINDING_CATEGORY_MAX_LENGTH = 255;
const FINDING_DESCRIPTION_MAX_LENGTH = 20_000;
const FINDING_LOCATION_MAX_LENGTH = 500;
/** Mirrors `scanRunFindingInputSchema`'s own array cap. */
const FINDINGS_MAX_COUNT = 500;

interface FindingRowValues {
  readonly key: string;
  readonly category: string;
  readonly severity: ScanFindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly location: string;
}

function emptyFindingRow(): FindingRowValues {
  return {
    key: crypto.randomUUID(),
    category: "",
    severity: "medium",
    title: "",
    description: "",
    location: "",
  };
}

/**
 * Status-transition actions for the scan run detail page's header — a bespoke 8-state workflow
 * (see `ALLOWED_TRANSITIONS`' own doc comment). No approved design brief names an `ApprovalBlock`
 * component for this module, and the same reasoning that already keeps every sibling status-actions
 * component from using it applies here: `changeScanRunStatusSchema` accepts no submitter/reviewer
 * identity or a typed rejection reason, only an optional `errorSummary`/`findings` payload specific
 * to two particular target statuses.
 *
 * `status` is re-synced from the server-passed prop via `useSyncedState()`, matching every module
 * built after 2026-08-27. Submits via `postMutation()` (`credentials: "include"`, required for
 * `dashboard-api`'s `OriginCheckGuard`) — `POST .../runs/:id/status`.
 *
 * The findings editor deliberately drops any row whose Title is left blank rather than validating
 * it as an error — an author who opened the form, typed nothing into an extra row, and clicked
 * confirm almost certainly meant to leave that row empty, not to see a submit-blocking error.
 */
export function ScanRunStatusActions({
  projectId,
  runId,
  status: initialStatus,
}: ScanRunStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [activeAction, setActiveAction] = useState<ScanRunStatus | null>(null);
  const [errorSummary, setErrorSummary] = useState("");
  const [findingRows, setFindingRows] = useState<readonly FindingRowValues[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ScanRunStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  function openInlineForm(target: ScanRunStatus): void {
    setActiveAction(target);
    setErrorSummary("");
    setFindingRows(FINDINGS_TARGETS.has(target) ? [emptyFindingRow()] : []);
    setError(null);
  }

  function cancelInlineForm(): void {
    setActiveAction(null);
    setErrorSummary("");
    setFindingRows([]);
    setError(null);
  }

  async function submitTransition(
    nextStatus: ScanRunStatus,
    body: { readonly errorSummary?: string; readonly findings?: readonly unknown[] },
  ): Promise<void> {
    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation<ScanRun>(
        `${getApiBaseUrl()}/scan-center/projects/${projectId}/runs/${runId}/status`,
        { status: nextStatus, ...body },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update the
      // rendered button set from the just-confirmed transition immediately, from the LOCALLY KNOWN
      // target status (never `result.data.status`, which `postMutation()`'s own documented
      // contract says may not actually be present on a malformed/missing response body), rather
      // than waiting on router.refresh() to reconcile it.
      setStatus(nextStatus);
      setActiveAction(null);
      setErrorSummary("");
      setFindingRows([]);
      router.refresh();
    } catch (err) {
      console.error("Failed to change scan run status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function handleDirectTransition(nextStatus: ScanRunStatus): Promise<void> {
    if (CONFIRM_STATUSES.has(nextStatus)) {
      const confirmed = window.confirm(`${ACTION_LABEL[nextStatus]}? This cannot be undone.`);
      if (!confirmed) {
        return;
      }
    }
    await submitTransition(nextStatus, {});
  }

  async function handleInlineFormSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeAction) {
      return;
    }
    const body: { errorSummary?: string; findings?: readonly unknown[] } = {};
    if (ERROR_SUMMARY_TARGETS.has(activeAction) && errorSummary.trim() !== "") {
      body.errorSummary = errorSummary.trim();
    }
    if (FINDINGS_TARGETS.has(activeAction)) {
      const findings = findingRows
        .filter((row) => row.title.trim() !== "")
        .slice(0, FINDINGS_MAX_COUNT)
        .map((row) => ({
          category: row.category.trim() || null,
          severity: row.severity,
          title: row.title.trim(),
          description: row.description.trim() || null,
          location: row.location.trim() || null,
        }));
      if (findings.length > 0) {
        body.findings = findings;
      }
    }
    await submitTransition(activeAction, body);
  }

  function updateRow(key: string, patch: Partial<FindingRowValues>): void {
    setFindingRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  if (activeAction) {
    return (
      <form className={styles.inlineForm} onSubmit={(event) => void handleInlineFormSubmit(event)}>
        <p className={styles.inlineFormTitle}>{ACTION_LABEL[activeAction]}</p>

        {ERROR_SUMMARY_TARGETS.has(activeAction) ? (
          <div className={styles.field}>
            <label htmlFor="scan-run-error-summary" className={styles.label}>
              Error summary (optional)
            </label>
            <textarea
              id="scan-run-error-summary"
              maxLength={ERROR_SUMMARY_MAX_LENGTH}
              value={errorSummary}
              onChange={(event) => setErrorSummary(event.target.value)}
              className={styles.textarea}
              rows={3}
            />
          </div>
        ) : null}

        {FINDINGS_TARGETS.has(activeAction) ? (
          <div className={styles.findingsEditor}>
            <p className={styles.findingsTitle}>Findings (optional)</p>
            {findingRows.map((row) => (
              <div key={row.key} className={styles.findingRow}>
                <div className={styles.field}>
                  <label htmlFor={`finding-title-${row.key}`} className={styles.label}>
                    Title
                  </label>
                  <input
                    id={`finding-title-${row.key}`}
                    type="text"
                    maxLength={FINDING_TITLE_MAX_LENGTH}
                    value={row.title}
                    onChange={(event) => updateRow(row.key, { title: event.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`finding-severity-${row.key}`} className={styles.label}>
                    Severity
                  </label>
                  <select
                    id={`finding-severity-${row.key}`}
                    value={row.severity}
                    onChange={(event) =>
                      updateRow(row.key, { severity: event.target.value as ScanFindingSeverity })
                    }
                    className={styles.select}
                  >
                    {SCAN_FINDING_SEVERITY_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {SCAN_FINDING_SEVERITY_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor={`finding-category-${row.key}`} className={styles.label}>
                    Category
                  </label>
                  <input
                    id={`finding-category-${row.key}`}
                    type="text"
                    maxLength={FINDING_CATEGORY_MAX_LENGTH}
                    value={row.category}
                    onChange={(event) => updateRow(row.key, { category: event.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`finding-location-${row.key}`} className={styles.label}>
                    Location
                  </label>
                  <input
                    id={`finding-location-${row.key}`}
                    type="text"
                    maxLength={FINDING_LOCATION_MAX_LENGTH}
                    value={row.location}
                    onChange={(event) => updateRow(row.key, { location: event.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`finding-description-${row.key}`} className={styles.label}>
                    Description
                  </label>
                  <textarea
                    id={`finding-description-${row.key}`}
                    maxLength={FINDING_DESCRIPTION_MAX_LENGTH}
                    value={row.description}
                    onChange={(event) => updateRow(row.key, { description: event.target.value })}
                    className={styles.textarea}
                    rows={2}
                  />
                </div>
                <button
                  type="button"
                  className={styles.removeRowButton}
                  onClick={() =>
                    setFindingRows((rows) => rows.filter((existing) => existing.key !== row.key))
                  }
                >
                  Remove row
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addRowButton}
              disabled={findingRows.length >= FINDINGS_MAX_COUNT}
              onClick={() => setFindingRows((rows) => [...rows, emptyFindingRow()])}
            >
              Add another finding
            </button>
          </div>
        ) : null}

        <div className={styles.wrapper}>
          <button type="submit" disabled={pending !== null} className={styles.actionButton}>
            {pending === activeAction ? "…" : `Confirm: ${ACTION_LABEL[activeAction]}`}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={cancelInlineForm}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className={styles.wrapper}>
      {targets.map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => {
            if (NEEDS_INLINE_FORM.has(target)) {
              openInlineForm(target);
              return;
            }
            void handleDirectTransition(target);
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
