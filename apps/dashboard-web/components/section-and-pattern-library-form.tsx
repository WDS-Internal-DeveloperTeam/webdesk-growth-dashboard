"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { SectionPatternRecord } from "@webdesk/shared-types";
import { TagListField } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { arrayFieldValue, findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { PATTERN_TYPE_LABEL, PATTERN_TYPE_VALUES } from "@/lib/section-and-pattern-library-query";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./section-and-pattern-library-form.module.css";

// Mirrors
// apps/dashboard-api/src/section-and-pattern-library/section-and-pattern-library.dto.ts — kept in
// sync by hand, same approach ProjectForm/ServiceLibraryForm/PersonaLibraryForm/
// WebsiteStrategyCenterForm/DesignTokenLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
const PHP_PATH_MAX_LENGTH = 500;
// Raised alongside the equivalent rich-text raise sibling modules apply once their own UI wires
// RichTextEditor in (the backend's own dto.ts keeps a plain 20,000 cap for its own backend-only
// pass — real HTML from the editor carries markup overhead over the equivalent plain text, same
// reasoning as service-library-form.tsx's/persona-library-form.tsx's/website-strategy-center-
// form.tsx's own identical raise).
const RICH_TEXT_MAX_LENGTH = 40_000;
// htmlStructure/scssReference/browserSupport are plain code/notes fields, not rich text — kept at
// the backend's own unraised 20,000 cap.
const PLAIN_TEXT_MAX_LENGTH = 20_000;
const ARRAY_ITEM_MAX_LENGTH = 255;
const ARRAY_MAX_COUNT = 50;

export type SectionAndPatternLibraryFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: SectionPatternRecord };

/**
 * Create/edit form for a Section and Pattern Library record. No approved wireframe/screen spec
 * exists for this module — this is the smallest honest reading of the backend's actual field set,
 * matching the Design Token Library/Website Strategy Center/Persona Library form pages' own
 * precedent for an unsourced screen.
 *
 * `patternType` is create-only (immutable across a record's own version chain per
 * `updateSectionPatternRecordSchema`'s own contract — never accepted on update) and shown
 * read-only on edit, matching `DesignTokenLibraryForm`'s `group`/`publicId` convention.
 * `approvalStatus` is deliberately never a field here — only the dedicated
 * `POST .../:recordId/status` route (`SectionPatternStatusActions`) may change it.
 *
 * `description`/`responsiveBehavior`/`accessibilityNotes` use `RichTextEditor` (Tiptap), per the
 * 2026-08-22 standing rule requiring every dashboard-web long-text field to use the rich-text
 * editor — the backend already wires `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()` for exactly these three fields
 * (`section-patterns.service.ts`), confirmed by reading that file directly before building this
 * form. `htmlStructure`/`scssReference`/`browserSupport` stay plain `<textarea>`s styled with a
 * monospace font — they're real code/notes fields, and the backend's own dto.ts applies no
 * sanitization to them at all (a plain `plainTextField` schema, distinct from its `richTextField`
 * schema), so treating them as HTML here would be dishonest, the same reasoning
 * `DesignTokenLibraryForm`'s own doc comment already documents for its own
 * `semanticPurpose`/`responsiveVariation` fields. `designReference` is a plain `type="url"` text
 * input, validated client-side via `isSafeHttpUrl()` before submit (showing an inline error rather
 * than relying solely on the backend's own `safeHttpUrlSchema` rejection), matching
 * `DesignReferenceLibraryForm`'s own `sourceUrl` precedent. `jsDependencies`/`tokenReferences`/
 * `relatedComponentIds` are plain, unvalidated free-text tag lists (`TagListField`,
 * `@webdesk/ui`) — no backing `design_token_library`-version-identity/`component_library` module
 * exists yet to link them to for real, mirroring `DesignTokenLibraryForm`'s own `usageReferences`
 * field.
 *
 * Editing an APPROVED record's own genuinely novel backend behavior (mirrors
 * `DesignTokenLibraryForm`'s/`WebsiteStrategyCenterForm`'s own identical divergence): rather than
 * mutating that row in place, the backend forks a brand-new draft version instead (a different
 * `id`, `versionNumber + 1`, same `recordId`) — the edit form surfaces this plainly before submit
 * (`forkNotice` below), since it's a real, surprising divergence from every other module's own
 * edit behavior in this app.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. On success, always redirects to
 * `/section-and-pattern-library/{recordId}` using the URL's own stable `recordId` route param
 * (not `body.data.id`, which changes on a fork, and not `body.data.recordId`, which is identical
 * but requires trusting the response shape unnecessarily) — this always lands correctly on
 * whichever row is now current, whether the edit mutated in place or forked.
 */
