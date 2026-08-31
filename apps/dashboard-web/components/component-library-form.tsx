"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ComponentRecord, DesignTokenRecord } from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import styles from "./component-library-form.module.css";

// Mirrors apps/dashboard-api/src/component-library/component-library.dto.ts — kept in sync by
// hand, same approach DesignTokenLibraryForm/ServiceLibraryForm/PersonaLibraryForm/
// InternalLinkForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const CATEGORY_MAX_LENGTH = 100;
const NAME_MAX_LENGTH = 255;
const SHORT_TEXT_MAX_LENGTH = 2_000;
const LONG_TEXT_MAX_LENGTH = 4_000;
const TOKEN_MAX_COUNT = 100;
// Matches safeHttpUrlSchema's own .max(500) cap (component-library.dto.ts) — every other text
// field in this form has a client-side maxLength mirroring its backend cap; figmaReference had
// been missing one.
const FIGMA_REFERENCE_MAX_LENGTH = 500;

function toDesignTokenOption(token: DesignTokenRecord): RelationshipOption {
  return { id: token.recordId, displayName: token.name };
}

function toComponentOption(component: ComponentRecord): RelationshipOption {
  return { id: component.recordId, displayName: component.name };
}

/**
 * A single-value wrapper around `@webdesk/ui`'s `RelationshipPicker`, mirroring
 * `InternalLinkForm`'s own locally-defined `SinglePagePicker`. This is now the 2nd independent
 * hand-copy of that same wrapping shape (query/`useMemo` filter-map-slice(0,20)/`RelationshipPicker`
 * wiring) — accepted, tracked debt: promoting a shared generic single-value picker to
 * `packages/ui` would mean also migrating `InternalLinkForm`'s own copy in the same pass, out of
 * scope for a Component Library-only branch. Flagged here for whoever adds a 3rd single-value
 * relationship field, since that's the point this codebase's own established convention treats as
 * the real trigger to extract. `excludeRecordId` (the record currently being edited, `undefined`
 * in create mode since there is no prior `recordId` yet) is filtered out of the option pool so a
 * component can't pick itself as its own replacement — the real, authoritative self-reference
 * guard still runs server-side (`ComponentsService.assertReplacementExists()`); this is purely a
 * UX nicety, not the enforcement point. `onSelect` REPLACES the current selection (not appends,
 * unlike the many-to-many `tokenIds` picker below) and `onRemove`/the picker's own chip "x" button
 * clears it back to `null`.
 */
function SingleComponentPicker({
  label,
  components,
  excludeRecordId,
  selected,
  onChange,
  hint,
}: {
  readonly label: string;
  readonly components: readonly ComponentRecord[];
  readonly excludeRecordId: string | undefined;
  readonly selected: RelationshipOption | null;
  readonly onChange: (next: RelationshipOption | null) => void;
  readonly hint?: string;
}): ReactNode {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return components
      .filter(
        (component) =>
          component.recordId !== excludeRecordId &&
          component.recordId !== selected?.id &&
          (lowerQuery === "" || component.name.toLowerCase().includes(lowerQuery)),
      )
      .map(toComponentOption)
      .slice(0, 20);
  }, [components, excludeRecordId, selected, query]);

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

export type ComponentLibraryFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: ComponentRecord }
) & {
  readonly designTokens: readonly DesignTokenRecord[];
  readonly components: readonly ComponentRecord[];
};

