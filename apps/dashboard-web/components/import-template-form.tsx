"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  ImportDuplicateStrategy,
  ImportExportFileFormat,
  ImportTemplate,
  ModuleRegistrySummary,
} from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  IMPORT_DUPLICATE_STRATEGY_LABEL,
  IMPORT_DUPLICATE_STRATEGY_VALUES,
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  IMPORT_EXPORT_FILE_FORMAT_VALUES,
  moduleDisplayName,
} from "@/lib/import-and-export-center-query";
import styles from "./import-template-form.module.css";

// Mirrors apps/dashboard-api/src/import-and-export-center/import-and-export-center.dto.ts's
// createImportTemplateSchema/updateImportTemplateSchema — kept in sync by hand, same approach
// every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;

export type ImportTemplateFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly templateId: string; readonly initial: ImportTemplate }
) & {
  /** Already sorted alphabetically by display name (`sortModulesForPicker()`) — real backing data
   *  for the `targetModuleKey` field, sourced from `getServerSession()`'s own already-fetched
   *  `session.navigation` rather than a dedicated `GET /authz/module-registry` fetch, matching
   *  `ReadyForClaudeTaskForm`'s own identical, already-code-reviewed reasoning (that fetch is
   *  `users_roles:view`-gated, held by only 2 of 7 seeded roles). */
  readonly modules: readonly ModuleRegistrySummary[];
};

/**
 * Create/edit form for an Import Template. No approved wireframe/screen spec exists for this
 * module — sections mirror `createImportTemplateSchema`'s own field grouping, the smallest honest
 * reading of the backend's actual field set, matching every sibling module's own "smallest honest
 * reading" precedent.
 *
 * `publicId`/`targetModuleKey` are create-only (shown read-only on edit) — both immutable after
 * creation, confirmed directly against `updateImportTemplateSchema`'s own field list (which omits
 * both). `fileFormat`, unlike those two, IS editable on both create and edit — also confirmed
 * directly against the same DTO (`updateImportTemplateSchema` includes it as an optional field),
 * not assumed from the create-only convention every OTHER discriminator-shaped field in this app
 * follows.
 *
 * `columnMapping` is a raw-JSON `<textarea>` — parsed with `JSON.parse()` on submit inside a
 * try/catch, surfacing a clear client-side error before ever calling `postMutation()` rather than
 * letting a malformed value reach the backend's own `boundedJsonObjectSchema()` rejection. Omitted
 * entirely when empty on create (matches the backend's own `.nullish()` contract — an omitted key
 * leaves it unset), sent as an explicit `null` on edit when cleared (what actually clears an
 * existing value), matching every sibling form's own `textField()`-style undefined-vs-null
 * contract, adapted here for a JSON object instead of a string.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — `POST /import-and-export-center/templates` on create,
 * `PATCH /import-and-export-center/templates/:id` on edit, matching the controller's own real
 * HTTP-method convention.
 */
