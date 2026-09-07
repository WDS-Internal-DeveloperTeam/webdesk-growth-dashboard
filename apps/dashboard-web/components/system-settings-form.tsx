"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { SystemSetting } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { SETTING_TYPE_LABEL, SETTING_TYPE_VALUES } from "@/lib/system-settings-query";
import styles from "./system-settings-form.module.css";

// Mirrors apps/dashboard-api/src/system-settings/system-settings.dto.ts — kept in sync by hand,
// same approach ImportTemplateForm/BrandLibraryForm/ServiceLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const KEY_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;

export type SystemSettingFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly settingId: string; readonly initial: SystemSetting };

/**
 * Create/edit form for a system setting. No approved wireframe/screen spec exists for this
 * module — sections mirror `createSystemSettingSchema`'s own field grouping, the smallest honest
 * reading of the backend's actual field set, matching every sibling module's own "smallest honest
 * reading" precedent.
 *
 * `publicId`/`settingType` are both create-only (shown read-only on edit) — both immutable after
 * creation per `updateSystemSettingSchema`'s own `.omit({publicId, settingType})` contract
 * (changing `settingType` after creation would be a different record, D1). `isActive` is
 * deliberately never a field here — it only changes via the dedicated
 * `POST .../:id/active-state` route (`SystemSettingActiveStateActions`), gated on the `configure`
 * RBAC action rather than `edit` (D4).
 *
 * `value` is a raw-JSON `<textarea>` — the backend's own `boundedJsonObjectSchema()` deliberately
 * validates no per-`settingType` shape, only a byte-size cap, so this form doesn't attempt one
 * either. Parsed with `JSON.parse()` on submit inside a try/catch, surfacing a clear client-side
 * error before ever calling `postMutation()`, mirroring `ImportTemplateForm`'s own identical
 * `columnMapping` handling. Required on create (matches the backend's own non-nullish `value`
 * field); left blank on edit means "leave unchanged" (omitted from the payload) — there is no way
 * to clear it to `null`, since `value` isn't nullable on either DTO.
 *
 * `description` is a plain `<textarea>`, not `RichTextEditor` — the backend's own DTO comment is
 * explicit that this is "internal config, not authored content," so no sanitization is wired and
 * treating it as HTML would be dishonest, the same reasoning `ReadyForClaudeTaskForm`'s plain-text
 * fields already establish for a backend field that stores unsanitized plain text on purpose.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — `POST /system-settings/settings` on create,
 * `POST /system-settings/settings/:id/update` on edit, matching the controller's own real route
 * shape.
 */
export function SystemSettingForm(props: SystemSettingFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [settingType, setSettingType] = useState(initial?.settingType ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [value, setValue] = useState(initial ? JSON.stringify(initial.value, null, 2) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    const trimmedDescription = description.trim();

    let parsedValue: Record<string, unknown> | undefined;
    if (trimmedValue === "") {
      if (props.mode === "create") {
        setError("Value is required.");
        return;
      }
      // Left blank on edit: omit the key entirely, leaving the stored value unchanged.
      parsedValue = undefined;
    } else {
      try {
        const parsed: unknown = JSON.parse(trimmedValue);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        parsedValue = parsed as Record<string, unknown>;
      } catch {
        setError("Value must be valid JSON (an object).");
        return;
      }
    }

    // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
    // leaves the field unchanged on update, matching updateSystemSettingSchema's own nullish
    // contract; an explicit null is what actually clears an existing value back to "none".
    const descriptionField: string | null | undefined =
      trimmedDescription !== "" ? trimmedDescription : props.mode === "create" ? undefined : null;

    setSubmitting(true);
    try {
      const sharedFields = {
        key: trimmedKey,
        value: parsedValue,
        description: descriptionField,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), settingType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/system-settings/settings`
          : `${getApiBaseUrl()}/system-settings/settings/${props.settingId}/update`;

      const result = await postMutation<{ id: string }>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/system-settings/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save system setting", err);
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

        {props.mode === "create" ? (
          <div className={styles.field}>
            <label htmlFor="settingType" className={styles.label}>
              Setting type
            </label>
            <select
              id="settingType"
              required
              value={settingType}
              onChange={(event) => setSettingType(event.target.value)}
              className={styles.select}
            >
              <option value="" disabled>
                Select a setting type…
              </option>
              {SETTING_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {SETTING_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Immutable once created — changing it would be a different setting.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Setting type</span>
            <span className={styles.readonlyValue}>
              {SETTING_TYPE_LABEL[props.initial.settingType]}
            </span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="key" className={styles.label}>
            Key
          </label>
          <input
            id="key"
            type="text"
            required
            maxLength={KEY_MAX_LENGTH}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="value" className={styles.label}>
            Value (JSON){props.mode === "edit" ? ", optional" : ""}
          </label>
          <textarea
            id="value"
            required={props.mode === "create"}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={`${styles.textarea} ${styles.monospace}`}
            rows={10}
            placeholder={'{\n  "maxBytes": 10485760,\n  "allowedMimeTypes": ["application/pdf"]\n}'}
          />
          <span className={styles.helperText}>
            No per-setting-type schema is enforced beyond a 50,000-byte size cap. Must be valid JSON
            (an object).
            {props.mode === "edit" ? " Leave blank to keep the current value unchanged." : ""}
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Description
          </label>
          <textarea
            id="description"
            maxLength={DESCRIPTION_MAX_LENGTH}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={styles.textarea}
            rows={4}
          />
          <span className={styles.helperText}>
            Plain text only — this is internal configuration, not authored content.
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
          {submitting ? "Saving…" : props.mode === "create" ? "Create setting" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create" ? "/system-settings" : `/system-settings/${props.settingId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