/**
 * Create/edit form for a Component Library record. No approved wireframe/screen spec exists for
 * this module — this is the smallest honest reading of the backend's actual field set (`category`,
 * `name`, `figmaReference`, `tokenIds`, `htmlStructure`, `phpPath`, `scssClassesPath`,
 * `jsDependencies`, `states`, `responsiveBehavior`, `browserSupport`, `accessibility`, `schema`,
 * `analytics`, `tests`, `replacementRecordId`), matching the Website Strategy Center/Persona
 * Library/Design Token Library form pages' own precedent for an unsourced screen.
 *
 * `category`/`publicId` are both create-only (immutable across a record's own version chain per
 * `updateComponentSchema`'s own contract — never accepted on update) and shown read-only on edit,
 * matching `DesignTokenLibraryForm`'s own `group`/`publicId` convention. `approvalStatus` is
 * deliberately never a field here — only the dedicated `POST .../:recordId/status` route
 * (`ComponentStatusActions`) may change it.
 *
 * `htmlStructure`/`phpPath`/`scssClassesPath`/`jsDependencies`/`states`/`responsiveBehavior`/
 * `browserSupport`/`accessibility`/`schema`/`analytics`/`tests` all stay plain `<textarea>`s, NOT
 * `RichTextEditor` — unlike the 2026-08-22 standing rule's default, the backend stores every one
 * of these as plain, unsanitized text (no `sanitizeNullableRichText()` call anywhere in
 * `components.service.ts`), so treating them as HTML here would be dishonest, the same reasoning
 * `DesignTokenLibraryForm`'s own doc comment already documents for its own `semanticPurpose`/
 * `responsiveVariation` fields (module scope doc, design decisions 3/4).
 *
 * `figmaReference` is a plain `type="url"` text input, validated client-side via `isSafeHttpUrl()`
 * before submit (showing an inline error rather than relying solely on the backend's 400) — the
 * backend's own `safeHttpUrlSchema` (`@webdesk/validation`) restricts it to `http:`/`https:`
 * server-side, closing the same stored-XSS class `ProjectEnvironment.url` once shipped with
 * unguarded, matching `BrandLibraryForm`'s own `fileReference` precedent.
 *
 * `tokenIds` is a real, existence-validated many-to-many relationship into Design Token Library's
 * own `recordId`s (`RelationshipPicker`, matching `PersonaLibraryForm`'s own `relatedServiceIds`
 * pattern, including its raw-id-fallback-for-an-out-of-window-id behavior). `replacementRecordId`
 * is a real, existence-validated SINGLE self-referential pointer into this module's own table
 * (`SingleComponentPicker` above, matching `InternalLinkForm`'s own `SinglePagePicker` pattern).
 *
 * Editing an APPROVED record's own genuinely novel backend behavior (mirrors
 * `DesignTokenLibraryForm`'s own identical divergence): rather than mutating that row in place,
 * the backend forks a brand-new draft version instead (a different `id`, `versionNumber + 1`, same
 * `recordId`) — the edit form surfaces this plainly before submit (`forkNotice` below), since it's
 * a real, surprising divergence from every other module's own edit behavior in this app.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. On success, always redirects to
 * `/component-library/{recordId}` using the URL's own stable `recordId` route param (not
 * `body.data.id`, which changes on a fork) — this always lands correctly on whichever row is now
 * current, whether the edit mutated in place or forked.
 */
