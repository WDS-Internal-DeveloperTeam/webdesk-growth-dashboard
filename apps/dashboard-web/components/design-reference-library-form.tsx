"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { TagListField } from "@webdesk/ui";
import type { DesignReferenceRecord } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./design-reference-library-form.module.css";

// Mirrors apps/dashboard-api/src/design-reference-library/design-reference-library.dto.ts — kept
// in sync by hand, same approach BrandLibraryForm/ContentTemplateLibraryForm/PersonaLibraryForm/
// ServiceLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const TITLE_MAX_LENGTH = 255;
const URL_MAX_LENGTH = 500;
const PAGE_SECTION_TYPE_MAX_LENGTH = 255;
const RICH_TEXT_MAX_LENGTH = 4000;
const PLAIN_TEXT_MAX_LENGTH = 2000;
const TAG_MAX_LENGTH = 100;
const TAG_MAX_COUNT = 50;

export type DesignReferenceLibraryFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: DesignReferenceRecord };

/**
 * Create/edit form for a design reference record
 * (`03_Detailed_Module_Specifications.md`'s own field list — no approved wireframe/screen spec
 * exists for this module, matching the Brand/Content Template/Persona/Service Library form pages'
 * own "smallest honest reading" precedent for an unsourced screen). `approvalStatus`/`version`/
 * `isPublished`/`publishedAt` are deliberately never fields here — `approvalStatus` only changes via
 * the dedicated `POST .../:id/status` route (`DesignReferenceLibraryStatusActions`), `isPublished`/
 * `publishedAt` only change via the dedicated `POST .../:id/publish`/`unpublish` routes
 * (`DesignReferenceLibraryPublishActions`), and `version` is server-managed. `publicId` is
 * create-only (shown read-only on edit, matching `updateDesignReferenceRecordSchema`'s own
 * `.omit({publicId: true})` contract) — unlike Brand Library, there is no `recordType` field to
 * worry about (D1: this module has no discriminator, every record is the same shape).
 *
 * `likes`/`dislikes`/`motionNotes`/`accessibilityConcerns`/`performanceConcerns` use
 * `RichTextEditor` (Tiptap), per the 2026-08-22 standing rule requiring every dashboard-web
 * long-text field to use the rich-text editor going forward. The resulting HTML is sanitized
 * server-side before it's ever stored
 * (`design-reference-library.service.ts`'s `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()`) and again at render time on the detail page, the same
 * double-sanitization pattern every sibling module's own rich-text fields already establish.
 * `desktopBehavior`/`mobileBehavior` stay plain `<textarea>`s — the backend stores them as plain,
 * unsanitized text (D5), so treating them as HTML here would be dishonest.
 *
 * `sourceUrl`/`screenshotUrl` are both plain `type="url"` text inputs, validated client-side via
 * `isSafeHttpUrl()` before submit (showing an inline error rather than relying solely on the
 * backend's 400) — the backend's own `safeHttpUrlSchema` (`@webdesk/validation`) restricts both to
 * `http:`/`https:` server-side, closing the same stored-XSS class `ProjectEnvironment.url`/
 * `BrandLibraryRecord.fileReference` once shipped with unguarded.
 *
 * `tags` is a plain, unvalidated free-text tag list (`TagListField`, `@webdesk/ui`) — no backing
 * tag entity exists (D6), mirroring `PersonaLibraryForm`'s own `roles`/`industries` fields.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * `BrandLibraryForm`/`ProjectForm`/`PersonaLibraryForm`/`ServiceLibraryForm`/
 * `ContentTemplateLibraryForm` already use.
 */
