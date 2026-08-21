"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type {
  Deliverable,
  EngagementModel,
  PlatformTechnology,
  ServiceCategory,
  ServiceConfidentiality,
  ServiceDetail,
  ServicePublicationStatus,
} from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { CONFIDENTIALITY_VALUES, PUBLICATION_STATUS_VALUES } from "@/lib/service-library-query";
import styles from "./service-library-form.module.css";

// Mirrors apps/dashboard-api/src/service-library/service-library.dto.ts — kept in sync by hand,
// same approach components/project-form.tsx/business-knowledge-record-form.tsx already use.
const PUBLIC_ID_MAX_LENGTH = 64;
const NAME_MAX_LENGTH = 255;
const LONG_TEXT_MAX_LENGTH = 20_000;
const TAG_MAX_LENGTH = 128;
const TAG_MAX_COUNT = 200;

export type ServiceLibraryFormInitialValues = ServiceDetail;

export type ServiceLibraryFormProps = (
  | { readonly mode: "create" }
  | {
      readonly mode: "edit";
      readonly serviceId: string;
      readonly initial: ServiceLibraryFormInitialValues;
    }
) & {
  readonly categories: readonly ServiceCategory[];
  readonly deliverables: readonly Deliverable[];
  readonly platforms: readonly PlatformTechnology[];
  readonly engagementModels: readonly EngagementModel[];
};

function toRelationshipOptions<T extends { readonly id: string; readonly name: string }>(
  entities: readonly T[],
): readonly RelationshipOption[] {
  return entities.map((entity) => ({ id: entity.id, displayName: entity.name }));
}

/** A minimal, hand-rolled tag input for `icpIds`/`relatedPageIds`/`relatedCaseStudyIds` —
 *  deliberately NOT `RelationshipPicker`, since these three fields are unvalidated identifier
 *  lists with no backing entity to search against (task package D1: the modules that would own
 *  real validation — `persona_library`/`page_inventory`/`case_study_library` — don't exist yet). */
