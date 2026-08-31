"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { UserSummary, WireframeRecord } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { plainTextFieldValue } from "@/lib/form-field-value";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { VIEWPORT_LABEL, VIEWPORT_VALUES } from "@/lib/wireframe-library-query";
import { RichTextEditor } from "./rich-text-editor";
import { UserPicker } from "./user-picker";
import styles from "./wireframe-library-form.module.css";

// Mirrors apps/dashboard-api/src/wireframe-library/wireframe-library.dto.ts — kept in sync by
// hand, same approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const PAGE_OR_MODULE_MAX_LENGTH = 2000;
const RELATED_TEMPLATE_ID_MAX_LENGTH = 255;
// The backend's own dto.ts keeps annotations/interactionNotes at a plain 20,000-char cap for its
// own backend-only pass (its own doc comment says so explicitly) — this UI build is what finally
// wires RichTextEditor to that already-ready backend, so the cap is raised here to match the
// doubled rich-text-markup-overhead ratio every sibling module's own UI applies once it wires
// RichTextEditor in (service-library-form.tsx's/persona-library-form.tsx's/website-strategy-
// center-form.tsx's/section-and-pattern-library-form.tsx's own identical raise) — a real,
// paired backend DTO change (see wireframe-library.dto.ts's own updated RICH_TEXT_MAX_LENGTH) went
// alongside this frontend change, not a frontend-only swap.
const RICH_TEXT_MAX_LENGTH = 40_000;

export type WireframeLibraryFormProps =
  | { readonly mode: "create" }
  | {
      readonly mode: "edit";
      readonly recordId: string;
      readonly initial: WireframeRecord;
      /** Already resolved to a display summary by the edit page's own server-side `getUser()`
       *  call — this form never resolves an id to a name itself, mirroring `ProjectForm`'s own
       *  `owner`/`ownerUserId` split and `InternalLinkForm`'s own `approver`/
       *  `assignedApproverUserId` split. `null` covers both "no reviewer assigned" and "the
       *  assigned reviewer id no longer resolves" (disabled/removed) identically. */
      readonly initialReviewer: UserSummary | null;
    };

/**
 * Create/edit form for a Wireframe Library record. No approved wireframe/screen spec exists for
 * this module — this is the smallest honest reading of the backend's actual field set, matching
 * the Section and Pattern Library/Page Template Library/Persona Library form pages' own precedent
 * for an unsourced screen.
 *
 * `publicId`/`pageOrModule` are both create-only (immutable across a record's own version chain
 * per `updateWireframeRecordSchema`'s own contract — neither is ever accepted on update) and shown
 * read-only on edit, matching `SectionAndPatternLibraryForm`'s `patternType`/`publicId`
 * convention. `approvalStatus` is deliberately never a field here — only the dedicated
 * `POST .../:recordId/status` route (`WireframeStatusActions`) may change it.
 *
 * `annotations`/`interactionNotes` use `RichTextEditor` (Tiptap), per the 2026-08-22 standing rule
 * requiring every dashboard-web long-text field to use the rich-text editor — the backend already
 * wires `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()` for exactly these two
 * fields (`wireframes.service.ts`), confirmed by reading that file directly before building this
 * form. `fileReference` is a plain `type="url"` text input, validated client-side via
 * `isSafeHttpUrl()` before submit (showing an inline error rather than relying solely on the
 * backend's own `safeHttpUrlSchema` rejection), matching `SectionAndPatternLibraryForm`'s own
 * `designReference` precedent. `relatedTemplateId` is a plain, unvalidated free-text field — no
 * `page_template_library` FK exists yet (real dependency cycle, per the module's own scope doc),
 * so it's labeled clearly as a free-text reference rather than a real picker. `reviewerUserId`
 * uses the reusable `UserPicker` component, mirroring `InternalLinkForm`'s own
 * `assignedApproverUserId` wiring.
 *
 * Editing an APPROVED record's own genuinely novel backend behavior (mirrors
 * `SectionAndPatternLibraryForm`'s/`PageTemplateLibraryForm`'s own identical divergence): rather
 * than mutating that row in place, the backend forks a brand-new draft version instead (a
 * different `id`, `versionNumber + 1`, same `recordId`) — the edit form surfaces this plainly
 * before submit (`forkNotice` below), since it's a real, surprising divergence from every other
 * module's own edit behavior in this app.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. On success, always redirects to
 * `/wireframe-library/{recordId}` using the URL's own stable `recordId` route param (not
 * `body.data.id`, which changes on a fork) — this always lands correctly on whichever row is now
 * current, whether the edit mutated in place or forked.
 */
