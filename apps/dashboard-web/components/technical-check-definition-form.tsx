"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  TechnicalCheckDefinition,
  TechnicalCheckMode,
  TechnicalCheckType,
} from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  TECHNICAL_CHECK_MODE_LABEL,
  TECHNICAL_CHECK_MODE_VALUES,
  TECHNICAL_CHECK_TYPE_LABEL,
  TECHNICAL_CHECK_TYPE_VALUES,
} from "@/lib/technical-center-query";
import { withProjectId } from "@/lib/project-scoped-href";
import styles from "./technical-check-definition-form.module.css";

// Mirrors apps/dashboard-api/src/technical-center/technical-center.dto.ts's
// createTechnicalCheckDefinitionSchema — kept in sync by hand, same approach every sibling form in
// this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
const TARGET_MAX_LENGTH = 10_000;
const ENVIRONMENT_MAX_LENGTH = 255;
const SCHEDULE_CRON_MAX_LENGTH = 255;

export type TechnicalCheckDefinitionFormProps =
  | { readonly mode: "create"; readonly projectId: string }
  | {
      readonly mode: "edit";
      readonly projectId: string;
      readonly initial: TechnicalCheckDefinition;
    };

/**
 * Create/edit form for a technical check definition. No approved wireframe/screen spec exists for
 * this module — fields mirror `createTechnicalCheckDefinitionSchema`'s/
 * `updateTechnicalCheckDefinitionSchema`'s own field list directly, the smallest honest reading of
 * the backend's actual field set, matching `ScanDefinitionForm`'s own identical precedent (the
 * literal structural template for this module).
 *
 * `publicId`/`checkType` are both create-only (shown read-only on edit) —
 * `updateTechnicalCheckDefinitionSchema` never accepts either, mirroring every sibling module's own
 * discriminator-field create-only contract. `target` is a PLAIN `<textarea>`, deliberately NOT
 * `RichTextEditor` — an explicit, documented exception to the 2026-08-22 standing rule: `target` is
 * a repository ref/URL/selected-page slug, not prose, and the backend's own DTO doc comment states
 * it is "deliberately NOT URL-validated... not always a URL," never sanitized as HTML. `isEnabled`
 * defaults to `true` (create) or the record's own current value (edit), matching the column's own
 * default.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — `POST .../definitions` on create, `POST .../definitions/:id/update` on
 * edit, matching `TechnicalCheckDefinitionsController`'s own real route shape.
 */
export function TechnicalCheckDefinitionForm(props: TechnicalCheckDefinitionFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [checkType, setCheckType] = useState<TechnicalCheckType>(
    initial?.checkType ?? "coding_standards",
  );
  const [checkMode, setCheckMode] = useState<TechnicalCheckMode>(initial?.mode ?? "manual");
  const [target, setTarget] = useState(initial?.target ?? "");
  const [environment, setEnvironment] = useState(initial?.environment ?? "");
  const [scheduleCron, setScheduleCron] = useState(initial?.scheduleCron ?? "");
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
    // leaves the field unchanged on update, matching updateTechnicalCheckDefinitionSchema's own
    // `.nullish()` contract; an explicit null is what actually clears an existing value back to
    // "none". Matches `ScanDefinitionForm`'s own identical `textField()` helper.
    function textField(value: string): string | null | undefined {
      const trimmed = value.trim();
      if (trimmed !== "") return trimmed;
      return props.mode === "create" ? undefined : null;
    }

    try {
      const sharedFields = {
        name: name.trim(),
        mode: checkMode,
        target: textField(target),
        environment: textField(environment),
        scheduleCron: textField(scheduleCron),
        isEnabled,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), checkType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/technical-center/projects/${props.projectId}/definitions`
          : `${getApiBaseUrl()}/technical-center/projects/${props.projectId}/definitions/${props.initial.id}/update`;

      const result = await postMutation<TechnicalCheckDefinition>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const definitionId = props.mode === "create" ? result.data?.id : props.initial.id;
      if (!definitionId) {
        setError(
          "The technical check definition was saved, but its details couldn't be loaded. Please check the list.",
        );
        return;
      }
      router.push(withProjectId(`/technical-center/definitions/${definitionId}`, props.projectId));
    } catch (err) {
      console.error("Failed to save technical check definition", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
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
          <label htmlFor="checkType" className={styles.label}>
            Check type
          </label>
          <select
            id="checkType"
            value={checkType}
            onChange={(event) => setCheckType(event.target.value as TechnicalCheckType)}
            className={styles.select}
          >
            {TECHNICAL_CHECK_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {TECHNICAL_CHECK_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
          <span className={styles.helperText}>Immutable once created.</span>
        </div>
      ) : (
        <div className={styles.field}>
          <span className={styles.label}>Check type</span>
          <span className={styles.readonlyValue}>
            {TECHNICAL_CHECK_TYPE_LABEL[props.initial.checkType]}
          </span>
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="mode" className={styles.label}>
          Mode
        </label>
        <select
          id="mode"
          value={checkMode}
          onChange={(event) => setCheckMode(event.target.value as TechnicalCheckMode)}
          className={styles.select}
        >
          {TECHNICAL_CHECK_MODE_VALUES.map((value) => (
            <option key={value} value={value}>
              {TECHNICAL_CHECK_MODE_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="target" className={styles.label}>
          Target
        </label>
        <textarea
          id="target"
          maxLength={TARGET_MAX_LENGTH}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className={styles.textarea}
          rows={3}
        />
        <span className={styles.helperText}>
          Plain text, not URL-validated — a repository ref or a page slug isn&apos;t always a URL.
        </span>
      </div>

      <div className={styles.field}>
        <label htmlFor="environment" className={styles.label}>
          Environment
        </label>
        <input
          id="environment"
          type="text"
          maxLength={ENVIRONMENT_MAX_LENGTH}
          value={environment}
          onChange={(event) => setEnvironment(event.target.value)}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="scheduleCron" className={styles.label}>
          Schedule (cron)
        </label>
        <input
          id="scheduleCron"
          type="text"
          maxLength={SCHEDULE_CRON_MAX_LENGTH}
          value={scheduleCron}
          onChange={(event) => setScheduleCron(event.target.value)}
          className={styles.input}
          placeholder="0 0 * * *"
        />
        <span className={styles.helperText}>Only used when Mode is Scheduled.</span>
      </div>

      <div className={styles.checkboxField}>
        <input
          id="isEnabled"
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => setIsEnabled(event.target.checked)}
        />
        <label htmlFor="isEnabled" className={styles.label}>
          Enabled
        </label>
      </div>
      <span className={styles.helperText}>
        A disabled definition cannot be used to request a new check run.
      </span>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create definition" : "Save changes"}
        </button>
        <a href={withProjectId("/technical-center", props.projectId)} className={styles.cancelLink}>
          Cancel
        </a>
      </div>
    </form>
  );
}