function TagListField({
  id,
  label,
  hint,
  values,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly values: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
}): ReactNode {
  const [draft, setDraft] = useState("");

  function addTag(): void {
    const trimmed = draft.trim().slice(0, TAG_MAX_LENGTH);
    if (!trimmed || values.length >= TAG_MAX_COUNT || values.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {values.length > 0 ? (
        <ul className={styles.tagList}>
          {values.map((value) => (
            <li key={value} className={styles.tagChip}>
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((v) => v !== value))}
                className={styles.tagRemoveButton}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder="Type a value and press Enter"
        className={styles.input}
      />
      <span className={styles.helperText}>{hint}</span>
    </div>
  );
}

/** Create/edit form for a service (`docs/design/dashboard-ui/15-representative-screen-specifications.md`
 *  §4's field groups: Identity, Positioning, Relationships, Status). `approvalStatus` is
 *  deliberately never a field here — only the dedicated `POST .../:id/status` route
 *  (`ServiceStatusActions`) may change it, matching `updateServiceSchema`'s own contract.
 *  `publicId` is create-only (shown read-only on edit, matching `ProjectForm`'s own precedent);
 *  `publicationStatus` is edit-only, matching `updateServiceSchema`'s own contract (a new service
 *  always starts `draft`). `parentServiceId`/`ownerUserId` exist on the entity but aren't in the
 *  design spec's own named field list, so neither has a form field yet — flagged as a known,
 *  out-of-scope gap in `docs/implementation/dashboard-web-service-library.md`, the same reasoning
 *  that deferred Projects' own `ownerUserId` field until a picker capability existed.
 *
 *  `internalDescription` may be redacted (`undefined`, not `null`) for a `restricted` service the
 *  current viewer lacks `view_confidential` for — rendered as an inert notice and omitted entirely
 *  from the submit payload, the same convention `BusinessKnowledgeRecordForm` already establishes
 *  for its own redacted `content`/`notes` fields, so an unseen confidential value is never
 *  silently overwritten by whatever an empty textarea would otherwise submit.
 *
 *  Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 *  `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 *  `ProjectForm`/`BusinessKnowledgeRecordForm` already use.
 */
export function ServiceLibraryForm(props: ServiceLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  const redacted = props.mode === "edit" && initial?.internalDescription === undefined;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [canonicalName, setCanonicalName] = useState(initial?.canonicalName ?? "");
  const [publicName, setPublicName] = useState(initial?.publicName ?? "");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? props.categories[0]?.id ?? "",
  );
  const [shortPublicDescription, setShortPublicDescription] = useState(
    initial?.shortPublicDescription ?? "",
  );
  const [audience, setAudience] = useState(initial?.audience ?? "");
  const [problems, setProblems] = useState(initial?.problems ?? "");
  const [capabilities, setCapabilities] = useState(initial?.capabilities ?? "");
  const [outcomes, setOutcomes] = useState(initial?.outcomes ?? "");
  const [exclusions, setExclusions] = useState(initial?.exclusions ?? "");
  const [internalDescription, setInternalDescription] = useState(
    redacted ? "" : (initial?.internalDescription ?? ""),
  );
  const [icpIds, setIcpIds] = useState<readonly string[]>(initial?.icpIds ?? []);
  const [relatedPageIds, setRelatedPageIds] = useState<readonly string[]>(
    initial?.relatedPageIds ?? [],
  );
  const [relatedCaseStudyIds, setRelatedCaseStudyIds] = useState<readonly string[]>(
    initial?.relatedCaseStudyIds ?? [],
  );
  const [confidentiality, setConfidentiality] = useState<ServiceConfidentiality>(
    initial?.confidentiality ?? "internal",
  );
  const [publicationStatus, setPublicationStatus] = useState<ServicePublicationStatus>(
    initial?.publicationStatus ?? "draft",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deliverableIds, setDeliverableIds] = useState<readonly string[]>(
    initial?.deliverableIds ?? [],
  );
  const [platformIds, setPlatformIds] = useState<readonly string[]>(initial?.platformIds ?? []);
  const [engagementModelIds, setEngagementModelIds] = useState<readonly string[]>(
    initial?.engagementModelIds ?? [],
  );
  const [deliverableQuery, setDeliverableQuery] = useState("");
  const [platformQuery, setPlatformQuery] = useState("");
  const [engagementModelQuery, setEngagementModelQuery] = useState("");

  const deliverableOptionsById = useMemo(
    () => new Map(props.deliverables.map((d) => [d.id, d])),
    [props.deliverables],
  );
  const platformOptionsById = useMemo(
    () => new Map(props.platforms.map((p) => [p.id, p])),
    [props.platforms],
  );
  const engagementModelOptionsById = useMemo(
    () => new Map(props.engagementModels.map((e) => [e.id, e])),
    [props.engagementModels],
  );

  function filterOptions<T extends { readonly id: string; readonly name: string }>(
    all: readonly T[],
    selectedIds: readonly string[],
    query: string,
  ): readonly RelationshipOption[] {
    const lowerQuery = query.trim().toLowerCase();
    return toRelationshipOptions(
      all.filter(
        (entity) =>
          !selectedIds.includes(entity.id) &&
          (lowerQuery === "" || entity.name.toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // canonicalName/categoryId are both real HTML `required` fields — the browser's own
      // constraint validation blocks a submit event from ever firing (and this handler from ever
      // running) while either is empty, so no redundant JS-level check is needed here, matching
      // ProjectForm/BusinessKnowledgeRecordForm's own precedent of trusting `required` alone for
      // their own required fields.
      const trimmedCanonicalName = canonicalName.trim();

      // Long-text fields: omitted entirely (create) or sent as an explicit null (edit) when
      // empty — omission on create avoids an unnecessary null write for a field never touched;
      // an explicit null on edit is what actually clears an existing value back to "none",
      // matching updateServiceSchema's own nullish contract (an omitted key leaves it unchanged).
      function textField(value: string): string | null | undefined {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
        return props.mode === "create" ? undefined : null;
      }

      const sharedFields = {
        canonicalName: trimmedCanonicalName,
        publicName: textField(publicName),
        categoryId,
        shortPublicDescription: textField(shortPublicDescription),
        audience: textField(audience),
        problems: textField(problems),
        capabilities: textField(capabilities),
        outcomes: textField(outcomes),
        exclusions: textField(exclusions),
        confidentiality,
        icpIds,
        relatedPageIds,
        relatedCaseStudyIds,
        deliverableIds,
        platformIds,
        engagementModelIds,
        // Redacted: omit entirely (never send an empty string in place of content this form
        // never actually loaded — that would silently destroy real confidential content). Not
        // redacted: an explicit value (possibly null) is what keeps/clears it correctly.
        ...(redacted ? {} : { internalDescription: textField(internalDescription) }),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim() }
          : { ...sharedFields, publicationStatus };

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/service-library/services`
          : `${getApiBaseUrl()}/service-library/services/${props.serviceId}/update`;

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
      router.push(`/service-library/${body.data.id}`);
    } catch (err) {
      console.error("Failed to save service", err);
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
          <label htmlFor="canonicalName" className={styles.label}>
            Canonical name
          </label>
          <input
            id="canonicalName"
            type="text"
            required
            maxLength={NAME_MAX_LENGTH}
            value={canonicalName}
            onChange={(event) => setCanonicalName(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="publicName" className={styles.label}>
            Public name
          </label>
          <input
            id="publicName"
            type="text"
            maxLength={NAME_MAX_LENGTH}
            value={publicName}
            onChange={(event) => setPublicName(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Optional — falls back to the canonical name if unset.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="categoryId" className={styles.label}>
            Category
          </label>
          <select
            id="categoryId"
            required
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={styles.select}
          >
            {props.categories.length === 0 ? <option value="">No categories yet</option> : null}
            {props.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Positioning</legend>

        <div className={styles.field}>
          <label htmlFor="shortPublicDescription" className={styles.label}>
            Short public description
          </label>
          <textarea
            id="shortPublicDescription"
            rows={2}
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={shortPublicDescription}
            onChange={(event) => setShortPublicDescription(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="audience" className={styles.label}>
            Audience
          </label>
          <textarea
            id="audience"
            rows={2}
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="problems" className={styles.label}>
            Problems solved
          </label>
          <textarea
            id="problems"
            rows={2}
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={problems}
            onChange={(event) => setProblems(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="capabilities" className={styles.label}>
            Capabilities
          </label>
          <textarea
            id="capabilities"
            rows={2}
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={capabilities}
            onChange={(event) => setCapabilities(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="outcomes" className={styles.label}>
            Outcomes
          </label>
          <textarea
            id="outcomes"
            rows={2}
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={outcomes}
            onChange={(event) => setOutcomes(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="exclusions" className={styles.label}>
            Exclusions
          </label>
          <textarea
            id="exclusions"
            rows={2}
            maxLength={LONG_TEXT_MAX_LENGTH}
            value={exclusions}
            onChange={(event) => setExclusions(event.target.value)}
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="internalDescription" className={styles.label}>
            Internal description
          </label>
          {redacted ? (
            <p className={styles.redactedNotice}>
              This service is restricted and its internal description isn&apos;t visible to you, so
              it can&apos;t be edited from this form.
            </p>
          ) : (
            <>
              <textarea
                id="internalDescription"
                rows={3}
                maxLength={LONG_TEXT_MAX_LENGTH}
                value={internalDescription}
                onChange={(event) => setInternalDescription(event.target.value)}
                className={styles.textarea}
              />
              <span className={styles.helperText}>
                Not shown outside the organization — hidden from anyone without a view-confidential
                grant when this service is Restricted.
              </span>
            </>
          )}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <RelationshipPicker
          label="Deliverables"
          query={deliverableQuery}
          onQueryChange={setDeliverableQuery}
          options={filterOptions(props.deliverables, deliverableIds, deliverableQuery)}
          selected={toRelationshipOptions(
            deliverableIds
              .map((id) => deliverableOptionsById.get(id))
              .filter((d): d is Deliverable => !!d),
          )}
          onSelect={(option) => setDeliverableIds([...deliverableIds, option.id])}
          onRemove={(id) => setDeliverableIds(deliverableIds.filter((existing) => existing !== id))}
          hint="Search and select the deliverables this service includes."
        />

        <RelationshipPicker
          label="Platforms"
          query={platformQuery}
          onQueryChange={setPlatformQuery}
          options={filterOptions(props.platforms, platformIds, platformQuery)}
          selected={toRelationshipOptions(
            platformIds
              .map((id) => platformOptionsById.get(id))
              .filter((p): p is PlatformTechnology => !!p),
          )}
          onSelect={(option) => setPlatformIds([...platformIds, option.id])}
          onRemove={(id) => setPlatformIds(platformIds.filter((existing) => existing !== id))}
          hint="Search and select the platforms/technologies this service supports."
        />

        <RelationshipPicker
          label="Engagement models"
          query={engagementModelQuery}
          onQueryChange={setEngagementModelQuery}
          options={filterOptions(props.engagementModels, engagementModelIds, engagementModelQuery)}
          selected={toRelationshipOptions(
            engagementModelIds
              .map((id) => engagementModelOptionsById.get(id))
              .filter((e): e is EngagementModel => !!e),
          )}
          onSelect={(option) => setEngagementModelIds([...engagementModelIds, option.id])}
          onRemove={(id) =>
            setEngagementModelIds(engagementModelIds.filter((existing) => existing !== id))
          }
          hint="Search and select how this service is engaged/delivered."
        />

        <TagListField
          id="icpIds"
          label="ICPs"
          hint="Unvalidated identifiers — no persona library exists yet to look these up against (task package D1)."
          values={icpIds}
          onChange={setIcpIds}
        />
        <TagListField
          id="relatedPageIds"
          label="Related pages"
          hint="Unvalidated identifiers — no page inventory exists yet to look these up against (task package D1)."
          values={relatedPageIds}
          onChange={setRelatedPageIds}
        />
        <TagListField
          id="relatedCaseStudyIds"
          label="Related case studies"
          hint="Unvalidated identifiers — no case study library exists yet to look these up against (task package D1)."
          values={relatedCaseStudyIds}
          onChange={setRelatedCaseStudyIds}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Status</legend>

        <div className={styles.field}>
          <label htmlFor="confidentiality" className={styles.label}>
            Confidentiality
          </label>
          <select
            id="confidentiality"
            value={confidentiality}
            onChange={(event) => setConfidentiality(event.target.value as ServiceConfidentiality)}
            className={styles.select}
          >
            {CONFIDENTIALITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {props.mode === "edit" ? (
          <div className={styles.field}>
            <label htmlFor="publicationStatus" className={styles.label}>
              Publication status
            </label>
            <select
              id="publicationStatus"
              value={publicationStatus}
              onChange={(event) =>
                setPublicationStatus(event.target.value as ServicePublicationStatus)
              }
              className={styles.select}
            >
              {PUBLICATION_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <p className={styles.helperText}>
          Approval status isn&apos;t set here — a new service always starts Draft; use the
          service&apos;s own status actions to submit it for review.
        </p>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create service" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create" ? "/service-library" : `/service-library/${props.serviceId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
