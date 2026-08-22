"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Persona, Service } from "@webdesk/shared-types";
import { RelationshipPicker, TagListField, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./persona-library-form.module.css";

// Mirrors apps/dashboard-api/src/persona-library/persona-library.dto.ts — kept in sync by hand,
// same approach ProjectForm/BusinessKnowledgeRecordForm/ServiceLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
const SHORT_TEXT_MAX_LENGTH = 255;
// Raised from 20_000 alongside the backend's own LONG_TEXT_MAX_LENGTH bump — these 8 fields are
// now HTML from the rich-text editor, carrying real markup overhead over the equivalent plain
// text, same reasoning as service-library-form.tsx's own identical raise.
const LONG_TEXT_MAX_LENGTH = 40_000;
const ROLE_INDUSTRY_TAG_MAX_LENGTH = 255;
const ROLE_INDUSTRY_TAG_MAX_COUNT = 100;
const RELATED_SERVICE_MAX_COUNT = 200;

// Narrowed to only the fields this form actually reads — matches the established convention for
// this exact relationship-picker use case (Deliverable/PlatformTechnology/EngagementModel, used by
// ServiceLibraryForm's own sibling pickers, are each similarly narrow {id, publicId, name} types;
// the full Service entity carries ~19 fields this form never touches, a code-review finding).
export type PersonaServiceOption = Pick<Service, "id" | "publicName" | "canonicalName">;

export type PersonaLibraryFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly personaId: string; readonly initial: Persona }
) & {
  readonly services: readonly PersonaServiceOption[];
};

function toRelationshipOptions(
  services: readonly PersonaServiceOption[],
): readonly RelationshipOption[] {
  return services.map((service) => ({
    id: service.id,
    displayName: service.publicName ?? service.canonicalName,
  }));
}

/**
 * Create/edit form for a persona (`03_Detailed_Module_Specifications.md §21`'s own field list —
 * no approved wireframe/screen spec exists for this module, unlike Service Library's own design
 * brief, so this is the smallest honest reading of the backend's actual field set, matching the
 * Projects/Business Knowledge Center list/form pages' own precedent for an unsourced screen).
 * `approvalStatus` is deliberately never a field here — only the dedicated `POST .../:id/status`
 * route (`PersonaStatusActions`) may change it, matching `updatePersonaSchema`'s own contract.
 * `publicId` is create-only (shown read-only on edit, matching `ProjectForm`/`ServiceLibraryForm`'s
 * own precedent).
 *
 * Every long-text field here (`goals`/`pains`/`triggers`/`objections`/`decisionCriteria`/
 * `badFitSignals`/`messagingTrack`/`ctaPreferences`) uses `RichTextEditor` (Tiptap), per the
 * 2026-08-22 standing rule requiring every dashboard-web long-text field to use the rich-text
 * editor going forward — this module was originally excluded from
 * (`docs/implementation/rich-text-editor-long-fields.md`)'s own rollout, but that exclusion no
 * longer applies. The resulting HTML is sanitized server-side before it's ever stored
 * (`personas.service.ts`'s `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`)
 * and again at render time on the detail page, the same double-sanitization pattern
 * `ServiceLibraryForm`'s own fields already establish.
 *
 * `roles`/`industries` are free-text tag lists (`TagListField`, unvalidated, matching Service
 * Library's own `icpIds` shape) — `relatedServiceIds` is a real, existence-validated identifier
 * list against the `services` table (`RelationshipPicker`, matching Service Library's own
 * deliverable/platform/engagement-model pickers), the one genuine cross-module relationship this
 * module has.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * `ProjectForm`/`BusinessKnowledgeRecordForm`/`ServiceLibraryForm` already use.
 */
