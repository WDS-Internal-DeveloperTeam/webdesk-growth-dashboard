"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  ExportRun,
  ImportExportFileFormat,
  ModuleRegistrySummary,
} from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  IMPORT_EXPORT_FILE_FORMAT_VALUES,
  moduleDisplayName,
} from "@/lib/import-and-export-center-query";
import styles from "./export-run-form.module.css";

const PUBLIC_ID_MAX_LENGTH = 64;

export interface ExportRunFormProps {
  /** Already sorted alphabetically by display name (`sortModulesForPicker()`) — real backing data
   *  for the `targetModuleKey` field, sourced from `getServerSession()`'s own already-fetched
   *  `session.navigation`, matching `ImportTemplateForm`'s own identical reasoning. */
  readonly modules: readonly ModuleRegistrySummary[];
}

/**
 * Create-only form for an Export Run — there is no update route for `export_runs`, only the
 * dedicated status-transition route (`ExportRunStatusActions`), confirmed directly against
 * `export-runs.controller.ts` (no `@Patch`/`@Put` route exists). Fields:
 * `publicId`/`targetModuleKey`/`filterCriteria`/`format`, the smallest honest reading of
 * `createExportRunSchema`'s own field set.
 *
 * `filterCriteria` is a raw-JSON `<textarea>`, parsed client-side before submit — same
 * `JSON.parse()`-with-a-clear-error convention `ImportTemplateForm`'s own `columnMapping` field
 * uses. Omitted entirely when left blank (`createExportRunSchema`'s own `.nullish()` contract).
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — `POST /import-and-export-center/exports`. On success, navigates to the new
 * export run's own detail page, where its status-transition actions live.
 */
export function ExportRunForm({ modules }: ExportRunFormProps): ReactNode {
  const router = useRouter();

  const [publicId, setPublicId] = useState("");
  const [targetModuleKey, setTargetModuleKey] = useState("");
  const [filterCriteria, setFilterCriteria] = useState("");
  const [format, setFormat] = useState<ImportExportFileFormat>("csv");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    let parsedFilterCriteria: Record<string, unknown> | undefined;
    const trimmedFilterCriteria = filterCriteria.trim();
    if (trimmedFilterCriteria !== "") {
      try {
        const parsed: unknown = JSON.parse(trimmedFilterCriteria);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        parsedFilterCriteria = parsed as Record<string, unknown>;
      } catch {
        setError("Filter criteria must be valid JSON (an object).");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await postMutation<ExportRun>(
        `${getApiBaseUrl()}/import-and-export-center/exports`,
        {
          publicId: publicId.trim(),
          targetModuleKey: targetModuleKey.trim(),
          filterCriteria: parsedFilterCriteria,
          format,
        },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (!result.data?.id) {
        setError("The export run was created, but its details couldn't be loaded. Please refresh.");
        return;
      }
      router.push(`/import-and-export-center/exports/${result.data.id}`);
    } catch (err) {
      console.error("Failed to create export run", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Identity</legend>

        <div className={styles.field}>
          <label htmlFor="publicId" className={styles.label}>
            Public ID
          </label>
          <input
            id="publicId"
            type="text"
            required
            maxLength={PUBLIC_ID_MAX_LENGTH}
            value={publicId}
            onChange={(event) => setPublicId(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="targetModuleKey" className={styles.label}>
            Target module
          </label>
          <select
            id="targetModuleKey"
            required
            value={targetModuleKey}
            onChange={(event) => setTargetModuleKey(event.target.value)}
            className={styles.select}
          >
            <option value="" disabled>
              Select a module
            </option>
            {modules.map((module) => (
              <option key={module.key} value={module.key}>
                {moduleDisplayName(module)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="format" className={styles.label}>
            Format
          </label>
          <select
            id="format"
            value={format}
            onChange={(event) => setFormat(event.target.value as ImportExportFileFormat)}
            className={styles.select}
          >
            {IMPORT_EXPORT_FILE_FORMAT_VALUES.map((value) => (
              <option key={value} value={value}>
                {IMPORT_EXPORT_FILE_FORMAT_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Filter criteria</legend>
        <div className={styles.field}>
          <label htmlFor="filterCriteria" className={styles.label}>
            Filter criteria (JSON, optional)
          </label>
          <textarea
            id="filterCriteria"
            value={filterCriteria}
            onChange={(event) => setFilterCriteria(event.target.value)}
            className={`${styles.textarea} ${styles.monospace}`}
            rows={6}
            placeholder={'{\n  "status": "active"\n}'}
          />
          <span className={styles.helperText}>
            An opaque, caller-supplied filter description — no schema is imposed. Must be valid JSON
            (an object) or left blank.
          </span>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Creating…" : "Create export run"}
        </button>
        <a href="/import-and-export-center/exports" className={styles.cancelLink}>
          Cancel
        </a>
      </div>
    </form>
  );
}
