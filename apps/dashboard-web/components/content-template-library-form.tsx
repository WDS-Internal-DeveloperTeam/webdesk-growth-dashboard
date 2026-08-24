"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ContentTemplate } from "@webdesk/shared-types";
import { TagListField } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./content-template-library-form.module.css";

// Mirrors apps/dashboard-api/src/content-template-library/content-template-library.dto.ts — kept
// in sync by hand, same approach ProjectForm/PersonaLibraryForm/ServiceLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const PAGE_TYPE_MAX_LENGTH = 255;
// Raised alongside the backend's own LONG_TEXT_MAX_LENGTH bump (2000 -> 4000) — these 6 fields are
// now HTML from the rich-text editor, carrying real markup overhead over the equivalent plain
// text, same reasoning as persona-library-form.tsx's/service-library-form.tsx's own identical raise.
const LONG_TEXT_MAX_LENGTH = 4000;
const SECTION_TAG_MAX_LENGTH = 255;
const SECTION_TAG_MAX_COUNT = 100;

export type ContentTemplateLibraryFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly templateId: string; readonly initial: ContentTemplate };

/**
 * Create/edit form for a content template (`03_Detailed_Module_Specifications.md §25`'s own field
 * list — no approved wireframe/screen spec exists for this module, matching the Projects/Persona
 * Library/Service Library list/form pages' own "smallest honest reading" precedent for an
 * unsourced screen). `approvalStatus`/`version`/`isPublished`/`publishedAt` are deliberately never
 * fields here — `approvalStatus` only changes via the dedicated `POST .../:id/status` route
 * (`ContentTemplateStatusActions`), `isPublished`/`publishedAt` only change via the dedicated
 * `POST .../:id/publish`/`unpublish` routes (`ContentTemplatePublishActions`), and `version` is
 * server-managed. `publicId` is create-only (shown read-only on edit, matching
 * `ProjectForm`/`ServiceLibraryForm`/`PersonaLibraryForm`'s own precedent).
 *
 * Every long-text field here (`purpose`/`proofRules`/`seoAeoGeoRequirements`/`schema`/`ctaRules`/
 * `contentDepthGuidance`) uses `RichTextEditor` (Tiptap), per the 2026-08-22 standing rule
 * requiring every dashboard-web long-text field to use the rich-text editor going forward. The
 * resulting HTML is sanitized server-side before it's ever stored
 * (`content-templates.service.ts`'s `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()`) and again at render time on the detail page, the same
 * double-sanitization pattern `PersonaLibraryForm`'s/`ServiceLibraryForm`'s own fields already
 * establish.
 *
 * `requiredSections`/`optionalSections` are free-text tag lists (`TagListField`, unvalidated,
 * matching task package D7) — a genuinely nullable column at the database layer, distinct from an
 * empty array; an empty tag list on submit is treated the same as any other emptied field (omitted
 * on create, sent as an explicit `null` on edit to clear it), rather than serialized as a literal
 * `[]`, mirroring every plain-text field's own nullish-contract convention in this form.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * `ProjectForm`/`PersonaLibraryForm`/`ServiceLibraryForm` already use.
 */
