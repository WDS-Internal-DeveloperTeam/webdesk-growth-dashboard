"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { DesignTokenRecord, DesignTokenThemeVariation } from "@webdesk/shared-types";
import { TagListField } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  GROUP_LABEL,
  GROUP_VALUES,
  THEME_VARIATION_LABEL,
  THEME_VARIATION_VALUES,
} from "@/lib/design-token-library-query";
import styles from "./design-token-library-form.module.css";

// Mirrors apps/dashboard-api/src/design-token-library/design-token-library.dto.ts — kept in sync
// by hand, same approach ProjectForm/ServiceLibraryForm/PersonaLibraryForm/
// WebsiteStrategyCenterForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
const VALUE_MAX_LENGTH = 2_000;
const UNIT_MAX_LENGTH = 32;
const PLAIN_TEXT_MAX_LENGTH = 2_000;
const USAGE_REFERENCE_MAX_LENGTH = 255;
const USAGE_REFERENCE_MAX_COUNT = 50;

export type DesignTokenLibraryFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: DesignTokenRecord };

/**
 * Create/edit form for a Design Token Library record. No approved wireframe/screen spec exists for
 * this module — this is the smallest honest reading of the backend's actual field set (`group`,
 * `name`, `value`, `unit`, `semanticPurpose`, `responsiveVariation`, `themeVariation`,
 * `usageReferences`), matching the Website Strategy Center/Persona Library form pages' own
 * precedent for an unsourced screen.
 *
 * `group` is create-only (immutable across a record's own version chain per
 * `updateDesignTokenSchema`'s own contract — never accepted on update) and shown read-only on edit,
 * matching `WebsiteStrategyCenterForm`'s `recordType`/`publicId` convention.
 * `approvalStatus` is deliberately never a field here — only the dedicated
 * `POST .../:recordId/status` route (`DesignTokenStatusActions`) may change it.
 *
 * `semanticPurpose`/`responsiveVariation` stay plain `<textarea>`s, NOT `RichTextEditor` — unlike
 * the 2026-08-22 standing rule's default, the backend stores these two fields as plain, unsanitized
 * text (no `sanitizeNullableRichText()` call anywhere in `design-tokens.service.ts`), so treating
 * them as HTML here would be dishonest, the same reasoning
 * `design-reference-library-form.tsx`'s own doc comment already documents for its own
 * `desktopBehavior`/`mobileBehavior` fields. `value`/`unit` are likewise plain single-line text
 * inputs, not rich text (e.g. "#FF5733", "16px").
 *
 * `usageReferences` is a plain, unvalidated free-text tag list (`TagListField`, `@webdesk/ui`) — no
 * backing `component_library`/`page_workspace` module exists yet, mirroring `PersonaLibraryForm`'s
 * own `roles`/`industries` fields.
 *
 * Editing an APPROVED record's own genuinely novel backend behavior (mirrors
 * `WebsiteStrategyCenterForm`'s own identical divergence): rather than mutating that row in place,
 * the backend forks a brand-new draft version instead (a different `id`, `versionNumber + 1`, same
 * `recordId`) — the edit form surfaces this plainly before submit (`forkNotice` below), since it's
 * a real, surprising divergence from every other module's own edit behavior in this app.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. On success, always redirects to
 * `/design-token-library/{recordId}` using the URL's own stable `recordId` route param (not
 * `body.data.id`, which changes on a fork, and not `body.data.recordId`, which is identical but
 * requires trusting the response shape unnecessarily) — this always lands correctly on whichever
 * row is now current, whether the edit mutated in place or forked.
 */