export function ComponentLibraryForm(props: ComponentLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [figmaReference, setFigmaReference] = useState(initial?.figmaReference ?? "");
  const [tokenIds, setTokenIds] = useState<readonly string[]>(initial?.tokenIds ?? []);
  const [htmlStructure, setHtmlStructure] = useState(initial?.htmlStructure ?? "");
  const [phpPath, setPhpPath] = useState(initial?.phpPath ?? "");
  const [scssClassesPath, setScssClassesPath] = useState(initial?.scssClassesPath ?? "");
  const [jsDependencies, setJsDependencies] = useState(initial?.jsDependencies ?? "");
  const [states, setStates] = useState(initial?.states ?? "");
  const [responsiveBehavior, setResponsiveBehavior] = useState(initial?.responsiveBehavior ?? "");
  const [browserSupport, setBrowserSupport] = useState(initial?.browserSupport ?? "");
  const [accessibility, setAccessibility] = useState(initial?.accessibility ?? "");
  const [schema, setSchema] = useState(initial?.schema ?? "");
  const [analytics, setAnalytics] = useState(initial?.analytics ?? "");
  const [tests, setTests] = useState(initial?.tests ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tokenOptionsById = useMemo(
    () => new Map(props.designTokens.map((token) => [token.recordId, token])),
    [props.designTokens],
  );
  const [tokenQuery, setTokenQuery] = useState("");
  const tokenOptions = useMemo(() => {
    const lowerQuery = tokenQuery.trim().toLowerCase();
    return props.designTokens
      .filter(
        (token) =>
          !tokenIds.includes(token.recordId) &&
          (lowerQuery === "" || token.name.toLowerCase().includes(lowerQuery)),
      )
      .map(toDesignTokenOption)
      .slice(0, 20);
  }, [props.designTokens, tokenIds, tokenQuery]);

  // Lazy initializer — this scan over up to 100 `props.components` is only ever needed once, to
  // seed the initial value, not on every render (unlike `tokenOptionsById` above, which is a real
  // per-render derived value and correctly uses `useMemo`).
  const [replacement, setReplacement] = useState<RelationshipOption | null>(() => {
    if (props.mode !== "edit" || !props.initial.replacementRecordId) {
      return null;
    }
    const found = props.components.find(
      (component) => component.recordId === props.initial.replacementRecordId,
    );
    // An id outside the picker's 100-row fetch window falls back to showing the raw id itself
    // as its own chip, rather than being silently dropped — matches PersonaLibraryForm's own
    // raw-id fallback precedent for the identical case, so a real relationship is never
    // invisible or unremovable in this UI.
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
      // publicId/category/name are real HTML `required` fields — the browser's own constraint
      // validation blocks a submit event from ever firing while any is empty, so no redundant
      // JS-level check is needed here, matching DesignTokenLibraryForm's own precedent.
      const trimmedName = name.trim();
      const trimmedFigmaReference = figmaReference.trim();

      if (trimmedFigmaReference !== "" && !isSafeHttpUrl(trimmedFigmaReference)) {
        setError("Figma reference must be a valid http:// or https:// URL.");
        return;
      }

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateComponentSchema's own nullish
      // contract; an explicit null is what actually clears an existing value back to "none".
      function plainField(fieldValue: string): string | null | undefined {
        const trimmed = fieldValue.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      const sharedFields = {
        name: trimmedName,
        figmaReference: plainField(figmaReference),
        tokenIds: tokenIds.length > 0 ? tokenIds : props.mode === "create" ? undefined : null,
        htmlStructure: plainField(htmlStructure),
        phpPath: plainField(phpPath),
        scssClassesPath: plainField(scssClassesPath),
        jsDependencies: plainField(jsDependencies),
        states: plainField(states),
        responsiveBehavior: plainField(responsiveBehavior),
        browserSupport: plainField(browserSupport),
        accessibility: plainField(accessibility),
        schema: plainField(schema),
        analytics: plainField(analytics),
        tests: plainField(tests),
        replacementRecordId: replacement
          ? replacement.id
          : props.mode === "create"
            ? undefined
            : null,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), category: category.trim() }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/component-library/components`
          : `${getApiBaseUrl()}/component-library/components/${props.recordId}/update`;

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
          setError("Component was created, but the response was unexpected. Please refresh.");
          return;
        }
        recordId = result.data.recordId;
      } else {
        recordId = props.recordId;
      }
      router.push(`/component-library/${recordId}`);
    } catch (err) {
      console.error("Failed to save component", err);
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
            <input
              id="category"
              type="text"
              required
              maxLength={CATEGORY_MAX_LENGTH}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={styles.input}
            />
            <span className={styles.helperText}>
              Free text — e.g. "navigation", "hero", "button", "card", "form", "proof bar". Never
              changeable once created — a different category means a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Category</span>
            <span className={styles.readonlyValue}>{props.initial.category}</span>
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
        <legend className={styles.fieldsetLegend}>Design</legend>

        <div className={styles.field}>
          <label htmlFor="figmaReference" className={styles.label}>
            Figma reference
          </label>
          <input
            id="figmaReference"
            type="url"
            value={figmaReference}
            onChange={(event) => setFigmaReference(event.target.value)}
            maxLength={FIGMA_REFERENCE_MAX_LENGTH}
            className={styles.input}
          />
        </div>

        <RelationshipPicker
          label="Design tokens"
          query={tokenQuery}
          onQueryChange={setTokenQuery}
          options={tokenOptions}
          selected={tokenIds.map((id) => {
            const token = tokenOptionsById.get(id);
            return { id, displayName: token ? token.name : id };
          })}
          onSelect={(option) => {
            if (tokenIds.length >= TOKEN_MAX_COUNT) {
              setError(`A component can bind at most ${TOKEN_MAX_COUNT} design tokens.`);
              return;
            }
            setTokenIds([...tokenIds, option.id]);
          }}
          onRemove={(id) => setTokenIds(tokenIds.filter((existing) => existing !== id))}
          hint={
            tokenIds.length >= TOKEN_MAX_COUNT
              ? `Maximum of ${TOKEN_MAX_COUNT} tokens reached — remove one to add another.`
              : "Search and select the design tokens this component's implementation binds to."
          }
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Implementation</legend>

        <div className={styles.field}>
          <label htmlFor="htmlStructure" className={styles.label}>
            HTML structure
          </label>
          <textarea
            id="htmlStructure"
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={htmlStructure}
            onChange={(event) => setHtmlStructure(event.target.value)}
            className={styles.textarea}
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="phpPath" className={styles.label}>
            PHP path
          </label>
          <textarea
            id="phpPath"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={phpPath}
            onChange={(event) => setPhpPath(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="scssClassesPath" className={styles.label}>
            SCSS classes / path
          </label>
          <textarea
            id="scssClassesPath"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={scssClassesPath}
            onChange={(event) => setScssClassesPath(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="jsDependencies" className={styles.label}>
            JS dependencies
          </label>
          <textarea
            id="jsDependencies"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={jsDependencies}
            onChange={(event) => setJsDependencies(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Behavior</legend>

        <div className={styles.field}>
          <label htmlFor="states" className={styles.label}>
            States
          </label>
          <textarea
            id="states"
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={states}
            onChange={(event) => setStates(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
          <span className={styles.helperText}>
            Interaction/variant states — hover, focus, disabled, loading, empty, etc.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="responsiveBehavior" className={styles.label}>
            Responsive behavior
          </label>
          <textarea
            id="responsiveBehavior"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={responsiveBehavior}
            onChange={(event) => setResponsiveBehavior(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="browserSupport" className={styles.label}>
            Browser support
          </label>
          <textarea
            id="browserSupport"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={browserSupport}
            onChange={(event) => setBrowserSupport(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="accessibility" className={styles.label}>
            Accessibility
          </label>
          <textarea
            id="accessibility"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={accessibility}
            onChange={(event) => setAccessibility(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Metadata</legend>

        <div className={styles.field}>
          <label htmlFor="schema" className={styles.label}>
            Schema
          </label>
          <textarea
            id="schema"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={schema}
            onChange={(event) => setSchema(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="analytics" className={styles.label}>
            Analytics
          </label>
          <textarea
            id="analytics"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={analytics}
            onChange={(event) => setAnalytics(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="tests" className={styles.label}>
            Tests
          </label>
          <textarea
            id="tests"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={tests}
            onChange={(event) => setTests(event.target.value)}
            className={styles.textarea}
            rows={2}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <SingleComponentPicker
          label="Replacement component"
          components={props.components}
          excludeRecordId={props.mode === "edit" ? props.initial.recordId : undefined}
          selected={replacement}
          onChange={setReplacement}
          hint="If this component is being retired, search and select the component that replaces it."
        />
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create component" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create" ? "/component-library" : `/component-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