export function ContentTemplateLibraryForm(props: ContentTemplateLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [pageType, setPageType] = useState(initial?.pageType ?? "");
  const [requiredSections, setRequiredSections] = useState<readonly string[]>(
    initial?.requiredSections ?? [],
  );
  const [optionalSections, setOptionalSections] = useState<readonly string[]>(
    initial?.optionalSections ?? [],
  );
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [proofRules, setProofRules] = useState(initial?.proofRules ?? "");
  const [seoAeoGeoRequirements, setSeoAeoGeoRequirements] = useState(
    initial?.seoAeoGeoRequirements ?? "",
  );
  const [schema, setSchema] = useState(initial?.schema ?? "");
  const [ctaRules, setCtaRules] = useState(initial?.ctaRules ?? "");
  const [contentDepthGuidance, setContentDepthGuidance] = useState(
    initial?.contentDepthGuidance ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // pageType is a real HTML `required` field — the browser's own constraint validation blocks
      // a submit event from ever firing while it's empty, so no redundant JS-level check is needed
      // here, matching ProjectForm/PersonaLibraryForm/ServiceLibraryForm's own precedent.
      const trimmedPageType = pageType.trim();

      // Free-text array fields: omitted entirely (create) or sent as an explicit null (edit) when
      // empty — an omitted key leaves the field unchanged on update, matching
      // updateContentTemplateSchema's own nullish contract; an explicit null is what actually
      // clears an existing value back to "none". Mirrors textField()'s own convention below,
      // applied to an array instead of a string.
      function sectionsField(values: readonly string[]): readonly string[] | null | undefined {
        if (values.length > 0) return values;
        return props.mode === "create" ? undefined : null;
      }

      // richTextFieldValue() (lib/rich-text.ts) carries the actual nullish-contract logic, shared
      // with persona-library-form.tsx/service-library-form.tsx.
      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Purpose", purpose],
        ["Proof rules", proofRules],
        ["SEO/AEO/GEO requirements", seoAeoGeoRequirements],
        ["Schema", schema],
        ["CTA rules", ctaRules],
        ["Content-depth guidance", contentDepthGuidance],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, LONG_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        pageType: trimmedPageType,
        requiredSections: sectionsField(requiredSections),
        optionalSections: sectionsField(optionalSections),
        purpose: richTextField(purpose),
        proofRules: richTextField(proofRules),
        seoAeoGeoRequirements: richTextField(seoAeoGeoRequirements),
        schema: richTextField(schema),
        ctaRules: richTextField(ctaRules),
        contentDepthGuidance: richTextField(contentDepthGuidance),
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/content-template-library/templates`
          : `${getApiBaseUrl()}/content-template-library/templates/${props.templateId}/update`;

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

      const body = (await response.json()) as { data: { id: string } };
      router.push(`/content-template-library/${body.data.id}`);
    } catch (err) {
      console.error("Failed to save content template", err);
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
          <label htmlFor="pageType" className={styles.label}>
            Page type
          </label>
          <input
            id="pageType"
            type="text"
            required
            maxLength={PAGE_TYPE_MAX_LENGTH}
            value={pageType}
            onChange={(event) => setPageType(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            A category label (e.g. &ldquo;Service Page&rdquo;, &ldquo;Blog Post&rdquo;), not a
            reference to any specific page.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Sections</legend>

        <TagListField
          id="requiredSections"
          label="Required sections"
          hint="Sections every page built from this template must include."
          values={requiredSections}
          onChange={setRequiredSections}
          maxLength={SECTION_TAG_MAX_LENGTH}
          maxCount={SECTION_TAG_MAX_COUNT}
        />
        <TagListField
          id="optionalSections"
          label="Optional sections"
          hint="Sections a page built from this template may include."
          values={optionalSections}
          onChange={setOptionalSections}
          maxLength={SECTION_TAG_MAX_LENGTH}
          maxCount={SECTION_TAG_MAX_COUNT}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Guidance</legend>

        <RichTextField id="purpose" label="Purpose" value={purpose} onChange={setPurpose} />
        <RichTextField
          id="proofRules"
          label="Proof rules"
          value={proofRules}
          onChange={setProofRules}
        />
        <RichTextField
          id="seoAeoGeoRequirements"
          label="SEO/AEO/GEO requirements"
          value={seoAeoGeoRequirements}
          onChange={setSeoAeoGeoRequirements}
        />
        <RichTextField id="schema" label="Schema" value={schema} onChange={setSchema} />
        <RichTextField id="ctaRules" label="CTA rules" value={ctaRules} onChange={setCtaRules} />
        <RichTextField
          id="contentDepthGuidance"
          label="Content-depth guidance"
          value={contentDepthGuidance}
          onChange={setContentDepthGuidance}
        />
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
        <a
          href={
            props.mode === "create"
              ? "/content-template-library"
              : `/content-template-library/${props.templateId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

function RichTextField({
  id,
  label,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): ReactNode {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <RichTextEditor id={id} value={value} onChange={onChange} />
    </div>
  );
}
