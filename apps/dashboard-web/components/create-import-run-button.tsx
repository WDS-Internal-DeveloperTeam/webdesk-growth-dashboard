"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ImportDuplicateStrategy, ImportRun } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  IMPORT_DUPLICATE_STRATEGY_LABEL,
  IMPORT_DUPLICATE_STRATEGY_VALUES,
} from "@/lib/import-and-export-center-query";
import styles from "./create-import-run-button.module.css";

export interface CreateImportRunButtonProps {
  readonly importTemplateId: string;
  readonly isTemplateActive: boolean;
}

const SOURCE_FILE_REFERENCE_MAX_LENGTH = 10_000;
const SOURCE_CHECKSUM_MAX_LENGTH = 500;

/**
 * An inline expandable form (not a single-click button like `TriggerScanRunButton` — creating an
 * import run needs more input than triggering a scan run does) on the import template detail
 * page: click "Create import run" to reveal `isDryRun`/`duplicateStrategy`/`sourceFileReference`/
 * `sourceChecksum`, then `POST .../runs` with a fresh, locally-generated `publicId` (no natural
 * caller-supplied identifier exists for a run — same reasoning `TriggerScanRunButton`'s own
 * `RUN-${randomUUID()}` publicId generation already establishes). `duplicateStrategy` includes a
 * "Use template default" option mapping to an omitted field (`createImportRunSchema`'s own
 * `.nullish()` contract — falls back to the template's own `duplicateStrategyDefault`, resolved by
 * the backend, never copied in here). On success, navigates straight to the new run's own detail
 * page, where its own status-transition actions live.
 *
 * Disabled (with an explanatory note, not hidden) when the template itself is disabled —
 * `ImportRunsService.create()` rejects a request against a disabled template with a clean 400, but
 * surfacing that as an inert-and-explained button is more honest than letting a caller submit a
 * request only to see it rejected, matching `TriggerScanRunButton`'s own precedent.
 */
export function CreateImportRunButton({
  importTemplateId,
  isTemplateActive,
}: CreateImportRunButtonProps): ReactNode {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [duplicateStrategy, setDuplicateStrategy] = useState<ImportDuplicateStrategy | "">("");
  const [sourceFileReference, setSourceFileReference] = useState("");
  const [sourceChecksum, setSourceChecksum] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openForm(): void {
    setExpanded(true);
    setIsDryRun(true);
    setDuplicateStrategy("");
    setSourceFileReference("");
    setSourceChecksum("");
    setError(null);
  }

  function cancelForm(): void {
    setExpanded(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await postMutation<ImportRun>(
        `${getApiBaseUrl()}/import-and-export-center/runs`,
        {
          importTemplateId,
          publicId: `RUN-${crypto.randomUUID()}`,
          isDryRun,
          duplicateStrategy: duplicateStrategy || null,
          sourceFileReference: sourceFileReference.trim() || null,
          sourceChecksum: sourceChecksum.trim() || null,
        },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (!result.data?.id) {
        setError("The import run was created, but its details couldn't be loaded. Please refresh.");
        return;
      }
      router.push(`/import-and-export-center/runs/${result.data.id}`);
    } catch (err) {
      console.error("Failed to create import run", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          disabled={!isTemplateActive}
          onClick={openForm}
          className={styles.actionButton}
        >
          Create import run
        </button>
        {!isTemplateActive ? (
          <span className={styles.helperText}>Enable this template first to create a run.</span>
        ) : null}
      </div>
    );
  }

  return (
    <form className={styles.inlineForm} onSubmit={(event) => void handleSubmit(event)}>
      <label className={styles.field} style={{ flexDirection: "row", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={isDryRun}
          onChange={(event) => setIsDryRun(event.target.checked)}
        />
        <span className={styles.label}>Dry run</span>
      </label>

      <div className={styles.field}>
        <label htmlFor="create-run-duplicate-strategy" className={styles.label}>
          Duplicate strategy
        </label>
        <select
          id="create-run-duplicate-strategy"
          value={duplicateStrategy}
          onChange={(event) =>
            setDuplicateStrategy(event.target.value as ImportDuplicateStrategy | "")
          }
          className={styles.select}
        >
          <option value="">Use template default</option>
          {IMPORT_DUPLICATE_STRATEGY_VALUES.map((value) => (
            <option key={value} value={value}>
              {IMPORT_DUPLICATE_STRATEGY_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="create-run-source-file-reference" className={styles.label}>
          Source file reference
        </label>
        <input
          id="create-run-source-file-reference"
          type="text"
          maxLength={SOURCE_FILE_REFERENCE_MAX_LENGTH}
          value={sourceFileReference}
          onChange={(event) => setSourceFileReference(event.target.value)}
          className={styles.input}
        />
        <span className={styles.helperText}>
          Deliberately not URL-validated — an opaque, caller-supplied identifier (no file-storage
          infrastructure is wired to this module).
        </span>
      </div>

      <div className={styles.field}>
        <label htmlFor="create-run-source-checksum" className={styles.label}>
          Source checksum
        </label>
        <input
          id="create-run-source-checksum"
          type="text"
          maxLength={SOURCE_CHECKSUM_MAX_LENGTH}
          value={sourceChecksum}
          onChange={(event) => setSourceChecksum(event.target.value)}
          className={styles.input}
        />
      </div>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.wrapper}>
        <button type="submit" disabled={submitting} className={styles.actionButton}>
          {submitting ? "Creating…" : "Create import run"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={cancelForm}
          className={styles.cancelButton}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
