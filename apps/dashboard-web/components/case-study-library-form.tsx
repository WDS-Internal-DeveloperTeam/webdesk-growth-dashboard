"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  CaseStudy,
  CaseStudyLibraryRecord,
  CaseStudyLibraryTestimonial,
} from "@webdesk/shared-types";
import { RelationshipPicker, TagListField, type RelationshipOption } from "@webdesk/ui";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isUuid } from "@/lib/uuid";
import { CaseStudyLibraryTestimonialsField } from "./case-study-library-testimonials-field";
import styles from "./case-study-library-form.module.css";

// Mirrors apps/dashboard-api/src/case-study-library/case-study-library.dto.ts — kept in sync by
// hand, same approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const PAGE_ID_MAX_COUNT = 200;
const TECHNOLOGY_MAX_LENGTH = 100;
const TECHNOLOGY_MAX_COUNT = 100;

function toCaseStudyOption(caseStudy: CaseStudy): RelationshipOption {
  return { id: caseStudy.id, displayName: `${caseStudy.clientName} — ${caseStudy.projectTitle}` };
}

function SingleCaseStudyPicker({
  caseStudies,
  selected,
  onChange,
}: {
  readonly caseStudies: readonly CaseStudy[];
  readonly selected: RelationshipOption | null;
  readonly onChange: (next: RelationshipOption | null) => void;
}): ReactNode {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return caseStudies
      .filter(
        (caseStudy) =>
          caseStudy.id !== selected?.id &&
          (lowerQuery === "" ||
            `${caseStudy.clientName} ${caseStudy.projectTitle}`.toLowerCase().includes(lowerQuery)),
      )
      .map(toCaseStudyOption)
      .slice(0, 20);
  }, [caseStudies, selected, query]);

  return (
    <RelationshipPicker
      label="Case study"
      query={query}
      onQueryChange={setQuery}
      options={options}
      selected={selected ? [selected] : []}
      onSelect={(option) => {
        onChange(option);
        setQuery("");
      }}
      onRemove={() => onChange(null)}
      hint="The published, unpublished, or archived case study this record extends — one library record per case study."
    />
  );
}

export type CaseStudyLibraryFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: CaseStudyLibraryRecord }
) & {
  /** Eligible parent case studies (D5's `CREATABLE_FROM_STATUSES`, already filtered) for the
   *  create form's `SingleCaseStudyPicker` — unused on edit, since `caseStudyId` is create-only. */
  readonly caseStudies: readonly CaseStudy[];
  /** Already resolved to a display summary by the edit page's own server-side `getCaseStudy()`
   *  call — this form never resolves the id to a name itself, mirroring `InternalLinkForm`'s own
   *  reviewer split. Required on edit, unused on create. */
  readonly initialCaseStudy?: CaseStudy;
};

/**
 * Create/edit form for a Case Study Library record — an EXTENSION over Case Study Studio's own
 * `case_studies` (D1); this form never edits any `CaseStudy` field itself, only this module's own
 * `relatedPageIds`/`technologies`/`testimonials`. No approved wireframe exists for this module's
 * screens — `packages/database/src/case-study-library/entities.ts`'s own field list is the only
 * source, matching every sibling module's own "smallest honest reading" precedent for an unsourced
 * screen.
 *
 * `publicId` and the parent `caseStudyId` are BOTH create-only, matching
 * `updateCaseStudyLibraryRecordSchema`'s own `.omit({publicId: true, caseStudyId: true})`
 * contract — a record's identity IS the case study it extends (D1); re-pointing it would be a
 * delete+create, not an edit. Shown read-only on edit via a resolved case study summary
 * (`initialCaseStudy`), matching `InternalLinkForm`'s own resolved-summary convention.
 *
 * `relatedPageIds` is a plain, UUID-format-checked `TagListField`, NOT a `RelationshipPicker` —
 * unlike `relatedServiceIds`/`relatedClaimIds` on `CaseStudyStudioForm`, no org-wide (cross-project)
 * page-lookup capability exists anywhere in this app yet (Page Inventory's own `getPages()` is
 * project-scoped, requiring a `projectId` this form has no natural source for), the same real
 * capability gap `InternalLinkForm`'s own `relatedStrategyRecordId` field already documents for a
 * different module. The backend still existence-validates every id server-side
 * (`PagesService.existingPageIds()`, D2) — a malformed or nonexistent id surfaces as a real 400,
 * not silently accepted.
 *
 * `technologies` is a plain, unvalidated free-text tag list (D3, no dedicated module exists),
 * mirroring `PersonaLibraryForm`'s own `roles`/`industries` fields. `testimonials` uses the new
 * `CaseStudyLibraryTestimonialsField` — see its own doc comment for why this is a novel
 * array-of-objects editor rather than a reused sub-resource-section pattern.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses. Edit submits via `PATCH`
 * (`case-study-library.controller.ts`'s own `@Patch(":id")` route) — unlike most sibling modules'
 * `POST .../update` convention, since this backend was built to the real HTTP-method convention
 * directly.
 */