export function WireframeLibraryForm(props: WireframeLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [pageOrModule, setPageOrModule] = useState(initial?.pageOrModule ?? "");
  const [viewport, setViewport] = useState(initial?.viewport ?? VIEWPORT_VALUES[0]);
  const [fileReference, setFileReference] = useState(initial?.fileReference ?? "");
  const [annotations, setAnnotations] = useState(initial?.annotations ?? "");
  const [interactionNotes, setInteractionNotes] = useState(initial?.interactionNotes ?? "");
  const [relatedTemplateId, setRelatedTemplateId] = useState(initial?.relatedTemplateId ?? "");
  const [reviewer, setReviewer] = useState<UserSummary | null>(
    props.mode === "edit" ? props.initialReviewer : null,
  );
  // Tracks whether the user actually interacted with the reviewer picker — as opposed to
  // `reviewer` simply being `null` because the initial reviewer id couldn't be resolved to a
  // display summary (disabled/removed account). Only an explicit interaction should ever change
  // what gets submitted for reviewerUserId, mirroring ProjectForm's own ownerTouched /
  // InternalLinkForm's own approverTouched.
  const [reviewerTouched, setReviewerTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isForkingEdit = props.mode === "edit" && props.initial.approvalStatus === "approved";

  function handleReviewerChange(next: UserSummary | null): void {
    setReviewer(next);
    setReviewerTouched(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // publicId/pageOrModule/viewport are real HTML `required` fields — the browser's own
      // constraint validation blocks a submit event from ever firing while any is empty, so no
      // redundant JS-level check is needed for them here, matching SectionAndPatternLibraryForm's
      // own precedent.
      const trimmedFileReference = fileReference.trim();

      if (trimmedFileReference !== "" && !isSafeHttpUrl(trimmedFileReference)) {
        setError("File reference must be a valid http:// or https:// URL.");
        return;
      }

      const trimmedRelatedTemplateId = relatedTemplateId.trim();

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Annotations", annotations],
        ["Interaction notes", interactionNotes],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, RICH_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      function plainField(value: string): string | null | undefined {
        return plainTextFieldValue(value, props.mode);
      }

      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const sharedFields = {
        viewport,
        fileReference: plainField(fileReference),
        annotations: richTextField(annotations),
        interactionNotes: richTextField(interactionNotes),
        relatedTemplateId:
          trimmedRelatedTemplateId !== ""
            ? trimmedRelatedTemplateId
            : props.mode === "create"
              ? undefined
              : null,
        reviewerUserId: reviewerTouched
          ? (reviewer?.id ?? null)
          : props.mode === "edit"
            ? props.initial.reviewerUserId
            : undefined,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), pageOrModule: pageOrModule.trim() }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/wireframe-library/records`
          : `${getApiBaseUrl()}/wireframe-library/records/${props.recordId}/update`;

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
      router.push(`/wireframe-library/${recordId}`);
    } catch (err) {
      console.error("Failed to save wireframe record", err);
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
            <label htmlFor="pageOrModule" className={styles.label}>
              Page / module
            </label>
            <input
              id="pageOrModule"
              type="text"
              required
              maxLength={PAGE_OR_MODULE_MAX_LENGTH}
              value={pageOrModule}
              onChange={(event) => setPageOrModule(event.target.value)}
              className={styles.input}
            />
            <span className={styles.helperText}>
              Never changeable once created — a different page/module means a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Page / module</span>
            <span className={styles.readonlyValue}>{props.initial.pageOrModule}</span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="viewport" className={styles.label}>
            Viewport
          </label>
          <select
            id="viewport"
            required
            value={viewport}
            onChange={(event) =>
              setViewport(event.target.value as (typeof VIEWPORT_VALUES)[number])
            }
            className={styles.select}
          >
            {VIEWPORT_VALUES.map((viewportValue) => (
              <option key={viewportValue} value={viewportValue}>
                {VIEWPORT_LABEL[viewportValue]}
              </option>
            ))}
          </select>
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
          <label htmlFor="fileReference" className={styles.label}>
            File reference
          </label>
          <input
            id="fileReference"
            type="url"
            value={fileReference}
            onChange={(event) => setFileReference(event.target.value)}
            className={styles.input}
            placeholder="https://…"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="annotations" className={styles.label}>
            Annotations
          </label>
          <RichTextEditor id="annotations" value={annotations} onChange={setAnnotations} />
        </div>

        <div className={styles.field}>
          <label htmlFor="interactionNotes" className={styles.label}>
            Interaction notes
          </label>
          <RichTextEditor
            id="interactionNotes"
            value={interactionNotes}
            onChange={setInteractionNotes}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <div className={styles.field}>
          <label htmlFor="relatedTemplateId" className={styles.label}>
            Related template ID
          </label>
          <input
            id="relatedTemplateId"
            type="text"
            maxLength={RELATED_TEMPLATE_ID_MAX_LENGTH}
            value={relatedTemplateId}
            onChange={(event) => setRelatedTemplateId(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Free-text reference to a Page Template Library entry — no backing link exists yet.
          </span>
        </div>

        <UserPicker
          id="reviewerUserId"
          label="Reviewer"
          value={reviewer}
          onChange={handleReviewerChange}
          helperText={
            props.mode === "edit" && !reviewerTouched && !reviewer && props.initial.reviewerUserId
              ? "This record has an assigned reviewer that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
              : "Search by name or email. Leave unset for no assigned reviewer."
          }
        />
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
            props.mode === "create" ? "/wireframe-library" : `/wireframe-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
