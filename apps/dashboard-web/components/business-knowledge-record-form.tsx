"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, BusinessKnowledgeRecord } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  formatAttachmentSize,
  uploadAttachment,
  validateAttachmentFile,
} from "@/lib/business-knowledge-attachments";
import { RECORD_TYPE_LABEL, RECORD_TYPE_VALUES } from "@/lib/business-knowledge-query";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./business-knowledge-record-form.module.css";

export interface BusinessKnowledgeRecordFormInitialValues {
  readonly recordType: BusinessKnowledgeRecord["recordType"];
  readonly title: string;
  /** `undefined` means the record's `content` is currently redacted for this viewer (a `restricted`
   *  record and no `view_confidential` grant). `null` means a real, visible record with no typed
   *  content at all (its content may live entirely in its attachments) — distinct from redaction,
   *  not a placeholder for it. */
  readonly content: string | null | undefined;
  /** `undefined` means redacted, same as `content` above. `null` means "genuinely no notes, and
   *  visible" — a real, distinct value from redaction, not a placeholder for it. */
  readonly notes: string | null | undefined;
}

export type BusinessKnowledgeRecordFormProps =
  | { readonly mode: "create" }
  | {
      readonly mode: "edit";
      readonly recordId: string;
      readonly initial: BusinessKnowledgeRecordFormInitialValues;
    };

// Mirrors apps/dashboard-api/src/business-knowledge/business-knowledge.dto.ts's
// createBusinessKnowledgeRecordSchema/updateBusinessKnowledgeRecordSchema — kept in sync by hand,
// same approach components/project-form.tsx already uses for the Projects module.
const TITLE_MAX_LENGTH = 255;
// Raised from 50_000 alongside the backend's own CONTENT_MAX_LENGTH bump
// (business-knowledge-center-rich-content-attachments.md) — content is now HTML from the rich-text
// editor, carrying real markup overhead over the equivalent plain text.
const CONTENT_MAX_LENGTH = 100_000;
const NOTES_MAX_LENGTH = 10_000;

/**
 * Create/edit form for a business knowledge record — `recordType`/`title`/`content`/`notes` only;
 * `status` is deliberately never a field here (task package D4: only the dedicated
 * `POST .../:id/status` route, via `BusinessKnowledgeStatusActions`, may change it — matching
 * `updateBusinessKnowledgeRecordSchema`'s own contract, which doesn't accept a `status` field at
 * all). `recordType` is create-only: `updateBusinessKnowledgeRecordSchema` doesn't accept it either
 * ("reclassifying an existing record's type is a data question this V1 doesn't handle"), so the
 * edit form shows it as read-only reference text, matching `ProjectForm`'s own `publicId` pattern.
 *
 * A `restricted` record's `content`/`notes` may be redacted for the current viewer (no
 * `view_confidential` grant — currently every viewer, since that action is zero-seeded for every
 * role). Letting someone "edit blind" against content they've never actually seen would risk
 * silently overwriting real confidential content with whatever an empty textarea submits — so a
 * redacted field renders as an inert notice instead of an editable input, and is omitted entirely
 * from the submit payload (the backend leaves it unchanged), rather than coerced to an empty
 * string.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"`, the same pattern
 * `ProjectForm`/`BusinessKnowledgeStatusActions` already use.
 *
 * Create mode also offers a file picker (edit mode doesn't — attachments already have their own
 * dedicated upload control on the detail page, `BusinessKnowledgeAttachmentsSection`). An
 * attachment's `record_id` is a real database foreign key, so it can't be created before the
 * record itself exists — files picked here are only staged client-side (never uploaded) until
 * `handleSubmit` creates the record and learns its real id, at which point each staged file is
 * uploaded via the same `uploadAttachment()` helper the detail page's own upload control uses. If
 * the record is created but one or more staged uploads then fail, the failure is surfaced but
 * navigation still proceeds — the record itself was saved successfully, and any attachment that
 * didn't make it can be retried from the detail page's own upload control.
 */
