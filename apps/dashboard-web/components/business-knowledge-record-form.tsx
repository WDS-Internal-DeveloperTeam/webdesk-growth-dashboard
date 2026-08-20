"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, BusinessKnowledgeRecord } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { RECORD_TYPE_LABEL, RECORD_TYPE_VALUES } from "@/lib/business-knowledge-query";
import styles from "./business-knowledge-record-form.module.css";

export interface BusinessKnowledgeRecordFormInitialValues {
  readonly recordType: BusinessKnowledgeRecord["recordType"];
  readonly title: string;
  /** `undefined` means the record's `content` is currently redacted for this viewer (a `restricted`
   *  record and no `view_confidential` grant) — see the form's own doc comment for why that's
   *  distinguishable from "no content" (content is never optional at the data-model level; a real
   *  record always has non-empty content). */
  readonly content: string | undefined;
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
const CONTENT_MAX_LENGTH = 50_000;
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
 */
export function BusinessKnowledgeRecordForm(props: BusinessKnowledgeRecordFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  const contentRedacted = props.mode === "edit" && initial?.content === undefined;
  const notesRedacted = props.mode === "edit" && initial?.notes === undefined;

  const [recordType, setRecordType] = useState<BusinessKnowledgeRecord["recordType"]>(
    initial?.recordType ?? "company_profile",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(contentRedacted ? "" : (initial?.content ?? ""));
  const [notes, setNotes] = useState(notesRedacted ? "" : (initial?.notes ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedContent = content.trim();
      const trimmedNotes = notes.trim();

      const payload =
        props.mode === "create"
          ? {
              recordType,
              title: trimmedTitle,
              content: trimmedContent,
              notes: trimmedNotes ? trimmedNotes : null,
            }
          : {
              title: trimmedTitle,
              // Omit entirely when redacted — never send an empty string in place of content the
              // form never actually loaded, which would fail the backend's own min(1) validation
              // and, if it somehow didn't, would silently destroy real confidential content.
              ...(contentRedacted ? {} : { content: trimmedContent }),
              ...(notesRedacted ? {} : { notes: trimmedNotes ? trimmedNotes : null }),
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
      router.push(`/business-knowledge-center/${body.data.id}`);
    } catch {
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
        {contentRedacted ? (
          <p className={styles.redactedNotice}>
            This record is restricted and its content isn&apos;t visible to you, so it can&apos;t be
            edited from this form. Change the status first if you need to update the content.
          </p>
        ) : (
          <textarea
            id="content"
            rows={10}
            required
            maxLength={CONTENT_MAX_LENGTH}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className={styles.textarea}
          />
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="notes" className={styles.label}>
          Notes
        </label>
        {notesRedacted ? (
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
