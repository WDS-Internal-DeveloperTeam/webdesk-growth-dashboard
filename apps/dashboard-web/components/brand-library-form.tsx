"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { BrandLibraryRecord } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { RECORD_TYPE_LABEL, RECORD_TYPE_VALUES } from "@/lib/brand-library-query";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./brand-library-form.module.css";

// Mirrors apps/dashboard-api/src/brand-library/brand-library.dto.ts — kept in sync by hand, same
// approach ContentTemplateLibraryForm/PersonaLibraryForm/ServiceLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const TITLE_MAX_LENGTH = 255;
const FILE_REFERENCE_MAX_LENGTH = 500;
const LONG_TEXT_MAX_LENGTH = 4000;

export type BrandLibraryFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: BrandLibraryRecord };

/**
 * Create/edit form for a brand library record (`03_Detailed_Module_Specifications.md §10`'s own
 * field list — no approved wireframe/screen spec exists for this module, matching the Content
 * Template/Persona/Service Library form pages' own "smallest honest reading" precedent for an
 * unsourced screen). `approvalStatus`/`version`/`isPublished`/`publishedAt` are deliberately never
 * fields here — `approvalStatus` only changes via the dedicated `POST .../:id/status` route
 * (`BrandLibraryStatusActions`), `isPublished`/`publishedAt` only change via the dedicated
 * `POST .../:id/publish`/`unpublish` routes (`BrandLibraryPublishActions`), and `version` is
 * server-managed. `publicId` and `recordType` are both create-only (shown read-only on edit,
 * matching `updateBrandLibraryRecordSchema`'s own `.omit({publicId: true, recordType: true})`
 * contract, mirroring `ProjectForm`/`ServiceLibraryForm`/`PersonaLibraryForm`/
 * `ContentTemplateLibraryForm`'s own precedent for a create-only field).
 *
 * `description`/`usageNotes` use `RichTextEditor` (Tiptap), per the 2026-08-22 standing rule
 * requiring every dashboard-web long-text field to use the rich-text editor going forward. The
 * resulting HTML is sanitized server-side before it's ever stored
 * (`brand-library.service.ts`'s `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`)
 * and again at render time on the detail page, the same double-sanitization pattern every sibling
 * module's own rich-text fields already establish.
 *
 * `fileReference` is a plain `type="url"` text input, validated client-side via `isSafeHttpUrl()`
 * before submit (showing an inline error rather than relying solely on the backend's 400) — the
 * backend's own `safeHttpUrlSchema` (`@webdesk/validation`) restricts it to `http:`/`https:`
 * server-side, closing the same stored-XSS class `ProjectEnvironment.url` once shipped with
 * unguarded.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * `ProjectForm`/`PersonaLibraryForm`/`ServiceLibraryForm`/`ContentTemplateLibraryForm` already use.
 */
export function BrandLibraryForm(props: BrandLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [recordType, setRecordType] = useState(initial?.recordType ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [fileReference, setFileReference] = useState(initial?.fileReference ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [usageNotes, setUsageNotes] = useState(initial?.usageNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // title/recordType are real HTML `required` fields — the browser's own constraint validation
      // blocks a submit event from ever firing while either is empty, so no redundant JS-level
      // check is needed for them here, matching ProjectForm/PersonaLibraryForm's own precedent.
      const trimmedTitle = title.trim();
      const trimmedFileReference = fileReference.trim();

      if (trimmedFileReference !== "" && !isSafeHttpUrl(trimmedFileReference)) {
        setError("File reference must be a valid http:// or https:// URL.");
        return;
      }

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateBrandLibraryRecordSchema's own
      // nullish contract; an explicit null is what actually clears an existing value back to
      // "none". Mirrors richTextField()'s own convention below, applied to a plain string.
      function urlField(value: string): string | null | undefined {
        if (value !== "") return value;
        return props.mode === "create" ? undefined : null;
      }

      // richTextFieldValue() (lib/rich-text.ts) carries the actual nullish-contract logic, shared
      // with content-template-library-form.tsx/persona-library-form.tsx/service-library-form.tsx.
      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Description", description],
        ["Usage notes", usageNotes],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, LONG_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        title: trimmedTitle,
        fileReference: urlField(trimmedFileReference),
        description: richTextField(description),
        usageNotes: richTextField(usageNotes),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), recordType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/brand-library/records`
          : `${getApiBaseUrl()}/brand-library/records/${props.recordId}/update`;

      const result = await postMutation<{ id: string }>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/brand-library/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save brand library record", err);
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
            <label htmlFor="recordType" className={styles.label}>
              Record type
            </label>
            <select
              id="recordType"
              required
              value={recordType}
              onChange={(event) => setRecordType(event.target.value)}
              className={styles.select}
            >
              <option value="" disabled>
                Select a record type…
              </option>
              {RECORD_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {RECORD_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Immutable once created — changing it would be a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Record type</span>
            <span className={styles.readonlyValue}>
              {RECORD_TYPE_LABEL[props.initial.recordType]}
            </span>
          </div>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="title" className={styles.label}>
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={TITLE_MAX_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="fileReference" className={styles.label}>
            File reference
          </label>
          <input
            id="fileReference"
            type="url"
            maxLength={FILE_REFERENCE_MAX_LENGTH}
            value={fileReference}
            onChange={(event) => setFileReference(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            A link to the asset itself (e.g. a Blob URL or Brand Library storage location) — only
            http:// or https:// URLs are accepted.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Description
          </label>
          <RichTextEditor id="description" value={description} onChange={setDescription} />
        </div>

        <div className={styles.field}>
          <label htmlFor="usageNotes" className={styles.label}>
            Usage notes
          </label>
          <RichTextEditor id="usageNotes" value={usageNotes} onChange={setUsageNotes} />
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create record" : "Save changes"}
        </button>
        <a
          href={props.mode === "create" ? "/brand-library" : `/brand-library/${props.recordId}`}
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
