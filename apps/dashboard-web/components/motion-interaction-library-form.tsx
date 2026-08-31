"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ComponentRecord, MotionInteractionRecord } from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { CATEGORY_LABEL, CATEGORY_VALUES } from "@/lib/motion-and-interaction-library-query";
import { arrayFieldValue, findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./motion-interaction-library-form.module.css";

// Mirrors
// apps/dashboard-api/src/motion-and-interaction-library/motion-and-interaction-library.dto.ts —
// kept in sync by hand, same approach SectionAndPatternLibraryForm/PageTemplateLibraryForm/
// WireframeLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
// description/triggerAndBehavior/accessibilityNotes go through RichTextEditor, per the
// 2026-08-22 standing rule requiring every dashboard-web long-text field to use it — raised
// alongside the equivalent rich-text raise sibling modules apply once their own UI wires
// RichTextEditor in (see motion-and-interaction-library.dto.ts's own identical raise, mirroring
// section-and-pattern-library-form.tsx's/page-template-library-form.tsx's own identical
// reasoning).
const RICH_TEXT_MAX_LENGTH = 40_000;
// timingAndEasing/implementationSpec/fallbackBehavior are plain code/spec-value fields, not rich
// text — kept at the backend's own unraised 20,000 cap, matching
// section-and-pattern-library-form.tsx's own scssReference/browserSupport precedent.
const PLAIN_TEXT_MAX_LENGTH = 20_000;
const RELATIONSHIP_ID_MAX_COUNT = 100;

function toComponentOption(component: ComponentRecord): RelationshipOption {
  return { id: component.recordId, displayName: component.name };
}

export type MotionInteractionLibraryFormProps = (
  | { readonly mode: "create" }
  | {
      readonly mode: "edit";
      readonly recordId: string;
      readonly initial: MotionInteractionRecord;
    }
) & {
  readonly components: readonly ComponentRecord[];
};

/**
 * Create/edit form for a Motion and Interaction Library record. No approved wireframe/screen spec
 * exists for this module — this is the smallest honest reading of the backend's actual field set,
 * matching the Section and Pattern Library/Page Template Library/Wireframe Library form pages' own
 * precedent for an unsourced screen.
 *
 * `category` is create-only (immutable across a record's own version chain per
 * `updateMotionInteractionRecordSchema`'s own contract — never accepted on update) and shown
 * read-only on edit, matching `SectionAndPatternLibraryForm`'s `patternType`/`publicId`
 * convention. `approvalStatus` is deliberately never a field here — only the dedicated
 * `POST .../:recordId/status` route (`MotionInteractionStatusActions`) may change it.
 *
 * `description`/`triggerAndBehavior`/`accessibilityNotes` use `RichTextEditor` (Tiptap), per the
 * 2026-08-22 standing rule requiring every dashboard-web long-text field to use the rich-text
 * editor — the backend already wires `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()` for exactly these three fields
 * (`motion-interactions.service.ts`), confirmed by reading that file directly before building this
 * form. `timingAndEasing`/`implementationSpec`/`fallbackBehavior` stay plain `<textarea>`s — real
 * spec-value/code fields, and the backend's own dto.ts applies no sanitization to them at all (a
 * plain `plainTextField` schema, distinct from its `richTextField` schema), so treating them as
 * HTML here would be dishonest, the same reasoning `SectionAndPatternLibraryForm`'s own doc
 * comment already documents for its own `htmlStructure`/`scssReference`/`browserSupport` fields.
 * `designReference` is a plain `type="url"` text input, validated client-side via
 * `isSafeHttpUrl()` before submit, matching `SectionAndPatternLibraryForm`'s own `designReference`
 * precedent.
 *
 * `relatedComponentIds` is a REAL, existence-validated many-to-many relationship into Component
 * Library's own `recordId`s (`RelationshipPicker`, matching `PageTemplateLibraryForm`'s own
 * `supportedComponentIds` pattern, including its raw-id-fallback-for-an-out-of-window-id
 * behavior) — unlike `SectionAndPatternLibraryForm`'s own `relatedComponentIds`, which predates
 * Component Library and stays an unvalidated `TagListField`, this module's backend
 * (`motion-interactions.service.ts#assertComponentIdsExist()`) genuinely enforces every id here.
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
 * `/motion-and-interaction-library/{recordId}` using the URL's own stable `recordId` route param
 * (not `result.data.id`, which changes on a fork) — this always lands correctly on whichever row
 * is now current, whether the edit mutated in place or forked.
 */
export function MotionInteractionLibraryForm(props: MotionInteractionLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORY_VALUES[0]);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [triggerAndBehavior, setTriggerAndBehavior] = useState(initial?.triggerAndBehavior ?? "");
  const [timingAndEasing, setTimingAndEasing] = useState(initial?.timingAndEasing ?? "");
  const [implementationSpec, setImplementationSpec] = useState(initial?.implementationSpec ?? "");
  const [accessibilityNotes, setAccessibilityNotes] = useState(initial?.accessibilityNotes ?? "");
  const [fallbackBehavior, setFallbackBehavior] = useState(initial?.fallbackBehavior ?? "");
  const [designReference, setDesignReference] = useState(initial?.designReference ?? "");
  const [relatedComponentIds, setRelatedComponentIds] = useState<readonly string[]>(
    initial?.relatedComponentIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
          !relatedComponentIds.includes(component.recordId) &&
          (lowerQuery === "" || component.name.toLowerCase().includes(lowerQuery)),
      )
      .map(toComponentOption)
      .slice(0, 20);
  }, [props.components, relatedComponentIds, componentQuery]);

  const isForkingEdit = props.mode === "edit" && props.initial.approvalStatus === "approved";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // publicId/category/name are real HTML `required` fields — the browser's own constraint
      // validation blocks a submit event from ever firing while any is empty, so no redundant
      // JS-level check is needed for them here, matching SectionAndPatternLibraryForm's own
      // precedent.
      const trimmedName = name.trim();
      const trimmedDesignReference = designReference.trim();

      if (trimmedDesignReference !== "" && !isSafeHttpUrl(trimmedDesignReference)) {
        setError("Design reference must be a valid http:// or https:// URL.");
        return;
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Description", description],
        ["Trigger and behavior", triggerAndBehavior],
        ["Accessibility notes", accessibilityNotes],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, RICH_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateMotionInteractionRecordSchema's own
      // nullish contract; an explicit null is what actually clears an existing value back to
      // "none". Same convention SectionAndPatternLibraryForm's own plainField() establishes.
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
        description: richTextField(description),
        triggerAndBehavior: richTextField(triggerAndBehavior),
        timingAndEasing: plainField(timingAndEasing),
        implementationSpec: plainField(implementationSpec),
        accessibilityNotes: richTextField(accessibilityNotes),
        fallbackBehavior: plainField(fallbackBehavior),
        designReference: plainField(designReference),
        relatedComponentIds: arrayField(relatedComponentIds),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), category }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/motion-and-interaction-library/records`
          : `${getApiBaseUrl()}/motion-and-interaction-library/records/${props.recordId}/update`;

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
          setError(
            "Motion/interaction record was created, but the response was unexpected. Please refresh.",
          );
          return;
        }
        recordId = result.data.recordId;
      } else {
        recordId = props.recordId;
      }
      router.push(`/motion-and-interaction-library/${recordId}`);
    } catch (err) {
      console.error("Failed to save motion/interaction record", err);
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
            <label htmlFor="category" className={styles.label}>
              Category
            </label>
            <select
              id="category"
              required
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as (typeof CATEGORY_VALUES)[number])
              }
              className={styles.select}
            >
              {CATEGORY_VALUES.map((categoryValue) => (
                <option key={categoryValue} value={categoryValue}>
                  {CATEGORY_LABEL[categoryValue]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Never changeable once created — a different category means a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Category</span>
            <span className={styles.readonlyValue}>{CATEGORY_LABEL[props.initial.category]}</span>
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
        <legend className={styles.fieldsetLegend}>Behavior</legend>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Description
          </label>
          <RichTextEditor id="description" value={description} onChange={setDescription} />
        </div>

        <div className={styles.field}>
          <label htmlFor="triggerAndBehavior" className={styles.label}>
            Trigger and behavior
          </label>
          <RichTextEditor
            id="triggerAndBehavior"
            value={triggerAndBehavior}
            onChange={setTriggerAndBehavior}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="designReference" className={styles.label}>
            Design reference
          </label>
          <input
            id="designReference"
            type="url"
            value={designReference}
            onChange={(event) => setDesignReference(event.target.value)}
            className={styles.input}
            placeholder="https://…"
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Implementation</legend>

        <div className={styles.field}>
          <label htmlFor="timingAndEasing" className={styles.label}>
            Timing and easing
          </label>
          <textarea
            id="timingAndEasing"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={timingAndEasing}
            onChange={(event) => setTimingAndEasing(event.target.value)}
            className={styles.textarea}
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="implementationSpec" className={styles.label}>
            Implementation spec
          </label>
          <textarea
            id="implementationSpec"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={implementationSpec}
            onChange={(event) => setImplementationSpec(event.target.value)}
            className={styles.textarea}
            rows={6}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="fallbackBehavior" className={styles.label}>
            Fallback behavior
          </label>
          <textarea
            id="fallbackBehavior"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={fallbackBehavior}
            onChange={(event) => setFallbackBehavior(event.target.value)}
            className={styles.textarea}
            rows={4}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Accessibility</legend>

        <div className={styles.field}>
          <label htmlFor="accessibilityNotes" className={styles.label}>
            Accessibility notes
          </label>
          <RichTextEditor
            id="accessibilityNotes"
            value={accessibilityNotes}
            onChange={setAccessibilityNotes}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <RelationshipPicker
          label="Related components"
          query={componentQuery}
          onQueryChange={setComponentQuery}
          options={componentOptions}
          selected={relatedComponentIds.map((id) => {
            const component = componentOptionsById.get(id);
            return { id, displayName: component ? component.name : id };
          })}
          onSelect={(option) => {
            if (relatedComponentIds.length >= RELATIONSHIP_ID_MAX_COUNT) {
              setError(
                `A motion/interaction record can relate to at most ${RELATIONSHIP_ID_MAX_COUNT} components.`,
              );
              return;
            }
            setRelatedComponentIds([...relatedComponentIds, option.id]);
          }}
          onRemove={(id) =>
            setRelatedComponentIds(relatedComponentIds.filter((existing) => existing !== id))
          }
          hint="Component Library entries this motion/interaction spec applies to."
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
            props.mode === "create"
              ? "/motion-and-interaction-library"
              : `/motion-and-interaction-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