export function CaseStudyLibraryForm(props: CaseStudyLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [caseStudy, setCaseStudy] = useState<RelationshipOption | null>(
    props.mode === "edit" && props.initialCaseStudy
      ? toCaseStudyOption(props.initialCaseStudy)
      : null,
  );
  const [relatedPageIds, setRelatedPageIds] = useState<readonly string[]>(
    initial?.relatedPageIds ?? [],
  );
  const [technologies, setTechnologies] = useState<readonly string[]>(initial?.technologies ?? []);
  const [testimonials, setTestimonials] = useState<readonly CaseStudyLibraryTestimonial[]>(
    initial?.testimonials ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (props.mode === "create" && !caseStudy) {
      setError("A parent case study is required.");
      return;
    }

    const malformedPageId = relatedPageIds.find((id) => !isUuid(id));
    if (malformedPageId) {
      setError(`"${malformedPageId}" is not a valid page id.`);
      return;
    }

    setSubmitting(true);
    try {
      const sharedFields = {
        relatedPageIds,
        technologies,
        testimonials,
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), caseStudyId: caseStudy!.id }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/case-study-library/records`
          : `${getApiBaseUrl()}/case-study-library/records/${props.recordId}`;

      const result = await postMutation<{ id: string }>(url, payload, {
        method: props.mode === "create" ? "POST" : "PATCH",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(
        `/case-study-library/${props.mode === "create" ? result.data.id : props.recordId}`,
      );
    } catch (err) {
      console.error("Failed to save case study library record", err);
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
            <span className={styles.readonlyValue}>{initial!.publicId}</span>
          </div>
        )}

        {props.mode === "create" ? (
          <SingleCaseStudyPicker
            caseStudies={props.caseStudies}
            selected={caseStudy}
            onChange={setCaseStudy}
          />
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Case study</span>
            <span className={styles.readonlyValue}>
              {props.initialCaseStudy
                ? `${props.initialCaseStudy.clientName} — ${props.initialCaseStudy.projectTitle}`
                : initial!.caseStudyId}
            </span>
          </div>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Related pages</legend>

        <TagListField
          id="relatedPageIds"
          label="Related page IDs"
          hint="Page Inventory page ids this case study covers — existence-validated on save. No cross-project page picker exists yet, so ids are entered by hand."
          values={relatedPageIds}
          onChange={setRelatedPageIds}
          maxLength={128}
          maxCount={PAGE_ID_MAX_COUNT}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Technologies</legend>

        <TagListField
          id="technologies"
          label="Technologies"
          hint="Free-text technology tags — no backing entity exists yet."
          values={technologies}
          onChange={setTechnologies}
          maxLength={TECHNOLOGY_MAX_LENGTH}
          maxCount={TECHNOLOGY_MAX_COUNT}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Testimonials</legend>

        <CaseStudyLibraryTestimonialsField values={testimonials} onChange={setTestimonials} />
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
              ? "/case-study-library"
              : `/case-study-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
