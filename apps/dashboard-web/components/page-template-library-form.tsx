"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  ComponentRecord,
  PageTemplateRecord,
  SectionPatternRecord,
} from "@webdesk/shared-types";
import { RelationshipPicker, TagListField, type RelationshipOption } from "@webdesk/ui";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { PAGE_TYPE_LABEL, PAGE_TYPE_VALUES } from "@/lib/page-template-library-query";
import { arrayFieldValue, findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./page-template-library-form.module.css";

// Mirrors apps/dashboard-api/src/page-template-library/page-template-library.dto.ts — kept in
// sync by hand, same approach ComponentLibraryForm/SectionAndPatternLibraryForm/
// ServiceLibraryForm/PersonaLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
// contentRequirements/searchRequirements/conversionGoal go through RichTextEditor, per the
// 2026-08-22 standing rule requiring every dashboard-web long-text field to use it — raised
// alongside the equivalent rich-text raise sibling modules apply once their own UI wires
// RichTextEditor in (see page-template-library.dto.ts's own identical raise, mirroring
// section-and-pattern-library-form.tsx's/service-library-form.tsx's/persona-library-form.tsx's
// own identical reasoning).
const RICH_TEXT_MAX_LENGTH = 40_000;
// phpTemplateRelationship is a factual, not narrative, field — it stays plain text at the
// backend's own unraised 2,000 cap, matching component-library-form.tsx's own phpPath/
// section-and-pattern-library-form.tsx's own phpPath precedent for real, non-prose fields.
const PHP_TEMPLATE_RELATIONSHIP_MAX_LENGTH = 2_000;
const RELATIONSHIP_ID_MAX_COUNT = 100;
const WIREFRAME_REFERENCE_MAX_LENGTH = 500;
const WIREFRAME_REFERENCE_MAX_COUNT = 100;

function toSectionOption(section: SectionPatternRecord): RelationshipOption {
  return { id: section.recordId, displayName: section.name };
}

function toComponentOption(component: ComponentRecord): RelationshipOption {
  return { id: component.recordId, displayName: component.name };
}

function toPageTemplateOption(pageTemplate: PageTemplateRecord): RelationshipOption {
  return { id: pageTemplate.recordId, displayName: pageTemplate.name };
}

/**
 * A single-value wrapper around `@webdesk/ui`'s `RelationshipPicker`, mirroring
 * `ComponentLibraryForm`'s own locally-defined `SingleComponentPicker`/`InternalLinkForm`'s own
 * `SinglePagePicker`. This is now the 3rd independent hand-copy of that same wrapping shape —
 * accepted, tracked debt, same as the prior 2 (see `SingleComponentPicker`'s own doc comment for
 * the full reasoning; the trigger point for extracting a shared generic single-value picker was
 * already the 3rd occurrence there, so this makes a strong case for the NEXT module that needs
 * one to actually do it). `excludeRecordId` (the record currently being edited, `undefined` in
 * create mode since there is no prior `recordId` yet) is filtered out of the option pool so a page
 * template can't pick itself as its own replacement — the real, authoritative self-reference guard
 * still runs server-side (`PageTemplatesService.assertReplacementExists()`); this is purely a UX
 * nicety, not the enforcement point. `onSelect` REPLACES the current selection (not appends,
 * unlike the many-to-many pickers below) and `onRemove`/the picker's own chip "x" button clears it
 * back to `null`.
 */
function SinglePageTemplatePicker({
  label,
  pageTemplates,
  excludeRecordId,
  selected,
  onChange,
  hint,
}: {
  readonly label: string;
  readonly pageTemplates: readonly PageTemplateRecord[];
  readonly excludeRecordId: string | undefined;
  readonly selected: RelationshipOption | null;
  readonly onChange: (next: RelationshipOption | null) => void;
  readonly hint?: string;
}): ReactNode {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return pageTemplates
      .filter(
        (pageTemplate) =>
          pageTemplate.recordId !== excludeRecordId &&
          pageTemplate.recordId !== selected?.id &&
          (lowerQuery === "" || pageTemplate.name.toLowerCase().includes(lowerQuery)),
      )
      .map(toPageTemplateOption)
      .slice(0, 20);
  }, [pageTemplates, excludeRecordId, selected, query]);

  return (
    <RelationshipPicker
      label={label}
      query={query}
      onQueryChange={setQuery}
      options={options}
      selected={selected ? [selected] : []}
      onSelect={(option) => {
        onChange(option);
        setQuery("");
      }}
      onRemove={() => onChange(null)}
      hint={hint}
    />
  );
}

