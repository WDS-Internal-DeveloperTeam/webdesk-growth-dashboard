"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  ImportRowResolution,
  ImportRowStatus,
  ImportRun,
  ImportRunStatus,
} from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  IMPORT_ROW_STATUS_LABEL,
  IMPORT_ROW_STATUS_VALUES,
} from "@/lib/import-and-export-center-query";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./import-run-status-actions.module.css";

export interface ImportRunStatusActionsProps {
  readonly runId: string;
  readonly status: ImportRunStatus;
  readonly isDryRun: boolean;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/import-and-export-center/import-runs.service.ts` — kept in sync by
 * hand, the same convention every sibling status-actions component in this app already uses.
 * Only the legal target statuses are mirrored here (not the required RBAC action per transition,
 * which varies dynamically — `submit`/`review`/`approve`/`edit`, per the real seeded `imports`
 * RBAC row); `ImportRunsService.changeStatus()`'s own `AuthorizationService.assertAllowed()` call
 * remains the sole authoritative check either way, and a caller without the real grant still gets
 * a clean 403.
 *
 * `validating -> dry_run_completed`/`validating -> importing` are asymmetric on the run's own
 * `isDryRun` flag (a real dry run may only reach `dry_run_completed`, a real import may only reach
 * `importing` directly) — computed here as a function of `(status, isDryRun)`, not a static table,
 * so this component never offers a button the backend would 400.
 *
 * `failed`/`cancelled`/`rejected`/`rolled_back` are TERMINAL — no outbound transition exists from
 * any of them, so this component renders nothing once `status` reaches one.
 */
function allowedTargets(status: ImportRunStatus, isDryRun: boolean): readonly ImportRunStatus[] {
  switch (status) {
    case "draft":
      return ["submitted", "cancelled"];
    case "submitted":
      return ["approved", "rejected", "cancelled"];
    case "approved":
      return ["validating", "cancelled"];
    case "validating":
      return isDryRun
        ? ["dry_run_completed", "failed", "cancelled"]
        : ["importing", "failed", "cancelled"];
    case "dry_run_completed":
      return ["importing"];
    case "importing":
      return ["completed", "partially_completed", "failed", "cancelled"];
    case "completed":
      return ["rolled_back"];
    case "partially_completed":
      return ["rolled_back"];
    case "failed":
    case "cancelled":
    case "rejected":
    case "rolled_back":
      return [];
    default:
      return [];
  }
}

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. `importing` is reached both
 *  from `validating` (a real import) and from `dry_run_completed` (promoting an already-validated
 *  dry run) — one label covers both, since it's the same real action ("start the real import")
 *  either way. */
const ACTION_LABEL: Readonly<Record<ImportRunStatus, string>> = {
  draft: "Back to Draft",
  submitted: "Submit",
  approved: "Approve",
  rejected: "Reject",
  validating: "Start Validation",
  dry_run_completed: "Mark Dry Run Completed",
  importing: "Start Import",
  completed: "Mark Completed",
  partially_completed: "Mark Partially Completed",
  failed: "Mark Failed",
  cancelled: "Cancel run",
  rolled_back: "Roll Back",
};

/** `cancelled`/`rejected`/`rolled_back` all prompt a confirmation — the transitions genuinely
 *  destructive to (or permanently ending) this run's own forward progress, matching every sibling
 *  status-actions component's own "confirm only the transition the state machine can never
 *  reverse" precedent. */
const CONFIRM_STATUSES: ReadonlySet<ImportRunStatus> = new Set([
  "cancelled",
  "rejected",
  "rolled_back",
]);

/** `rows`/`runErrors` are only ever accepted alongside the run's ORIGINAL
 *  `validating -> dry_run_completed`/`validating -> importing` transition — NOT the separate
 *  `dry_run_completed -> importing` "promote" transition, even though `importing` is a target of
 *  both. Gated on both the target AND the run's current status, matching
 *  `ImportRunsService.changeStatus()`'s own identical guard. */
const ROWS_TARGETS: ReadonlySet<ImportRunStatus> = new Set(["dry_run_completed", "importing"]);

function needsRowsForm(target: ImportRunStatus, fromStatus: ImportRunStatus): boolean {
  return ROWS_TARGETS.has(target) && fromStatus === "validating";
}

const ERROR_SUMMARY_TARGETS: ReadonlySet<ImportRunStatus> = new Set(["failed"]);
const ROLLBACK_NOTES_TARGETS: ReadonlySet<ImportRunStatus> = new Set(["rolled_back"]);

function needsInlineForm(target: ImportRunStatus, fromStatus: ImportRunStatus): boolean {
  return (
    ERROR_SUMMARY_TARGETS.has(target) ||
    ROLLBACK_NOTES_TARGETS.has(target) ||
    needsRowsForm(target, fromStatus)
  );
}

const ERROR_SUMMARY_MAX_LENGTH = 20_000;
const ROLLBACK_NOTES_MAX_LENGTH = 20_000;
const EXTERNAL_ID_MAX_LENGTH = 500;
const ERROR_CODE_MAX_LENGTH = 100;
const FIELD_NAME_MAX_LENGTH = 255;
const ERROR_MESSAGE_MAX_LENGTH = 20_000;
/** Mirrors `changeImportRunStatusSchema`'s own array caps. */
const ROWS_MAX_COUNT = 5000;
const RUN_ERRORS_MAX_COUNT = 200;

interface RowValues {
  readonly key: string;
  readonly rowNumber: string;
  readonly externalId: string;
  readonly rawData: string;
  readonly status: ImportRowStatus;
  readonly resolution: ImportRowResolution | "";
  readonly errorMessage: string;
  readonly errorCode: string;
  readonly fieldName: string;
}

function emptyRow(nextRowNumber: number): RowValues {
  return {
    key: crypto.randomUUID(),
    rowNumber: String(nextRowNumber),
    externalId: "",
    rawData: "",
    status: "pending",
    resolution: "",
    errorMessage: "",
    errorCode: "",
    fieldName: "",
  };
}

interface RunErrorValues {
  readonly key: string;
  readonly errorCode: string;
  readonly message: string;
  readonly fieldName: string;
}

function emptyRunError(): RunErrorValues {
  return { key: crypto.randomUUID(), errorCode: "", message: "", fieldName: "" };
}

/**
 * Status-transition actions for the import run detail page's header — a bespoke 12-state
 * workflow (see `allowedTargets()`'s own doc comment). No approved design brief names an
 * `ApprovalBlock` component for this module, and the same reasoning that already keeps every
 * sibling status-actions component from using it applies here: `changeImportRunStatusSchema`
 * accepts no submitter/reviewer identity or a typed rejection reason, only optional
 * `errorSummary`/`rollbackNotes`/`rows`/`runErrors` payloads specific to particular transitions.
 *
 * `status` is re-synced from the server-passed prop via `useSyncedState()`, matching every module
 * built after 2026-08-27. Submits via `postMutation()` (`credentials: "include"`, required for
 * `dashboard-api`'s `OriginCheckGuard`) — `POST .../runs/:id/status`. No `expectedStatus`/CAS field
 * in the request body — `changeImportRunStatusSchema` takes only `{status, ...}`, unlike Ready for
 * Claude Queue's own `{status, expectedStatus}` shape (confirmed directly against the DTO, not
 * assumed).
 *
 * The rows/errors editors deliberately drop any row whose Row # (rows) or Message (run errors) is
 * left blank rather than validating it as an error — an author who opened the form, typed nothing
 * into an extra row, and clicked confirm almost certainly meant to leave that row empty, matching
 * `ScanRunStatusActions`'s own identical reasoning for its findings editor.
 */
export function ImportRunStatusActions({
  runId,
  status: initialStatus,
  isDryRun,
}: ImportRunStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [activeAction, setActiveAction] = useState<ImportRunStatus | null>(null);
  const [errorSummary, setErrorSummary] = useState("");
  const [rollbackNotes, setRollbackNotes] = useState("");
  const [rowValues, setRowValues] = useState<readonly RowValues[]>([]);
  const [runErrorValues, setRunErrorValues] = useState<readonly RunErrorValues[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ImportRunStatus | null>(null);

  const targets = allowedTargets(status, isDryRun);
  if (targets.length === 0) {
    return null;
  }

  function openInlineForm(target: ImportRunStatus): void {
    if (CONFIRM_STATUSES.has(target)) {
      const confirmed = window.confirm(`${ACTION_LABEL[target]}? This cannot be undone.`);
      if (!confirmed) {
        return;
      }
    }
    setActiveAction(target);
    setErrorSummary("");
    setRollbackNotes("");
    setRowValues(needsRowsForm(target, status) ? [emptyRow(1)] : []);
    setRunErrorValues(needsRowsForm(target, status) ? [] : []);
    setJsonError(null);
    setError(null);
  }

  function cancelInlineForm(): void {
    setActiveAction(null);
    setErrorSummary("");
    setRollbackNotes("");
    setRowValues([]);
    setRunErrorValues([]);
    setJsonError(null);
    setError(null);
  }

  async function submitTransition(
    nextStatus: ImportRunStatus,
    body: Record<string, unknown>,
  ): Promise<void> {
    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation<ImportRun>(
        `${getApiBaseUrl()}/import-and-export-center/runs/${runId}/status`,
        { status: nextStatus, ...body },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern every sibling status-actions component uses: update from the
      // LOCALLY KNOWN target status, never `result.data.status` (which `postMutation()`'s own
      // documented contract says may not actually be present on a malformed/missing response
      // body), rather than waiting on router.refresh() to reconcile it.
      setStatus(nextStatus);
      setActiveAction(null);
      setErrorSummary("");
      setRollbackNotes("");
      setRowValues([]);
      setRunErrorValues([]);
      router.refresh();
    } catch (err) {
      console.error("Failed to change import run status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function handleDirectTransition(target: ImportRunStatus): Promise<void> {
    if (CONFIRM_STATUSES.has(target)) {
      const confirmed = window.confirm(`${ACTION_LABEL[target]}? This cannot be undone.`);
      if (!confirmed) {
        return;
      }
    }
    await submitTransition(target, {});
  }

  async function handleInlineFormSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeAction) {
      return;
    }
    setJsonError(null);

    const body: Record<string, unknown> = {};

    if (ERROR_SUMMARY_TARGETS.has(activeAction) && errorSummary.trim() !== "") {
      body.errorSummary = errorSummary.trim();
    }
    if (ROLLBACK_NOTES_TARGETS.has(activeAction) && rollbackNotes.trim() !== "") {
      body.rollbackNotes = rollbackNotes.trim();
    }

    if (needsRowsForm(activeAction, status)) {
      const rows: Record<string, unknown>[] = [];
      for (const row of rowValues) {
        const trimmedRowNumber = row.rowNumber.trim();
        if (trimmedRowNumber === "") {
          continue;
        }
        const rowNumber = Number.parseInt(trimmedRowNumber, 10);
        if (!Number.isFinite(rowNumber) || rowNumber < 1) {
          setJsonError(`Row # "${row.rowNumber}" must be a positive whole number.`);
          return;
        }
        let rawData: Record<string, unknown> | undefined;
        if (row.rawData.trim() !== "") {
          try {
            const parsed: unknown = JSON.parse(row.rawData);
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
              throw new Error("not an object");
            }
            rawData = parsed as Record<string, unknown>;
          } catch {
            setJsonError(`Row #${row.rowNumber}'s raw data must be valid JSON (an object).`);
            return;
          }
        }
        rows.push({
          rowNumber,
          externalId: row.externalId.trim() || null,
          rawData: rawData ?? null,
          status: row.status,
          resolution: row.resolution || null,
          errorMessage: row.errorMessage.trim() || null,
          errorCode: row.errorCode.trim() || null,
          fieldName: row.fieldName.trim() || null,
        });
      }
      if (rows.length > 0) {
        body.rows = rows.slice(0, ROWS_MAX_COUNT);
      }

      const runErrors = runErrorValues
        .filter((entry) => entry.message.trim() !== "")
        .slice(0, RUN_ERRORS_MAX_COUNT)
        .map((entry) => ({
          errorCode: entry.errorCode.trim() || null,
          message: entry.message.trim(),
          fieldName: entry.fieldName.trim() || null,
        }));
      if (runErrors.length > 0) {
        body.runErrors = runErrors;
      }
    }

    await submitTransition(activeAction, body);
  }

  function updateRow(key: string, patch: Partial<RowValues>): void {
    setRowValues((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function updateRunError(key: string, patch: Partial<RunErrorValues>): void {
    setRunErrorValues((entries) =>
      entries.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    );
  }

  if (activeAction) {
    const showRows = needsRowsForm(activeAction, status);
    return (
      <form className={styles.inlineForm} onSubmit={(event) => void handleInlineFormSubmit(event)}>
        <p className={styles.inlineFormTitle}>{ACTION_LABEL[activeAction]}</p>

        {ERROR_SUMMARY_TARGETS.has(activeAction) ? (
          <div className={styles.field}>
            <label htmlFor="import-run-error-summary" className={styles.label}>
              Error summary (optional)
            </label>
            <textarea
              id="import-run-error-summary"
              maxLength={ERROR_SUMMARY_MAX_LENGTH}
              value={errorSummary}
              onChange={(event) => setErrorSummary(event.target.value)}
              className={styles.textarea}
              rows={3}
            />
          </div>
        ) : null}

        {ROLLBACK_NOTES_TARGETS.has(activeAction) ? (
          <div className={styles.field}>
            <label htmlFor="import-run-rollback-notes" className={styles.label}>
              Rollback notes (optional)
            </label>
            <textarea
              id="import-run-rollback-notes"
              maxLength={ROLLBACK_NOTES_MAX_LENGTH}
              value={rollbackNotes}
              onChange={(event) => setRollbackNotes(event.target.value)}
              className={styles.textarea}
              rows={3}
              placeholder="What was actually reversed and why."
            />
          </div>
        ) : null}

        {showRows ? (
          <>
            <div className={styles.rowsEditor}>
              <p className={styles.rowsEditorTitle}>Rows (optional)</p>
              {rowValues.map((row) => (
                <div key={row.key} className={styles.rowEntry}>
                  <div className={styles.field}>
                    <label htmlFor={`row-number-${row.key}`} className={styles.label}>
                      Row #
                    </label>
                    <input
                      id={`row-number-${row.key}`}
                      // No `min`/`step` HTML constraints here — a native browser (or jsdom in
                      // tests) silently blocks the submit event entirely when a number input
                      // fails its own constraint validation (min="1" + value "0"), which would
                      // mean this component's own clearer "must be a positive whole number"
                      // message never shows at all. Validated once, in JS, at submit time
                      // instead — the single source of truth for this field.
                      type="number"
                      value={row.rowNumber}
                      onChange={(event) => updateRow(row.key, { rowNumber: event.target.value })}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`row-external-id-${row.key}`} className={styles.label}>
                      External ID
                    </label>
                    <input
                      id={`row-external-id-${row.key}`}
                      type="text"
                      maxLength={EXTERNAL_ID_MAX_LENGTH}
                      value={row.externalId}
                      onChange={(event) => updateRow(row.key, { externalId: event.target.value })}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`row-status-${row.key}`} className={styles.label}>
                      Status
                    </label>
                    <select
                      id={`row-status-${row.key}`}
                      value={row.status}
                      onChange={(event) =>
                        updateRow(row.key, { status: event.target.value as ImportRowStatus })
                      }
                      className={styles.select}
                    >
                      {IMPORT_ROW_STATUS_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {IMPORT_ROW_STATUS_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`row-resolution-${row.key}`} className={styles.label}>
                      Resolution
                    </label>
                    <select
                      id={`row-resolution-${row.key}`}
                      value={row.resolution}
                      onChange={(event) =>
                        updateRow(row.key, {
                          resolution: event.target.value as ImportRowResolution | "",
                        })
                      }
                      className={styles.select}
                    >
                      <option value="">Not set</option>
                      <option value="created">Created</option>
                      <option value="overwritten">Overwritten</option>
                      <option value="skipped_duplicate">Skipped (duplicate)</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`row-raw-data-${row.key}`} className={styles.label}>
                      Raw data (JSON, optional)
                    </label>
                    <textarea
                      id={`row-raw-data-${row.key}`}
                      value={row.rawData}
                      onChange={(event) => updateRow(row.key, { rawData: event.target.value })}
                      className={styles.textarea}
                      rows={2}
                      placeholder={"{ }"}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`row-error-message-${row.key}`} className={styles.label}>
                      Error message
                    </label>
                    <input
                      id={`row-error-message-${row.key}`}
                      type="text"
                      maxLength={ERROR_MESSAGE_MAX_LENGTH}
                      value={row.errorMessage}
                      onChange={(event) => updateRow(row.key, { errorMessage: event.target.value })}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`row-error-code-${row.key}`} className={styles.label}>
                      Error code
                    </label>
                    <input
                      id={`row-error-code-${row.key}`}
                      type="text"
                      maxLength={ERROR_CODE_MAX_LENGTH}
                      value={row.errorCode}
                      onChange={(event) => updateRow(row.key, { errorCode: event.target.value })}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`row-field-name-${row.key}`} className={styles.label}>
                      Field name
                    </label>
                    <input
                      id={`row-field-name-${row.key}`}
                      type="text"
                      maxLength={FIELD_NAME_MAX_LENGTH}
                      value={row.fieldName}
                      onChange={(event) => updateRow(row.key, { fieldName: event.target.value })}
                      className={styles.input}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.removeRowButton}
                    onClick={() =>
                      setRowValues((rows) => rows.filter((existing) => existing.key !== row.key))
                    }
                  >
                    Remove row
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addRowButton}
                disabled={rowValues.length >= ROWS_MAX_COUNT}
                onClick={() => setRowValues((rows) => [...rows, emptyRow(rows.length + 1)])}
              >
                Add another row
              </button>
            </div>

            <div className={styles.errorsEditor}>
              <p className={styles.rowsEditorTitle}>Run-level errors (optional)</p>
              {runErrorValues.map((entry) => (
                <div key={entry.key} className={styles.errorEntry}>
                  <div className={styles.field}>
                    <label htmlFor={`run-error-message-${entry.key}`} className={styles.label}>
                      Message
                    </label>
                    <input
                      id={`run-error-message-${entry.key}`}
                      type="text"
                      maxLength={ERROR_MESSAGE_MAX_LENGTH}
                      value={entry.message}
                      onChange={(event) =>
                        updateRunError(entry.key, { message: event.target.value })
                      }
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`run-error-code-${entry.key}`} className={styles.label}>
                      Error code
                    </label>
                    <input
                      id={`run-error-code-${entry.key}`}
                      type="text"
                      maxLength={ERROR_CODE_MAX_LENGTH}
                      value={entry.errorCode}
                      onChange={(event) =>
                        updateRunError(entry.key, { errorCode: event.target.value })
                      }
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`run-error-field-name-${entry.key}`} className={styles.label}>
                      Field name
                    </label>
                    <input
                      id={`run-error-field-name-${entry.key}`}
                      type="text"
                      maxLength={FIELD_NAME_MAX_LENGTH}
                      value={entry.fieldName}
                      onChange={(event) =>
                        updateRunError(entry.key, { fieldName: event.target.value })
                      }
                      className={styles.input}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.removeRowButton}
                    onClick={() =>
                      setRunErrorValues((entries) =>
                        entries.filter((existing) => existing.key !== entry.key),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addRowButton}
                disabled={runErrorValues.length >= RUN_ERRORS_MAX_COUNT}
                onClick={() => setRunErrorValues((entries) => [...entries, emptyRunError()])}
              >
                Add another run-level error
              </button>
            </div>
          </>
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
        {jsonError ? (
          <p role="alert" className={styles.error}>
            {jsonError}
          </p>
        ) : null}
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
            if (needsInlineForm(target, status)) {
              openInlineForm(target);
              return;
            }
            void handleDirectTransition(target);
          }}
          disabled={pending !== null}
          className={
            target === "cancelled" || target === "rejected" || target === "rolled_back"
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

export { allowedTargets as importRunAllowedTargets };
