"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ExportRun, ExportRunStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./export-run-status-actions.module.css";

export interface ExportRunStatusActionsProps {
  readonly exportRunId: string;
  readonly status: ExportRunStatus;
}

/**
 * Mirrors the `TRANSITIONS` table in
 * `apps/dashboard-api/src/import-and-export-center/export-runs.service.ts` — kept in sync by
 * hand, the same convention every sibling status-actions component in this app already uses.
 * Every real transition here requires the `export` action (checked dynamically server-side,
 * since the seeded `exports` RBAC group has no submit/review/approve letters to split by, the
 * same shape `ScanRunStatus`'s own uniform-`edit` workflow has). `completed`/`failed`/`cancelled`
 * are TERMINAL — no outbound transition, so this component renders nothing once `status` reaches
 * one.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ExportRunStatus, readonly ExportRunStatus[]>> = {
  requested: ["processing", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's own `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<ExportRunStatus, string>> = {
  requested: "Reset to Requested",
  processing: "Mark as Processing",
  completed: "Mark Completed",
  failed: "Mark Failed",
  cancelled: "Cancel run",
};

/** Only `cancelled` prompts a confirmation — the one transition genuinely destructive to this
 *  run's own forward progress, matching every sibling status-actions component's own "confirm
 *  only the transition the state machine can never reverse" precedent (`completed`/`failed` are
 *  themselves terminal, but reaching them isn't itself a destructive act the way cancelling is). */
const CONFIRM_STATUSES: ReadonlySet<ExportRunStatus> = new Set(["cancelled"]);

/** `changeExportRunStatusSchema` accepts `errorSummary`/`rowCount`/`fileReference` alongside ANY
 *  transition, but an inline form is only offered for the two transitions where at least one of
 *  those fields is actually meaningful — `rowCount`/`fileReference` on the transition to
 *  `completed`, `errorSummary` on the transition to `failed` — matching every sibling status-
 *  actions component's own restraint against a generic "always show every optional field" UI. */
const NEEDS_INLINE_FORM: ReadonlySet<ExportRunStatus> = new Set(["completed", "failed"]);

const ERROR_SUMMARY_MAX_LENGTH = 20_000;
const FILE_REFERENCE_MAX_LENGTH = 10_000;

/**
 * Status-transition actions for the export run detail page's header — a simple, bespoke 5-state
 * workflow (see `ALLOWED_TRANSITIONS`' own doc comment). No approved design brief names an
 * `ApprovalBlock` component for this module, and the same reasoning that already keeps every
 * sibling status-actions component from using it applies here: `changeExportRunStatusSchema`
 * accepts no submitter/reviewer identity or a typed rejection reason.
 *
 * `status` is re-synced from the server-passed prop via `useSyncedState()`, matching every module
 * built after 2026-08-27. Submits via `postMutation()` (`credentials: "include"`, required for
 * `dashboard-api`'s `OriginCheckGuard`) — `POST .../exports/:id/status`. No `expectedStatus`/CAS
 * field in the request body (confirmed directly against `changeExportRunStatusSchema`, not
 * assumed).
 */
export function ExportRunStatusActions({
  exportRunId,
  status: initialStatus,
}: ExportRunStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useSyncedState(initialStatus);
  const [activeAction, setActiveAction] = useState<ExportRunStatus | null>(null);
  const [errorSummary, setErrorSummary] = useState("");
  const [rowCount, setRowCount] = useState("");
  const [fileReference, setFileReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ExportRunStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  function openInlineForm(target: ExportRunStatus): void {
    setActiveAction(target);
    setErrorSummary("");
    setRowCount("");
    setFileReference("");
    setError(null);
  }

  function cancelInlineForm(): void {
    setActiveAction(null);
    setErrorSummary("");
    setRowCount("");
    setFileReference("");
    setError(null);
  }

  async function submitTransition(
    nextStatus: ExportRunStatus,
    body: Record<string, unknown>,
  ): Promise<void> {
    setError(null);
    setPending(nextStatus);
    try {
      const result = await postMutation<ExportRun>(
        `${getApiBaseUrl()}/import-and-export-center/exports/${exportRunId}/status`,
        { status: nextStatus, ...body },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStatus(nextStatus);
      setActiveAction(null);
      setErrorSummary("");
      setRowCount("");
      setFileReference("");
      router.refresh();
    } catch (err) {
      console.error("Failed to change export run status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function handleDirectTransition(target: ExportRunStatus): Promise<void> {
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
    const body: Record<string, unknown> = {};
    if (activeAction === "failed" && errorSummary.trim() !== "") {
      body.errorSummary = errorSummary.trim();
    }
    if (activeAction === "completed") {
      const trimmedRowCount = rowCount.trim();
      if (trimmedRowCount !== "") {
        const parsed = Number.parseInt(trimmedRowCount, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          body.rowCount = parsed;
        }
      }
      if (fileReference.trim() !== "") {
        body.fileReference = fileReference.trim();
      }
    }
    await submitTransition(activeAction, body);
  }

  if (activeAction) {
    return (
      <form className={styles.inlineForm} onSubmit={(event) => void handleInlineFormSubmit(event)}>
        <p className={styles.inlineFormTitle}>{ACTION_LABEL[activeAction]}</p>

        {activeAction === "completed" ? (
          <>
            <div className={styles.field}>
              <label htmlFor="export-run-row-count" className={styles.label}>
                Row count (optional)
              </label>
              <input
                id="export-run-row-count"
                // No `min` HTML constraint here — see `ImportRunStatusActions`'s own identical
                // fix and doc comment: a native constraint-validation failure silently blocks the
                // submit event, which this component doesn't otherwise guard against with a
                // clear message (an invalid value here is simply dropped, not sent, at submit
                // time in JS instead).
                type="number"
                value={rowCount}
                onChange={(event) => setRowCount(event.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="export-run-file-reference" className={styles.label}>
                File reference (optional)
              </label>
              <input
                id="export-run-file-reference"
                type="text"
                maxLength={FILE_REFERENCE_MAX_LENGTH}
                value={fileReference}
                onChange={(event) => setFileReference(event.target.value)}
                className={styles.input}
              />
              <span style={{ fontSize: "0.75rem" }}>
                Deliberately not URL-validated — an opaque, caller-supplied identifier, matching
                this module's own stored-file-reference precedent.
              </span>
            </div>
          </>
        ) : null}

        {activeAction === "failed" ? (
          <div className={styles.field}>
            <label htmlFor="export-run-error-summary" className={styles.label}>
              Error summary (optional)
            </label>
            <textarea
              id="export-run-error-summary"
              maxLength={ERROR_SUMMARY_MAX_LENGTH}
              value={errorSummary}
              onChange={(event) => setErrorSummary(event.target.value)}
              className={styles.textarea}
              rows={3}
            />
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