export function SectionAndPatternLibraryForm(props: SectionAndPatternLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [patternType, setPatternType] = useState(initial?.patternType ?? PATTERN_TYPE_VALUES[0]);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [designReference, setDesignReference] = useState(initial?.designReference ?? "");
  const [htmlStructure, setHtmlStructure] = useState(initial?.htmlStructure ?? "");
  const [phpPath, setPhpPath] = useState(initial?.phpPath ?? "");
  const [scssReference, setScssReference] = useState(initial?.scssReference ?? "");
  const [jsDependencies, setJsDependencies] = useState<readonly string[]>(
    initial?.jsDependencies ?? [],
  );
  const [responsiveBehavior, setResponsiveBehavior] = useState(initial?.responsiveBehavior ?? "");
  const [accessibilityNotes, setAccessibilityNotes] = useState(initial?.accessibilityNotes ?? "");
  const [browserSupport, setBrowserSupport] = useState(initial?.browserSupport ?? "");
  const [tokenReferences, setTokenReferences] = useState<readonly string[]>(
    initial?.tokenReferences ?? [],
  );
  const [relatedComponentIds, setRelatedComponentIds] = useState<readonly string[]>(
    initial?.relatedComponentIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isForkingEdit = props.mode === "edit" && props.initial.approvalStatus === "approved";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // publicId/patternType/name are real HTML `required` fields — the browser's own constraint
      // validation blocks a submit event from ever firing while any is empty, so no redundant
      // JS-level check is needed for them here, matching DesignTokenLibraryForm's own precedent.
      const trimmedName = name.trim();
      const trimmedDesignReference = designReference.trim();

      if (trimmedDesignReference !== "" && !isSafeHttpUrl(trimmedDesignReference)) {
        setError("Design reference must be a valid http:// or https:// URL.");
        return;
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Description", description],
        ["Responsive behavior", responsiveBehavior],
        ["Accessibility notes", accessibilityNotes],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, RICH_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateSectionPatternRecordSchema's own
      // nullish contract; an explicit null is what actually clears an existing value back to
      // "none". Same convention DesignTokenLibraryForm's own plainField() establishes.
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
        designReference: plainField(designReference),
        htmlStructure: plainField(htmlStructure),
        phpPath: plainField(phpPath),
        scssReference: plainField(scssReference),
        jsDependencies: arrayField(jsDependencies),
        responsiveBehavior: richTextField(responsiveBehavior),
        accessibilityNotes: richTextField(accessibilityNotes),
        browserSupport: plainField(browserSupport),
        tokenReferences: arrayField(tokenReferences),
        relatedComponentIds: arrayField(relatedComponentIds),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), patternType }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/section-and-pattern-library/records`
          : `${getApiBaseUrl()}/section-and-pattern-library/records/${props.recordId}/update`;

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
      router.push(`/section-and-pattern-library/${recordId}`);
    } catch (err) {
      console.error("Failed to save section/pattern record", err);
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
            <label htmlFor="patternType" className={styles.label}>
              Pattern type
            </label>
            <select
              id="patternType"
              required
              value={patternType}
              onChange={(event) =>
                setPatternType(event.target.value as (typeof PATTERN_TYPE_VALUES)[number])
              }
              className={styles.select}
            >
              {PATTERN_TYPE_VALUES.map((typeValue) => (
                <option key={typeValue} value={typeValue}>
                  {PATTERN_TYPE_LABEL[typeValue]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Never changeable once created — a different pattern type means a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Pattern type</span>
            <span className={styles.readonlyValue}>
              {PATTERN_TYPE_LABEL[props.initial.patternType]}
            </span>
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
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Description
          </label>
          <RichTextEditor id="description" value={description} onChange={setDescription} />
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
        <legend className={styles.fieldsetLegend}>Code references</legend>

        <div className={styles.field}>
          <label htmlFor="htmlStructure" className={styles.label}>
            HTML structure
          </label>
          <textarea
            id="htmlStructure"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={htmlStructure}
            onChange={(event) => setHtmlStructure(event.target.value)}
            className={styles.codeTextarea}
            rows={6}
            spellCheck={false}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="phpPath" className={styles.label}>
            PHP path
          </label>
          <input
            id="phpPath"
            type="text"
            maxLength={PHP_PATH_MAX_LENGTH}
            value={phpPath}
            onChange={(event) => setPhpPath(event.target.value)}
            className={styles.codeInput}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="scssReference" className={styles.label}>
            SCSS reference
          </label>
          <textarea
            id="scssReference"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={scssReference}
            onChange={(event) => setScssReference(event.target.value)}
            className={styles.codeTextarea}
            rows={6}
            spellCheck={false}
          />
        </div>

        <TagListField
          id="jsDependencies"
          label="JS dependencies"
          hint="Free-text references to script dependencies — no backing entity exists yet."
          values={jsDependencies}
          onChange={setJsDependencies}
          maxLength={ARRAY_ITEM_MAX_LENGTH}
          maxCount={ARRAY_MAX_COUNT}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Responsiveness &amp; accessibility</legend>

        <div className={styles.field}>
          <label htmlFor="responsiveBehavior" className={styles.label}>
            Responsive behavior
          </label>
          <RichTextEditor
            id="responsiveBehavior"
            value={responsiveBehavior}
            onChange={setResponsiveBehavior}
          />
        </div>

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

        <div className={styles.field}>
          <label htmlFor="browserSupport" className={styles.label}>
            Browser support
          </label>
          <textarea
            id="browserSupport"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={browserSupport}
            onChange={(event) => setBrowserSupport(event.target.value)}
            className={styles.codeTextarea}
            rows={4}
            spellCheck={false}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <TagListField
          id="tokenReferences"
          label="Token references"
          hint="Free-text references to Design Token Library entries — no backing link exists yet."
          values={tokenReferences}
          onChange={setTokenReferences}
          maxLength={ARRAY_ITEM_MAX_LENGTH}
          maxCount={ARRAY_MAX_COUNT}
        />

        <TagListField
          id="relatedComponentIds"
          label="Related component IDs"
          hint="Free-text references to Component Library entries — no backing entity exists yet."
          values={relatedComponentIds}
          onChange={setRelatedComponentIds}
          maxLength={ARRAY_ITEM_MAX_LENGTH}
          maxCount={ARRAY_MAX_COUNT}
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
              ? "/section-and-pattern-library"
              : `/section-and-pattern-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
