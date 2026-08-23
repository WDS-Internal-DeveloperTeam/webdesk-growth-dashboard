"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { WebsiteStrategyRecord } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RECORD_TYPE_LABEL, RECORD_TYPE_VALUES } from "@/lib/website-strategy-center-query";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./website-strategy-center-form.module.css";

// Mirrors apps/dashboard-api/src/website-strategy-center/website-strategy-center.dto.ts — kept in
// sync by hand, same approach ProjectForm/ServiceLibraryForm/PersonaLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const TITLE_MAX_LENGTH = 255;
// Raised alongside the backend's own LONG_TEXT_MAX_LENGTH bump (20,000 -> 40,000) — content/notes
// are real HTML from the rich-text editor, carrying real markup overhead over the equivalent plain
// text, same reasoning as service-library-form.tsx's/persona-library-form.tsx's own identical
// raise.
const LONG_TEXT_MAX_LENGTH = 40_000;

export type WebsiteStrategyCenterFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: WebsiteStrategyRecord };

/**
 * Create/edit form for a Website Strategy Center record. No approved wireframe/screen spec exists
 * for this module — this is the smallest honest reading of the backend's actual field set
 * (`recordType`, `title`, `content`, `notes`), matching the Projects/Business Knowledge Center/
 * Persona Library list/form pages' own precedent for an unsourced screen. Deliberately simpler
 * than Service/Persona Library's own forms — this module has no tag lists, no relationship
 * pickers, and no sub-resources.
 *
 * `recordType` is create-only (immutable across a record's own version chain per
 * `updateWebsiteStrategyRecordSchema`'s own contract — never accepted on update) and shown
 * read-only on edit, matching `publicId`'s own already-established convention.
 * `approvalStatus` is deliberately never a field here — only the dedicated
 * `POST .../:recordId/status` route (`WebsiteStrategyStatusActions`) may change it.
 *
 * `content`/`notes` both use `RichTextEditor` (Tiptap), per the 2026-08-22 standing rule requiring
 * every dashboard-web long-text field to use the rich-text editor. The resulting HTML is sanitized
 * server-side before it's ever stored (`website-strategy-records.service.ts`'s
 * `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`) and again at render time on
 * the detail page, the same double-sanitization pattern every sibling module's rich-text fields
 * already establish.
 *
 * Editing an APPROVED record's own genuinely novel backend behavior (task package D3/D4): rather
 * than mutating that row in place, the backend forks a brand-new draft version instead (a
 * different `id`, `versionNumber + 1`, same `recordId`) — the edit form surfaces this plainly
 * before submit (`forkNotice` below), since it's a real, surprising divergence from every other
 * module's own edit behavior in this app.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. On success, always redirects to
 * `/website-strategy-center/{recordId}` using the URL's own `recordId` route param (not
 * `body.data.id`, which changes on a fork, and not `body.data.recordId`, which is identical but
 * requires trusting the response shape unnecessarily) — this always lands correctly on whichever
 * row is now current, whether the edit mutated in place or forked.
 */
export function WebsiteStrategyCenterForm(props: WebsiteStrategyCenterFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [recordType, setRecordType] = useState(initial?.recordType ?? RECORD_TYPE_VALUES[0]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isForkingEdit = props.mode === "edit" && props.initial.approvalStatus === "approved";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // title is a real HTML `required` field — the browser's own constraint validation blocks a
      // submit event from ever firing while it's empty, so no redundant JS-level check is needed
      // here, matching ProjectForm/ServiceLibraryForm/PersonaLibraryForm's own precedent.
      const trimmedTitle = title.trim();

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Content", content],
        ["Notes", notes],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, LONG_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      // The actual nullish-contract logic lives in lib/rich-text.ts's richTextFieldValue() —
      // shared with service-library-form.tsx/persona-library-form.tsx.
      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const sharedFields = {
        title: trimmedTitle,
        content: richTextField(content),
        notes: richTextField(notes),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), recordType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/website-strategy-center/records`
          : `${getApiBaseUrl()}/website-strategy-center/records/${props.recordId}/update`;

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

      // Edit mode always uses the URL's own stable recordId — never body.data.id/recordId, which
      // is a DIFFERENT row when this edit forked a new version (see this component's own doc
      // comment above). Create mode has no route param yet, so it must read the freshly-created
      // record's own recordId from the response.
      let recordId: string;
      if (props.mode === "create") {
        const body = (await response.json()) as { data: { recordId: string } };
        recordId = body.data.recordId;
      } else {
        recordId = props.recordId;
      }
      router.push(`/website-strategy-center/${recordId}`);
    } catch (err) {
      console.error("Failed to save website strategy record", err);
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
              onChange={(event) =>
                setRecordType(event.target.value as (typeof RECORD_TYPE_VALUES)[number])
              }
              className={styles.select}
            >
              {RECORD_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {RECORD_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Never changeable once created — a different record type means a different record.
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
      </fieldset>

      {isForkingEdit ? (
        <p className={styles.forkNotice}>
          This record is approved. Saving changes here won&apos;t modify the approved version — it
          creates a new draft version instead, leaving the currently-approved content untouched
          until the new draft is itself approved.
        </p>
      ) : null}

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="content" className={styles.label}>
            Content
          </label>
          <RichTextEditor id="content" value={content} onChange={setContent} />
        </div>

        <div className={styles.field}>
          <label htmlFor="notes" className={styles.label}>
            Notes
          </label>
          <RichTextEditor id="notes" value={notes} onChange={setNotes} />
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
          href={
            props.mode === "create"
              ? "/website-strategy-center"
              : `/website-strategy-center/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