export function DesignReferenceLibraryForm(props: DesignReferenceLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [screenshotUrl, setScreenshotUrl] = useState(initial?.screenshotUrl ?? "");
  const [pageSectionType, setPageSectionType] = useState(initial?.pageSectionType ?? "");
  const [likes, setLikes] = useState(initial?.likes ?? "");
  const [dislikes, setDislikes] = useState(initial?.dislikes ?? "");
  const [desktopBehavior, setDesktopBehavior] = useState(initial?.desktopBehavior ?? "");
  const [mobileBehavior, setMobileBehavior] = useState(initial?.mobileBehavior ?? "");
  const [motionNotes, setMotionNotes] = useState(initial?.motionNotes ?? "");
  const [accessibilityConcerns, setAccessibilityConcerns] = useState(
    initial?.accessibilityConcerns ?? "",
  );
  const [performanceConcerns, setPerformanceConcerns] = useState(
    initial?.performanceConcerns ?? "",
  );
  const [tags, setTags] = useState<readonly string[]>(initial?.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // title/publicId are real HTML `required` fields — the browser's own constraint validation
      // blocks a submit event from ever firing while either is empty, so no redundant JS-level
      // check is needed for them here, matching BrandLibraryForm/ProjectForm's own precedent.
      const trimmedTitle = title.trim();
      const trimmedSourceUrl = sourceUrl.trim();
      const trimmedScreenshotUrl = screenshotUrl.trim();

      if (trimmedSourceUrl !== "" && !isSafeHttpUrl(trimmedSourceUrl)) {
        setError("Source URL must be a valid http:// or https:// URL.");
        return;
      }
      if (trimmedScreenshotUrl !== "" && !isSafeHttpUrl(trimmedScreenshotUrl)) {
        setError("Screenshot URL must be a valid http:// or https:// URL.");
        return;
      }

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateDesignReferenceRecordSchema's own
      // nullish contract; an explicit null is what actually clears an existing value back to
      // "none". Mirrors richTextField()'s own convention below, applied to a plain string.
      function plainField(value: string): string | null | undefined {
        const trimmed = value.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      // richTextFieldValue() (lib/rich-text.ts) carries the actual nullish-contract logic, shared
      // with brand-library-form.tsx/content-template-library-form.tsx/service-library-form.tsx.
      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Likes", likes],
        ["Dislikes", dislikes],
        ["Motion notes", motionNotes],
        ["Accessibility concerns", accessibilityConcerns],
        ["Performance concerns", performanceConcerns],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, RICH_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        title: trimmedTitle,
        sourceUrl: plainField(sourceUrl),
        screenshotUrl: plainField(screenshotUrl),
        pageSectionType: plainField(pageSectionType),
        likes: richTextField(likes),
        dislikes: richTextField(dislikes),
        desktopBehavior: plainField(desktopBehavior),
        mobileBehavior: plainField(mobileBehavior),
        motionNotes: richTextField(motionNotes),
        accessibilityConcerns: richTextField(accessibilityConcerns),
        performanceConcerns: richTextField(performanceConcerns),
        tags,
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/design-reference-library/records`
          : `${getApiBaseUrl()}/design-reference-library/records/${props.recordId}/update`;

      const result = await postMutation<{ id: string }>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/design-reference-library/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save design reference record", err);
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
          <label htmlFor="pageSectionType" className={styles.label}>
            Page/section type
          </label>
          <input
            id="pageSectionType"
            type="text"
            maxLength={PAGE_SECTION_TYPE_MAX_LENGTH}
            value={pageSectionType}
            onChange={(event) => setPageSectionType(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            e.g. "Homepage hero," "Pricing table," "Checkout footer."
          </span>
        </div>

        <TagListField
          id="tags"
          label="Tags"
          hint="Free-text labels for this reference — no backing tag entity exists yet."
          values={tags}
          onChange={setTags}
          maxLength={TAG_MAX_LENGTH}
          maxCount={TAG_MAX_COUNT}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Reference</legend>

        <div className={styles.field}>
          <label htmlFor="sourceUrl" className={styles.label}>
            Source URL
          </label>
          <input
            id="sourceUrl"
            type="url"
            maxLength={URL_MAX_LENGTH}
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            The page this reference was captured from — only http:// or https:// URLs are accepted.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="screenshotUrl" className={styles.label}>
            Screenshot URL
          </label>
          <input
            id="screenshotUrl"
            type="url"
            maxLength={URL_MAX_LENGTH}
            value={screenshotUrl}
            onChange={(event) => setScreenshotUrl(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            A link to the captured screenshot image — only http:// or https:// URLs are accepted.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Assessment</legend>

        <div className={styles.field}>
          <label htmlFor="likes" className={styles.label}>
            Likes
          </label>
          <RichTextEditor id="likes" value={likes} onChange={setLikes} />
        </div>

        <div className={styles.field}>
          <label htmlFor="dislikes" className={styles.label}>
            Dislikes
          </label>
          <RichTextEditor id="dislikes" value={dislikes} onChange={setDislikes} />
        </div>

        <div className={styles.field}>
          <label htmlFor="desktopBehavior" className={styles.label}>
            Desktop behavior
          </label>
          <textarea
            id="desktopBehavior"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={desktopBehavior}
            onChange={(event) => setDesktopBehavior(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="mobileBehavior" className={styles.label}>
            Mobile behavior
          </label>
          <textarea
            id="mobileBehavior"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={mobileBehavior}
            onChange={(event) => setMobileBehavior(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="motionNotes" className={styles.label}>
            Motion notes
          </label>
          <RichTextEditor id="motionNotes" value={motionNotes} onChange={setMotionNotes} />
        </div>

        <div className={styles.field}>
          <label htmlFor="accessibilityConcerns" className={styles.label}>
            Accessibility concerns
          </label>
          <RichTextEditor
            id="accessibilityConcerns"
            value={accessibilityConcerns}
            onChange={setAccessibilityConcerns}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="performanceConcerns" className={styles.label}>
            Performance concerns
          </label>
          <RichTextEditor
            id="performanceConcerns"
            value={performanceConcerns}
            onChange={setPerformanceConcerns}
          />
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
              ? "/design-reference-library"
              : `/design-reference-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
