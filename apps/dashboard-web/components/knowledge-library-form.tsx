"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type {
  ApiSuccessResponse,
  KnowledgeLibraryRecord,
  KnowledgeLibraryRecordConfidentiality,
  UserSummary,
} from "@webdesk/shared-types";
import { TagListField } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/datetime-local";
import { plainTextFieldValue } from "@/lib/form-field-value";
import { CONFIDENTIALITY_LABEL, CONFIDENTIALITY_VALUES } from "@/lib/knowledge-library-query";
import { arrayFieldValue, findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import { UserPicker } from "./user-picker";
import styles from "./knowledge-library-form.module.css";

// Mirrors apps/dashboard-api/src/knowledge-library/knowledge-library.dto.ts — kept in sync by
// hand, same approach every sibling form in this app uses.
const TITLE_MAX_LENGTH = 255;
const SOURCE_TYPE_MAX_LENGTH = 100;
const LOCATION_MAX_LENGTH = 2_048;
const NOTES_MAX_LENGTH = 20_000;
const RELATED_ENTITY_IDS_MAX = 100;

export interface KnowledgeLibraryFormInitialValues {
  readonly title: string;
  /** `undefined` means the field is currently redacted for this viewer (a `restricted` record and
   *  no `view_confidential` grant) — `null` means a real, visible record with the field genuinely
   *  unset. All three of `sourceType`/`location`/`notes` are redacted together (one
   *  `canViewConfidential` check gates all three server-side), so one flag derived from `notes`
   *  covers all three, matching `BusinessKnowledgeRecordForm`'s own single-flag precedent. */
  readonly sourceType: string | null | undefined;
  readonly location: string | null | undefined;
  readonly ownerUserId: string | null;
  /** Already resolved to a real display summary by the edit page's own server-side `getUser()`
   *  call — this form never resolves an id to a name itself, mirroring `ProjectForm`'s own
   *  `owner`/`ownerUserId` split. `null` covers both "no owner assigned" and "the assigned owner
   *  id no longer resolves" (disabled/removed) identically. */
  readonly owner: UserSummary | null;
  readonly sourceDate: string | null;
  readonly confidentiality: KnowledgeLibraryRecordConfidentiality;
  readonly approvedForAgentUse: boolean;
  readonly notes: string | null | undefined;
  readonly relatedEntityIds: readonly string[];
  readonly lastReviewedAt: string | null;
}

export type KnowledgeLibraryFormProps =
  | { readonly mode: "create" }
  | {
      readonly mode: "edit";
      readonly recordId: string;
      readonly initial: KnowledgeLibraryFormInitialValues;
    };

/**
 * Create/edit form for a Knowledge Library record. No approved wireframe/screen spec exists for
 * this module (`03_Detailed_Module_Specifications.md §28` is a flat field list) — every field
 * mirrors the backend's actual `createKnowledgeLibraryRecordSchema`/
 * `updateKnowledgeLibraryRecordSchema` directly, matching every sibling module's own "smallest
 * honest reading" precedent for an unsourced screen.
 *
 * `status` is deliberately never a field here — only the dedicated `POST .../:id/status` route
 * (`KnowledgeLibraryStatusActions`) may change it, matching `updateKnowledgeLibraryRecordSchema`'s
 * own contract, which doesn't accept a `status` field at all. `confidentiality` IS a plain editable
 * field here (unlike `status`) — the spec describes no workflow for it, only for
 * mandatory/advisory (matching `knowledge-library-records.controller.ts`'s own doc comment).
 *
 * `sourceType`/`location`/`notes` may be redacted for the current viewer on a `restricted` record
 * (no `view_confidential` grant — currently every viewer, since that action is zero-seeded for
 * every role). Letting someone "edit blind" against content they've never actually seen would risk
 * silently overwriting real confidential content with whatever an empty input submits — so a
 * redacted field renders as an inert notice instead of an editable input, and is omitted entirely
 * from the submit payload (the backend leaves it unchanged), matching
 * `BusinessKnowledgeRecordForm`'s/`ServiceLibraryForm`'s own redaction convention.
 *
 * `notes` uses `RichTextEditor` per the 2026-08-22 standing rule (real backend sanitization wired
 * into `KnowledgeLibraryRecordsService.create()`/`update()`); `sourceType`/`location` stay plain
 * text inputs — `location` deliberately not URL-validated (a reference source's location may
 * genuinely be a URL, an internal file path, or a citation, per the backend's own doc comment).
 * `relatedEntityIds` is a free-text `TagListField` (unvalidated, matching Service Library's own
 * `icpIds` shape) — "related entities" isn't scoped to any single other module in the spec, so no
 * existence-check target exists.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses.
 */
export function KnowledgeLibraryForm(props: KnowledgeLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  const redacted = props.mode === "edit" && initial?.notes === undefined;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [sourceType, setSourceType] = useState(redacted ? "" : (initial?.sourceType ?? ""));
  const [location, setLocation] = useState(redacted ? "" : (initial?.location ?? ""));
  const [owner, setOwner] = useState<UserSummary | null>(initial?.owner ?? null);
  // Tracks whether the user has actually interacted with the owner picker — as opposed to `owner`
  // simply being `null` because the initial owner id couldn't be resolved to a display summary
  // (disabled/removed account). Only an explicit interaction should ever change what gets
  // submitted for ownerUserId, mirroring `ProjectForm`'s own `ownerTouched`.
  const [ownerTouched, setOwnerTouched] = useState(false);
  const [sourceDate, setSourceDate] = useState(initial?.sourceDate ?? "");
  const [confidentiality, setConfidentiality] = useState<KnowledgeLibraryRecordConfidentiality>(
    initial?.confidentiality ?? "internal",
  );
  const [approvedForAgentUse, setApprovedForAgentUse] = useState(
    initial?.approvedForAgentUse ?? false,
  );
  const [notes, setNotes] = useState(redacted ? "" : (initial?.notes ?? ""));
  const [relatedEntityIds, setRelatedEntityIds] = useState<readonly string[]>(
    initial?.relatedEntityIds ?? [],
  );
  const [lastReviewedAt, setLastReviewedAt] = useState(
    toDateTimeLocalValue(initial?.lastReviewedAt ?? null),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleOwnerChange(next: UserSummary | null): void {
    setOwner(next);
    setOwnerTouched(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const textField = (value: string): string | null | undefined =>
        plainTextFieldValue(value, props.mode);
      const richField = (value: string): string | null | undefined =>
        richTextFieldValue(value, props.mode);

      const lengthError = findOverLongRichTextField([["Notes", notes]], NOTES_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      // If the owner picker was never touched, preserve the record's existing ownerUserId exactly
      // as-is (including an unresolvable id), rather than accidentally clearing it to null just
      // because `owner` (the resolved display summary) happens to be null — mirroring
      // `ProjectForm`'s own `ownerTouched` logic.
      const ownerUserId = ownerTouched ? (owner?.id ?? null) : (initial?.ownerUserId ?? null);

      const sharedFields = {
        title: title.trim(),
        // Omitted entirely when redacted — never send an empty string in place of a value the
        // form never actually loaded, which would silently destroy real confidential content.
        ...(redacted
          ? {}
          : {
              sourceType: textField(sourceType),
              location: textField(location),
              notes: richField(notes),
            }),
        ownerUserId,
        sourceDate: textField(sourceDate),
        confidentiality,
        approvedForAgentUse,
        relatedEntityIds: arrayFieldValue(relatedEntityIds, props.mode),
        lastReviewedAt:
          fromDateTimeLocalValue(lastReviewedAt) ?? (props.mode === "create" ? undefined : null),
      };

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/knowledge-library/records`
          : `${getApiBaseUrl()}/knowledge-library/records/${props.recordId}/update`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sharedFields),
      });

      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }

      const body = (await response.json()) as ApiSuccessResponse<KnowledgeLibraryRecord>;
      router.push(`/knowledge-library/${body.data.id}`);
    } catch (err) {
      console.error("Failed to save knowledge library record", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
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
        <label htmlFor="sourceType" className={styles.label}>
          Source type
        </label>
        {redacted ? (
          <p className={styles.redactedNotice}>
            This record is restricted and its source type isn&apos;t visible to you.
          </p>
        ) : (
          <>
            <input
              id="sourceType"
              type="text"
              maxLength={SOURCE_TYPE_MAX_LENGTH}
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
              className={styles.input}
            />
            <span className={styles.helperText}>
              Plain free text — no fixed taxonomy exists for this field.
            </span>
          </>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="location" className={styles.label}>
          Location
        </label>
        {redacted ? (
          <p className={styles.redactedNotice}>
            This record is restricted and its location isn&apos;t visible to you.
          </p>
        ) : (
          <>
            <input
              id="location"
              type="text"
              maxLength={LOCATION_MAX_LENGTH}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className={styles.input}
            />
            <span className={styles.helperText}>
              A URL, an internal file path, or a citation — plain text, not rendered as a link.
            </span>
          </>
        )}
      </div>

      <UserPicker
        id="owner"
        label="Owner"
        value={owner}
        onChange={handleOwnerChange}
        helperText={
          props.mode === "edit" && !ownerTouched && !owner && initial?.ownerUserId
            ? "This record has an assigned owner that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
            : "Search by name or email. Leave unset for no assigned owner."
        }
      />

      <div className={styles.field}>
        <label htmlFor="sourceDate" className={styles.label}>
          Source date
        </label>
        <input
          id="sourceDate"
          type="date"
          value={sourceDate}
          onChange={(event) => setSourceDate(event.target.value)}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="confidentiality" className={styles.label}>
          Confidentiality
        </label>
        <select
          id="confidentiality"
          value={confidentiality}
          onChange={(event) =>
            setConfidentiality(event.target.value as KnowledgeLibraryRecordConfidentiality)
          }
          className={styles.select}
        >
          {CONFIDENTIALITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {CONFIDENTIALITY_LABEL[value]}
            </option>
          ))}
        </select>
        <span className={styles.helperText}>
          Independent of status — a record may be restricted at any lifecycle stage, including
          draft.
        </span>
      </div>

      <div className={styles.checkboxField}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={approvedForAgentUse}
            onChange={(event) => setApprovedForAgentUse(event.target.checked)}
          />
          Approved for agent use
        </label>
        <span className={styles.helperText}>
          No enforcement point exists yet anywhere in this app — stored, not yet acted on.
        </span>
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
          <RichTextEditor id="notes" value={notes} onChange={setNotes} placeholder="Optional" />
        )}
      </div>

      <div className={styles.field}>
        <TagListField
          id="relatedEntityIds"
          label="Related entities"
          hint="Unvalidated — not scoped to any single other module yet."
          values={relatedEntityIds}
          onChange={setRelatedEntityIds}
          maxLength={255}
          maxCount={RELATED_ENTITY_IDS_MAX}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="lastReviewedAt" className={styles.label}>
          Last reviewed at
        </label>
        <input
          id="lastReviewedAt"
          type="datetime-local"
          value={lastReviewedAt}
          onChange={(event) => setLastReviewedAt(event.target.value)}
          className={styles.input}
        />
        <span className={styles.helperText}>
          No dedicated &quot;mark reviewed&quot; action exists — set this by hand.
        </span>
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
            props.mode === "create" ? "/knowledge-library" : `/knowledge-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