export function BusinessKnowledgeRecordForm(props: BusinessKnowledgeRecordFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  // A restricted record's content/notes are always redacted together (one canViewConfidential
  // check gates both — see business-knowledge-records.controller.ts's CONFIDENTIAL_RESTRICTED_FIELDS),
  // so one flag derived from `content` (never legitimately absent otherwise) covers both fields —
  // matching the detail page's own single `isRedacted` check, not two independently-tracked flags
  // that can never actually differ in practice.
  const redacted = props.mode === "edit" && initial?.content === undefined;

  const [recordType, setRecordType] = useState<BusinessKnowledgeRecord["recordType"]>(
    initial?.recordType ?? "company_profile",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(redacted ? "" : (initial?.content ?? ""));
  const [notes, setNotes] = useState(redacted ? "" : (initial?.notes ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<readonly File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  // Set once the record itself has actually been created (create mode only) — even if some
  // staged attachments then fail to upload. Once set, the form must never be resubmitted (a
  // second submit would call POST /business-knowledge/records again and create a *second*,
  // duplicate record) — the UI switches to a "View record" link instead.
  const [createdRecordId, setCreatedRecordId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(files: FileList): void {
    setAttachmentError(null);
    const accepted: File[] = [];
    const rejections: string[] = [];
    for (const file of Array.from(files)) {
      const validationError = validateAttachmentFile(file);
      if (validationError) {
        rejections.push(`${file.name}: ${validationError}`);
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length > 0) {
      setPendingFiles((current) => [...current, ...accepted]);
    }
    if (rejections.length > 0) {
      setAttachmentError(rejections.join(" "));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveStagedFile(index: number): void {
    setPendingFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedTitle = title.trim();
      // The Tiptap editor's own "nothing typed" output is "<p></p>", not "" — both count as no
      // real content.
      const isContentEmpty = content.trim() === "" || content.trim() === "<p></p>";
      const trimmedNotes = notes.trim();
      const notesValue = trimmedNotes ? trimmedNotes : null;

      if (content.length > CONTENT_MAX_LENGTH) {
        setError(`Content is too long (max ${CONTENT_MAX_LENGTH.toLocaleString()} characters).`);
        return;
      }

      const payload =
        props.mode === "create"
          ? {
              recordType,
              title: trimmedTitle,
              // Omitted entirely (never an empty string) when nothing was typed — an attachment-
              // only record, per the backend's now-nullable content column; sending "" would store
              // a real empty string instead of the honest "no content" null.
              ...(isContentEmpty ? {} : { content }),
              notes: notesValue,
            }
          : {
              title: trimmedTitle,
              // Omit entirely when redacted — never send an empty string in place of content the
              // form never actually loaded, which would silently destroy real confidential content.
              // When visible, an explicit `null` (not omission) is what actually clears existing
              // content back to "no content" — omitting the key means "leave unchanged" to
              // updateBusinessKnowledgeRecordSchema, which would otherwise leave a cleared editor's
              // emptiness un-persisted.
              ...(redacted ? {} : { content: isContentEmpty ? null : content, notes: notesValue }),
            };

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/business-knowledge/records`
          : `${getApiBaseUrl()}/business-knowledge/records/${props.recordId}/update`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }

      const body = (await response.json()) as ApiSuccessResponse<BusinessKnowledgeRecord>;
      const recordId = body.data.id;
      if (props.mode === "create") {
        setCreatedRecordId(recordId);
      }

      if (props.mode === "create" && pendingFiles.length > 0) {
        const results = await Promise.allSettled(
          pendingFiles.map((file) => uploadAttachment(recordId, file)),
        );
        const failed = results
          .map((result, index) => ({ result, file: pendingFiles[index] }))
          .filter(
            (entry): entry is { result: PromiseRejectedResult; file: File } =>
              entry.result.status === "rejected",
          );
        if (failed.length > 0) {
          console.error(
            "Some attachments failed to upload after record creation",
            failed.map((entry) => entry.result.reason),
          );
          setError(
            `The record was created, but ${failed.length} of ${pendingFiles.length} file(s) failed to upload: ${failed
              .map((entry) => entry.file.name)
              .join(", ")}. You can retry from the record's detail page.`,
          );
          return;
        }
      }

      router.push(`/business-knowledge-center/${recordId}`);
    } catch (err) {
      console.error("Failed to save business knowledge record", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {props.mode === "create" ? (
        <div className={styles.field}>
          <label htmlFor="recordType" className={styles.label}>
            Record type
          </label>
          <select
            id="recordType"
            value={recordType}
            onChange={(event) =>
              setRecordType(event.target.value as BusinessKnowledgeRecord["recordType"])
            }
            className={styles.select}
          >
            {RECORD_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {RECORD_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className={styles.field}>
          <span className={styles.label}>Record type</span>
          <span className={styles.readonlyValue}>
            {RECORD_TYPE_LABEL[props.initial.recordType]}
          </span>
          <span className={styles.helperText}>
            Fixed once a record is created. Create a new record to reclassify.
          </span>
        </div>
      )}

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
        <label htmlFor="content" className={styles.label}>
          Content
        </label>
        {redacted ? (
          <p className={styles.redactedNotice}>
            This record is restricted and its content isn&apos;t visible to you, so it can&apos;t be
            edited from this form. Change the status first if you need to update the content.
          </p>
        ) : (
          <>
            <RichTextEditor
              id="content"
              value={content}
              // Always accept the editor's own output into state, even past CONTENT_MAX_LENGTH —
              // rejecting the update here by re-setting state to its own unchanged value is a
              // React no-op (Object.is-equal setState never re-renders), which meant this
              // component's own value prop never changed either, so RichTextEditor's
              // useEffect([value, editor]) never re-fired to correct Tiptap's internal document
              // back down: the editor silently went uncontrolled. The real length limit is now
              // enforced once, clearly, at submit time (see handleSubmit) instead of via a silent
              // per-keystroke rejection with no feedback.
              onChange={setContent}
              placeholder="Optional — leave blank if this record's content will live entirely in an attached file."
            />
            <span className={styles.helperText}>
              {props.mode === "create"
                ? "Optional. You can also attach a file (DOCX, XLSX, PDF, or Markdown) below, instead of or in addition to typed content."
                : "Optional. You can attach a file (DOCX, XLSX, PDF, or Markdown) from the record's detail page, instead of or in addition to typed content."}
            </span>
          </>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="notes" className={styles.label}>
          Notes
        </label>
        {redacted ? (
          <p className={styles.redactedNotice}>
            This record is restricted and its notes aren&apos;t visible to you.
          </p>
        ) : (
          <textarea
            id="notes"
            rows={3}
            maxLength={NOTES_MAX_LENGTH}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={styles.textarea}
          />
        )}
      </div>

      {props.mode === "create" ? (
        <div className={styles.field}>
          <span className={styles.label}>Attachments</span>
          <label className={styles.uploadButton}>
            Add file
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_ATTACHMENT_EXTENSIONS}
              multiple
              disabled={submitting || createdRecordId !== null}
              className={styles.fileInput}
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) {
                  handleFilesSelected(event.target.files);
                }
              }}
            />
          </label>
          <span className={styles.helperText}>
            PDF, DOCX, XLSX, or Markdown — up to 25 MB each.
          </span>

          {attachmentError ? (
            <p role="alert" className={styles.error}>
              {attachmentError}
            </p>
          ) : null}

          {pendingFiles.length > 0 ? (
            <ul className={styles.stagedList}>
              {pendingFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className={styles.stagedItem}>
                  <span>
                    <span className={styles.stagedName}>{file.name}</span>
                    <span className={styles.stagedSize}>({formatAttachmentSize(file.size)})</span>
                  </span>
                  <button
                    type="button"
                    disabled={submitting || createdRecordId !== null}
                    onClick={() => handleRemoveStagedFile(index)}
                    className={styles.removeStagedButton}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        {createdRecordId ? (
          <a href={`/business-knowledge-center/${createdRecordId}`} className={styles.submitButton}>
            View record
          </a>
        ) : (
          <button type="submit" disabled={submitting} className={styles.submitButton}>
            {submitting ? "Saving…" : props.mode === "create" ? "Create record" : "Save changes"}
          </button>
        )}
        <a
          href={
            props.mode === "create"
              ? "/business-knowledge-center"
              : `/business-knowledge-center/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