export type PageTemplateLibraryFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: PageTemplateRecord }
) & {
  readonly sectionPatterns: readonly SectionPatternRecord[];
  readonly components: readonly ComponentRecord[];
  readonly pageTemplates: readonly PageTemplateRecord[];
};

/**
 * Create/edit form for a Page Template Library record. No approved wireframe/screen spec exists
 * for this module — this is the smallest honest reading of the backend's actual field set
 * (`pageType`, `name`, `requiredSectionIds`, `optionalSectionIds`, `supportedComponentIds`,
 * `wireframeReferences`, `contentRequirements`, `searchRequirements`, `conversionGoal`,
 * `phpTemplateRelationship`, `replacementRecordId`), matching the Component Library/Section and
 * Pattern Library form pages' own precedent for an unsourced screen.
 *
 * `pageType`/`publicId` are both create-only (immutable across a record's own version chain per
 * `updatePageTemplateSchema`'s own contract — never accepted on update) and shown read-only on
 * edit, matching `ComponentLibraryForm`'s own `category`/`publicId` convention. `approvalStatus`
 * is deliberately never a field here — only the dedicated `POST .../:recordId/status` route
 * (`PageTemplateStatusActions`) may change it.
 *
 * `contentRequirements`/`searchRequirements`/`conversionGoal` use `RichTextEditor` (Tiptap), per
 * the 2026-08-22 standing rule requiring every dashboard-web long-text field to use the rich-text
 * editor — the backend already wires `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()` for exactly these three fields
 * (`page-templates.service.ts`), confirmed by reading that file directly before building this
 * form. `phpTemplateRelationship` stays a plain `<textarea>` — it's a factual, not narrative,
 * field, and the backend's own dto.ts applies no sanitization to it at all (a plain `textField`
 * schema, distinct from the three rich-text fields above), so treating it as HTML here would be
 * dishonest, the same reasoning `ComponentLibraryForm`'s/`SectionAndPatternLibraryForm`'s own doc
 * comments already document for their own plain code/notes fields.
 *
 * `requiredSectionIds`/`optionalSectionIds` are real, existence-validated many-to-many
 * relationships into Section and Pattern Library's own `recordId`s (`RelationshipPicker`,
 * matching `ComponentLibraryForm`'s own `tokenIds` pattern, including its raw-id-fallback-for-an-
 * out-of-window-id behavior); a section can never be added to both lists at once, mirroring the
 * backend's own `hasOverlappingSectionIds()` refinement so a caller sees the same rejection
 * client-side before ever submitting. `supportedComponentIds` is a real, existence-validated
 * many-to-many relationship into Component Library's own `recordId`s. `wireframeReferences` is a
 * plain, unvalidated free-text tag list (`TagListField`) — no `wireframe_library` module exists
 * yet to link it to for real, mirroring `SectionAndPatternLibraryForm`'s own `jsDependencies`/
 * `tokenReferences`/`relatedComponentIds` fields. `replacementRecordId` is a real,
 * existence-validated SINGLE self-referential pointer into this module's own table
 * (`SinglePageTemplatePicker` above, matching `ComponentLibraryForm`'s own `SingleComponentPicker`
 * pattern).
 *
 * Editing an APPROVED record's own genuinely novel backend behavior (mirrors
 * `ComponentLibraryForm`'s/`SectionAndPatternLibraryForm`'s own identical divergence): rather than
 * mutating that row in place, the backend forks a brand-new draft version instead (a different
 * `id`, `versionNumber + 1`, same `recordId`) — the edit form surfaces this plainly before submit
 * (`forkNotice` below), since it's a real, surprising divergence from every other module's own
 * edit behavior in this app.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. On success, always redirects to
 * `/page-template-library/{recordId}` using the URL's own stable `recordId` route param (not
 * `body.data.id`, which changes on a fork) — this always lands correctly on whichever row is now
 * current, whether the edit mutated in place or forked.
 */