export function ImportTemplateForm(props: ImportTemplateFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [targetModuleKey, setTargetModuleKey] = useState(initial?.targetModuleKey ?? "");
  const [columnMapping, setColumnMapping] = useState(
    initial?.columnMapping ? JSON.stringify(initial.columnMapping, null, 2) : "",
  );
  const [duplicateStrategyDefault, setDuplicateStrategyDefault] = useState<ImportDuplicateStrategy>(
    initial?.duplicateStrategyDefault ?? "skip",
  );
  const [fileFormat, setFileFormat] = useState<ImportExportFileFormat>(
    initial?.fileFormat ?? "csv",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    let parsedColumnMapping: Record<string, unknown> | null | undefined;
    const trimmedColumnMapping = columnMapping.trim();
    if (trimmedColumnMapping === "") {
      parsedColumnMapping = props.mode === "create" ? undefined : null;
    } else {
      try {
        const parsed: unknown = JSON.parse(trimmedColumnMapping);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        parsedColumnMapping = parsed as Record<string, unknown>;
      } catch {
        setError("Column mapping must be valid JSON (an object).");
        return;
      }
    }

    setSubmitting(true);
    try {
      const sharedFields = {
        name: name.trim(),
        columnMapping: parsedColumnMapping,
        duplicateStrategyDefault,
        fileFormat,
        isActive,
      };

      const payload =
        props.mode === "create"
          ? {
              ...sharedFields,
              publicId: publicId.trim(),
              targetModuleKey: targetModuleKey.trim(),
            }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/import-and-export-center/templates`
          : `${getApiBaseUrl()}/import-and-export-center/templates/${props.templateId}`;

      const result = await postMutation<ImportTemplate>(url, payload, {
        method: props.mode === "create" ? "POST" : "PATCH",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const templateId = props.mode === "create" ? result.data?.id : props.templateId;
      if (!templateId) {
        setError(
          "The template was saved, but its details couldn't be loaded. Please check the list.",
        );
        return;
      }
      router.push(`/import-and-export-center/templates/${templateId}`);
    } catch (err) {
      console.error("Failed to save import template", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Identity</legend>

        {props.mode === "create" ? (
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
            <span className={styles.helperText}>
              A stable, human-readable identifier — never regenerated once assigned.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Public ID</span>
            <span className={styles.readonlyValue}>{props.initial.publicId}</span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="name" className={styles.label}>
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={NAME_MAX_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={styles.input}
          />
        </div>

        {props.mode === "create" ? (
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
              {props.modules.map((module) => (
                <option key={module.key} value={module.key}>
                  {moduleDisplayName(module)}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>Immutable once created.</span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Target module</span>
            <span className={styles.readonlyValue}>
              {props.modules.find((module) => module.key === props.initial.targetModuleKey)
                ? moduleDisplayName(
                    props.modules.find((module) => module.key === props.initial.targetModuleKey)!,
                  )
                : props.initial.targetModuleKey}
            </span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="fileFormat" className={styles.label}>
            File format
          </label>
          <select
            id="fileFormat"
            value={fileFormat}
            onChange={(event) => setFileFormat(event.target.value as ImportExportFileFormat)}
            className={styles.select}
          >
            {IMPORT_EXPORT_FILE_FORMAT_VALUES.map((value) => (
              <option key={value} value={value}>
                {IMPORT_EXPORT_FILE_FORMAT_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="duplicateStrategyDefault" className={styles.label}>
            Default duplicate strategy
          </label>
          <select
            id="duplicateStrategyDefault"
            value={duplicateStrategyDefault}
            onChange={(event) =>
              setDuplicateStrategyDefault(event.target.value as ImportDuplicateStrategy)
            }
            className={styles.select}
          >
            {IMPORT_DUPLICATE_STRATEGY_VALUES.map((value) => (
              <option key={value} value={value}>
                {IMPORT_DUPLICATE_STRATEGY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <label className={styles.field} style={{ flexDirection: "row", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span className={styles.label}>Active</span>
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Column mapping</legend>
        <div className={styles.field}>
          <label htmlFor="columnMapping" className={styles.label}>
            Column mapping (JSON, optional)
          </label>
          <textarea
            id="columnMapping"
            value={columnMapping}
            onChange={(event) => setColumnMapping(event.target.value)}
            className={`${styles.textarea} ${styles.monospace}`}
            rows={8}
            placeholder={'{\n  "sourceColumn": "targetField"\n}'}
          />
          <span className={styles.helperText}>
            Free-form source-column-to-target-field pairs. Must be valid JSON (an object) or left
            blank.
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
          {submitting ? "Saving…" : props.mode === "create" ? "Create template" : "Save changes"}
        </button>
        <a href="/import-and-export-center" className={styles.cancelLink}>
          Cancel
        </a>
      </div>
    </form>
  );
}