export function DesignTokenLibraryForm(props: DesignTokenLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [group, setGroup] = useState(initial?.group ?? GROUP_VALUES[0]);
  const [name, setName] = useState(initial?.name ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [semanticPurpose, setSemanticPurpose] = useState(initial?.semanticPurpose ?? "");
  const [responsiveVariation, setResponsiveVariation] = useState(
    initial?.responsiveVariation ?? "",
  );
  const [themeVariation, setThemeVariation] = useState(initial?.themeVariation ?? "");
  const [usageReferences, setUsageReferences] = useState<readonly string[]>(
    initial?.usageReferences ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isForkingEdit = props.mode === "edit" && props.initial.approvalStatus === "approved";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // name/value/publicId/group are real HTML `required` fields — the browser's own constraint
      // validation blocks a submit event from ever firing while any is empty, so no redundant
      // JS-level check is needed here, matching WebsiteStrategyCenterForm's own precedent.
      const trimmedName = name.trim();
      const trimmedValue = value.trim();

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateDesignTokenSchema's own nullish
      // contract; an explicit null is what actually clears an existing value back to "none".
      function plainField(fieldValue: string): string | null | undefined {
        const trimmed = fieldValue.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      const sharedFields = {
        name: trimmedName,
        value: trimmedValue,
        unit: plainField(unit),
        semanticPurpose: plainField(semanticPurpose),
        responsiveVariation: plainField(responsiveVariation),
        themeVariation:
          themeVariation === ""
            ? props.mode === "create"
              ? undefined
              : null
            : (themeVariation as DesignTokenThemeVariation),
        usageReferences:
          usageReferences.length > 0 ? usageReferences : props.mode === "create" ? undefined : null,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), group }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/design-token-library/tokens`
          : `${getApiBaseUrl()}/design-token-library/tokens/${props.recordId}/update`;

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
      router.push(`/design-token-library/${recordId}`);
    } catch (err) {
      console.error("Failed to save design token", err);
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
            <label htmlFor="group" className={styles.label}>
              Group
            </label>
            <select
              id="group"
              required
              value={group}
              onChange={(event) => setGroup(event.target.value as (typeof GROUP_VALUES)[number])}
              className={styles.select}
            >
              {GROUP_VALUES.map((groupValue) => (
                <option key={groupValue} value={groupValue}>
                  {GROUP_LABEL[groupValue]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Never changeable once created — a different group means a different record.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Group</span>
            <span className={styles.readonlyValue}>{GROUP_LABEL[props.initial.group]}</span>
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
        <legend className={styles.fieldsetLegend}>Value</legend>

        <div className={styles.field}>
          <label htmlFor="value" className={styles.label}>
            Value
          </label>
          <input
            id="value"
            type="text"
            required
            maxLength={VALUE_MAX_LENGTH}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>e.g. "#FF5733", "16px", "1.5".</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="unit" className={styles.label}>
            Unit
          </label>
          <input
            id="unit"
            type="text"
            maxLength={UNIT_MAX_LENGTH}
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="themeVariation" className={styles.label}>
            Theme variation
          </label>
          <select
            id="themeVariation"
            value={themeVariation}
            onChange={(event) => setThemeVariation(event.target.value)}
            className={styles.select}
          >
            <option value="">Not set</option>
            {THEME_VARIATION_VALUES.map((themeValue) => (
              <option key={themeValue} value={themeValue}>
                {THEME_VARIATION_LABEL[themeValue]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Context</legend>

        <div className={styles.field}>
          <label htmlFor="semanticPurpose" className={styles.label}>
            Semantic purpose
          </label>
          <textarea
            id="semanticPurpose"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={semanticPurpose}
            onChange={(event) => setSemanticPurpose(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="responsiveVariation" className={styles.label}>
            Responsive variation
          </label>
          <textarea
            id="responsiveVariation"
            maxLength={PLAIN_TEXT_MAX_LENGTH}
            value={responsiveVariation}
            onChange={(event) => setResponsiveVariation(event.target.value)}
            className={styles.textarea}
            rows={3}
          />
        </div>

        <TagListField
          id="usageReferences"
          label="Usage references"
          hint="Free-text references to where this token is used — no backing entity exists yet."
          values={usageReferences}
          onChange={setUsageReferences}
          maxLength={USAGE_REFERENCE_MAX_LENGTH}
          maxCount={USAGE_REFERENCE_MAX_COUNT}
        />
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create token" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? "/design-token-library"
              : `/design-token-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