export function PersonaLibraryForm(props: PersonaLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [buyerType, setBuyerType] = useState(initial?.buyerType ?? "");
  const [companySize, setCompanySize] = useState(initial?.companySize ?? "");
  const [geography, setGeography] = useState(initial?.geography ?? "");
  const [roles, setRoles] = useState<readonly string[]>(initial?.roles ?? []);
  const [industries, setIndustries] = useState<readonly string[]>(initial?.industries ?? []);
  const [goals, setGoals] = useState(initial?.goals ?? "");
  const [pains, setPains] = useState(initial?.pains ?? "");
  const [triggers, setTriggers] = useState(initial?.triggers ?? "");
  const [objections, setObjections] = useState(initial?.objections ?? "");
  const [decisionCriteria, setDecisionCriteria] = useState(initial?.decisionCriteria ?? "");
  const [badFitSignals, setBadFitSignals] = useState(initial?.badFitSignals ?? "");
  const [messagingTrack, setMessagingTrack] = useState(initial?.messagingTrack ?? "");
  const [ctaPreferences, setCtaPreferences] = useState(initial?.ctaPreferences ?? "");
  const [relatedServiceIds, setRelatedServiceIds] = useState<readonly string[]>(
    initial?.relatedServiceIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [serviceQuery, setServiceQuery] = useState("");
  const serviceOptionsById = useMemo(
    () => new Map(props.services.map((service) => [service.id, service])),
    [props.services],
  );
  const serviceOptions = useMemo(() => {
    const lowerQuery = serviceQuery.trim().toLowerCase();
    return toRelationshipOptions(
      props.services.filter(
        (service) =>
          !relatedServiceIds.includes(service.id) &&
          (lowerQuery === "" ||
            (service.publicName ?? service.canonicalName).toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [props.services, relatedServiceIds, serviceQuery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // name is a real HTML `required` field — the browser's own constraint validation blocks a
      // submit event from ever firing while it's empty, so no redundant JS-level check is needed
      // here, matching ProjectForm/ServiceLibraryForm's own precedent.
      const trimmedName = name.trim();

      // Plain-text fields: omitted entirely (create) or sent as an explicit null (edit) when
      // empty — an omitted key leaves the field unchanged on update, matching
      // updatePersonaSchema's own nullish contract; an explicit null is what actually clears an
      // existing value back to "none".
      function textField(value: string): string | null | undefined {
        const trimmed = value.trim();
        if (trimmed !== "") return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      // The actual nullish-contract logic lives in lib/rich-text.ts's richTextFieldValue() — shared
      // with service-library-form.tsx (code-review finding: was hand-duplicated in both files).
      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Goals", goals],
        ["Pains", pains],
        ["Triggers", triggers],
        ["Objections", objections],
        ["Decision criteria", decisionCriteria],
        ["Bad-fit signals", badFitSignals],
        ["Messaging track", messagingTrack],
        ["CTA preferences", ctaPreferences],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, LONG_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        name: trimmedName,
        buyerType: textField(buyerType),
        companySize: textField(companySize),
        geography: textField(geography),
        roles,
        industries,
        goals: richTextField(goals),
        pains: richTextField(pains),
        triggers: richTextField(triggers),
        objections: richTextField(objections),
        decisionCriteria: richTextField(decisionCriteria),
        badFitSignals: richTextField(badFitSignals),
        messagingTrack: richTextField(messagingTrack),
        ctaPreferences: richTextField(ctaPreferences),
        relatedServiceIds,
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/persona-library/personas`
          : `${getApiBaseUrl()}/persona-library/personas/${props.personaId}/update`;

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
      router.push(`/persona-library/${body.data.id}`);
    } catch (err) {
      console.error("Failed to save persona", err);
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

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Buyer profile</legend>

        <div className={styles.field}>
          <label htmlFor="buyerType" className={styles.label}>
            Buyer type
          </label>
          <input
            id="buyerType"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={buyerType}
            onChange={(event) => setBuyerType(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="companySize" className={styles.label}>
            Company size
          </label>
          <input
            id="companySize"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={companySize}
            onChange={(event) => setCompanySize(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="geography" className={styles.label}>
            Geography
          </label>
          <input
            id="geography"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={geography}
            onChange={(event) => setGeography(event.target.value)}
            className={styles.input}
          />
        </div>

        <TagListField
          id="roles"
          label="Roles"
          hint="Buyer-side job titles this persona typically holds."
          values={roles}
          onChange={setRoles}
          maxLength={ROLE_INDUSTRY_TAG_MAX_LENGTH}
          maxCount={ROLE_INDUSTRY_TAG_MAX_COUNT}
        />
        <TagListField
          id="industries"
          label="Industries"
          hint="Target industries this persona is found in."
          values={industries}
          onChange={setIndustries}
          maxLength={ROLE_INDUSTRY_TAG_MAX_LENGTH}
          maxCount={ROLE_INDUSTRY_TAG_MAX_COUNT}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Narrative</legend>

        <RichTextField id="goals" label="Goals" value={goals} onChange={setGoals} />
        <RichTextField id="pains" label="Pains" value={pains} onChange={setPains} />
        <RichTextField id="triggers" label="Triggers" value={triggers} onChange={setTriggers} />
        <RichTextField
          id="objections"
          label="Objections"
          value={objections}
          onChange={setObjections}
        />
        <RichTextField
          id="decisionCriteria"
          label="Decision criteria"
          value={decisionCriteria}
          onChange={setDecisionCriteria}
        />
        <RichTextField
          id="badFitSignals"
          label="Bad-fit signals"
          value={badFitSignals}
          onChange={setBadFitSignals}
        />
        <RichTextField
          id="messagingTrack"
          label="Messaging track"
          value={messagingTrack}
          onChange={setMessagingTrack}
        />
        <RichTextField
          id="ctaPreferences"
          label="CTA preferences"
          value={ctaPreferences}
          onChange={setCtaPreferences}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <RelationshipPicker
          label="Related services"
          query={serviceQuery}
          onQueryChange={setServiceQuery}
          options={serviceOptions}
          // An id outside the picker's 100-row fetch window (code-review finding) falls back to
          // showing the raw id itself as its own chip, rather than being silently filtered out —
          // matches the detail page's own `serviceNameById.get(id) ?? id` fallback for the
          // identical case, so a real relationship is never invisible or unremovable in this UI.
          selected={relatedServiceIds.map((id) => {
            const service = serviceOptionsById.get(id);
            return {
              id,
              displayName: service ? (service.publicName ?? service.canonicalName) : id,
            };
          })}
          onSelect={(option) => {
            if (relatedServiceIds.length >= RELATED_SERVICE_MAX_COUNT) return;
            setRelatedServiceIds([...relatedServiceIds, option.id]);
          }}
          onRemove={(id) =>
            setRelatedServiceIds(relatedServiceIds.filter((existing) => existing !== id))
          }
          hint="Search and select the services this persona is relevant to."
        />
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create persona" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create" ? "/persona-library" : `/persona-library/${props.personaId}`
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