export function PageTemplateLibraryForm(props: PageTemplateLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [pageType, setPageType] = useState(initial?.pageType ?? PAGE_TYPE_VALUES[0]);
  const [name, setName] = useState(initial?.name ?? "");
  const [requiredSectionIds, setRequiredSectionIds] = useState<readonly string[]>(
    initial?.requiredSectionIds ?? [],
  );
  const [optionalSectionIds, setOptionalSectionIds] = useState<readonly string[]>(
    initial?.optionalSectionIds ?? [],
  );
  const [supportedComponentIds, setSupportedComponentIds] = useState<readonly string[]>(
    initial?.supportedComponentIds ?? [],
  );
  const [wireframeReferences, setWireframeReferences] = useState<readonly string[]>(
    initial?.wireframeReferences ?? [],
  );
  const [contentRequirements, setContentRequirements] = useState(
    initial?.contentRequirements ?? "",
  );
  const [searchRequirements, setSearchRequirements] = useState(initial?.searchRequirements ?? "");
  const [conversionGoal, setConversionGoal] = useState(initial?.conversionGoal ?? "");
  const [phpTemplateRelationship, setPhpTemplateRelationship] = useState(
    initial?.phpTemplateRelationship ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sectionOptionsById = useMemo(
    () => new Map(props.sectionPatterns.map((section) => [section.recordId, section])),
    [props.sectionPatterns],
  );
  const [requiredSectionQuery, setRequiredSectionQuery] = useState("");
  const requiredSectionOptions = useMemo(() => {
    const lowerQuery = requiredSectionQuery.trim().toLowerCase();
    return props.sectionPatterns
      .filter(
        (section) =>
          !requiredSectionIds.includes(section.recordId) &&
          !optionalSectionIds.includes(section.recordId) &&
          (lowerQuery === "" || section.name.toLowerCase().includes(lowerQuery)),
      )
      .map(toSectionOption)
      .slice(0, 20);
  }, [props.sectionPatterns, requiredSectionIds, optionalSectionIds, requiredSectionQuery]);

  const [optionalSectionQuery, setOptionalSectionQuery] = useState("");
  const optionalSectionOptions = useMemo(() => {
    const lowerQuery = optionalSectionQuery.trim().toLowerCase();
    return props.sectionPatterns
      .filter(
        (section) =>
          !optionalSectionIds.includes(section.recordId) &&
          !requiredSectionIds.includes(section.recordId) &&
          (lowerQuery === "" || section.name.toLowerCase().includes(lowerQuery)),
      )
      .map(toSectionOption)
      .slice(0, 20);
  }, [props.sectionPatterns, optionalSectionIds, requiredSectionIds, optionalSectionQuery]);

  const componentOptionsById = useMemo(
    () => new Map(props.components.map((component) => [component.recordId, component])),
    [props.components],
  );
  const [componentQuery, setComponentQuery] = useState("");
  const componentOptions = useMemo(() => {
    const lowerQuery = componentQuery.trim().toLowerCase();
    return props.components
      .filter(
        (component) =>
          !supportedComponentIds.includes(component.recordId) &&
          (lowerQuery === "" || component.name.toLowerCase().includes(lowerQuery)),
      )
      .map(toComponentOption)
      .slice(0, 20);
  }, [props.components, supportedComponentIds, componentQuery]);

  // Lazy initializer — this scan over up to 100 `props.pageTemplates` is only ever needed once,
  // to seed the initial value, not on every render (unlike the `*OptionsById` maps above, which
  // are real per-render derived values and correctly use `useMemo`).
  const [replacement, setReplacement] = useState<RelationshipOption | null>(() => {
    if (props.mode !== "edit" || !props.initial.replacementRecordId) {
      return null;
    }
    const found = props.pageTemplates.find(
      (pageTemplate) => pageTemplate.recordId === props.initial.replacementRecordId,
    );
    // An id outside the picker's 100-row fetch window falls back to showing the raw id itself as
    // its own chip, rather than being silently dropped — matches ComponentLibraryForm's/
    // PersonaLibraryForm's own raw-id fallback precedent for the identical case, so a real
    // relationship is never invisible or unremovable in this UI.
    return {
      id: props.initial.replacementRecordId,
      displayName: found ? found.name : props.initial.replacementRecordId,
    };
  });

  const isForkingEdit = props.mode === "edit" && props.initial.approvalStatus === "approved";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // publicId/pageType/name are real HTML `required` fields — the browser's own constraint
      // validation blocks a submit event from ever firing while any is empty, so no redundant
      // JS-level check is needed here, matching ComponentLibraryForm's own precedent.
      const trimmedName = name.trim();

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Content requirements", contentRequirements],
        ["Search requirements", searchRequirements],
        ["Conversion goal", conversionGoal],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, RICH_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      // A section can be required or optional, never both — mirrors the backend's own
      // `hasOverlappingSectionIds()` Zod refinement, surfaced here so the caller sees the same
      // rejection before ever submitting rather than only via the backend's 400.
      const overlap = requiredSectionIds.find((id) => optionalSectionIds.includes(id));
      if (overlap) {
        setError("A section cannot be both required and optional at the same time.");
        return;
      }

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updatePageTemplateSchema's own nullish
      // contract; an explicit null is what actually clears an existing value back to "none".
      function plainField(fieldValue: string): string | null | undefined {
        const trimmed = fieldValue.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      function arrayField(values: readonly string[]): readonly string[] | null | undefined {
        return arrayFieldValue(values, props.mode);
      }

      const sharedFields = {
        name: trimmedName,
        requiredSectionIds: arrayField(requiredSectionIds),
        optionalSectionIds: arrayField(optionalSectionIds),
        supportedComponentIds: arrayField(supportedComponentIds),
        wireframeReferences: arrayField(wireframeReferences),
        contentRequirements: richTextField(contentRequirements),
        searchRequirements: richTextField(searchRequirements),
        conversionGoal: richTextField(conversionGoal),
        phpTemplateRelationship: plainField(phpTemplateRelationship),
        replacementRecordId: replacement
          ? replacement.id
          : props.mode === "create"
            ? undefined
            : null,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), pageType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/page-template-library/page-templates`
          : `${getApiBaseUrl()}/page-template-library/page-templates/${props.recordId}/update`;

      const result = await postMutation<{ recordId: string }>(url, payload);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // Edit mode always uses the URL's own stable recordId — never result.data.id/recordId,
      // which is a DIFFERENT row when this edit forked a new version (see this component's own
      // doc comment above). Create mode has no route param yet, so it must read the
      // freshly-created record's own recordId from the response — postMutation() itself is
      // tolerant of a missing/malformed body, so this is guarded explicitly rather than assumed
      // present.
      let recordId: string;
      if (props.mode === "create") {
        if (!result.data?.recordId) {
          setError("Page template was created, but the response was unexpected. Please refresh.");
          return;
        }
        recordId = result.data.recordId;
      } else {
        recordId = props.recordId;
      }
      router.push(`/page-template-library/${recordId}`);
    } catch (err) {
      console.error("Failed to save page template", err);
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
            <label htmlFor="pageType" className={styles.label}>
              Page type
            </label>
            <select
              id="pageType"
              required
              value={pageType}
              onChange={(event) =>
                setPageType(event.target.value as (typeof PAGE_TYPE_VALUES)[number])
              }
              className={styles.select}
            >
              {PAGE_TYPE_VALUES.map((typeValue) => (
                <option key={typeValue} value={typeValue}>
                  {PAGE_TYPE_LABEL[typeValue]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Never changeable once created — a different page type means a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Page type</span>
            <span className={styles.readonlyValue}>{PAGE_TYPE_LABEL[props.initial.pageType]}</span>
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
      </fieldset>

      {isForkingEdit ? (
        <p className={styles.forkNotice}>
          This record is approved. Saving changes here won&apos;t modify the approved version — it
          creates a new draft version instead, leaving the currently-approved content untouched
          until the new draft is itself approved.
        </p>
      ) : null}

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Sections &amp; components</legend>

        <RelationshipPicker
          label="Required sections"
          query={requiredSectionQuery}
          onQueryChange={setRequiredSectionQuery}
          options={requiredSectionOptions}
          selected={requiredSectionIds.map((id) => {
            const section = sectionOptionsById.get(id);
            return { id, displayName: section ? section.name : id };
          })}
          onSelect={(option) => {
            if (requiredSectionIds.length >= RELATIONSHIP_ID_MAX_COUNT) {
              setError(
                `A page template can require at most ${RELATIONSHIP_ID_MAX_COUNT} sections.`,
              );
              return;
            }
            setRequiredSectionIds([...requiredSectionIds, option.id]);
          }}
          onRemove={(id) =>
            setRequiredSectionIds(requiredSectionIds.filter((existing) => existing !== id))
          }
          hint="Sections and patterns every instance of this page type must include."
        />

        <RelationshipPicker
          label="Optional sections"
          query={optionalSectionQuery}
          onQueryChange={setOptionalSectionQuery}
          options={optionalSectionOptions}
          selected={optionalSectionIds.map((id) => {
            const section = sectionOptionsById.get(id);
            return { id, displayName: section ? section.name : id };
          })}
          onSelect={(option) => {
            if (optionalSectionIds.length >= RELATIONSHIP_ID_MAX_COUNT) {
              setError(
                `A page template can offer at most ${RELATIONSHIP_ID_MAX_COUNT} optional sections.`,
              );
              return;
            }
            setOptionalSectionIds([...optionalSectionIds, option.id]);
          }}
          onRemove={(id) =>
            setOptionalSectionIds(optionalSectionIds.filter((existing) => existing !== id))
          }
          hint="Sections and patterns an instance of this page type may optionally include."
        />

        <RelationshipPicker
          label="Supported components"
          query={componentQuery}
          onQueryChange={setComponentQuery}
          options={componentOptions}
          selected={supportedComponentIds.map((id) => {
            const component = componentOptionsById.get(id);
            return { id, displayName: component ? component.name : id };
          })}
          onSelect={(option) => {
            if (supportedComponentIds.length >= RELATIONSHIP_ID_MAX_COUNT) {
              setError(
                `A page template can support at most ${RELATIONSHIP_ID_MAX_COUNT} components.`,
              );
              return;
            }
            setSupportedComponentIds([...supportedComponentIds, option.id]);
          }}
          onRemove={(id) =>
            setSupportedComponentIds(supportedComponentIds.filter((existing) => existing !== id))
          }
          hint="Components this page type's implementation supports."
        />

        <TagListField
          id="wireframeReferences"
          label="Wireframe references"
          hint="Free-text references to wireframes — no Wireframe Library module exists yet to link to."
          values={wireframeReferences}
          onChange={setWireframeReferences}
          maxLength={WIREFRAME_REFERENCE_MAX_LENGTH}
          maxCount={WIREFRAME_REFERENCE_MAX_COUNT}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content &amp; conversion</legend>

        <div className={styles.field}>
          <label htmlFor="contentRequirements" className={styles.label}>
            Content requirements
          </label>
          <RichTextEditor
            id="contentRequirements"
            value={contentRequirements}
            onChange={setContentRequirements}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="searchRequirements" className={styles.label}>
            Search requirements
          </label>
          <RichTextEditor
            id="searchRequirements"
            value={searchRequirements}
            onChange={setSearchRequirements}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="conversionGoal" className={styles.label}>
            Conversion goal
          </label>
          <RichTextEditor id="conversionGoal" value={conversionGoal} onChange={setConversionGoal} />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>WordPress &amp; relationships</legend>

        <div className={styles.field}>
          <label htmlFor="phpTemplateRelationship" className={styles.label}>
            PHP template relationship
          </label>
          <textarea
            id="phpTemplateRelationship"
            maxLength={PHP_TEMPLATE_RELATIONSHIP_MAX_LENGTH}
            value={phpTemplateRelationship}
            onChange={(event) => setPhpTemplateRelationship(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
          <span className={styles.helperText}>
            The related PHP template file(s) — a factual reference, not sanitized as HTML.
          </span>
        </div>

        <SinglePageTemplatePicker
          label="Replacement page template"
          pageTemplates={props.pageTemplates}
          excludeRecordId={props.mode === "edit" ? props.initial.recordId : undefined}
          selected={replacement}
          onChange={setReplacement}
          hint="If this page template is being retired, search and select the page template that replaces it."
        />
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting
            ? "Saving…"
            : props.mode === "create"
              ? "Create page template"
              : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? "/page-template-library"
              : `/page-template-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
