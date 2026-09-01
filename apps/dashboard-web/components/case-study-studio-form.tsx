"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  CaseStudy,
  CaseStudyVisibility,
  ProofClaim,
  Service,
  UserSummary,
} from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { VISIBILITY_LABEL, VISIBILITY_VALUES } from "@/lib/case-study-studio-query";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/datetime-local";
import { plainTextFieldValue } from "@/lib/form-field-value";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import { UserPicker } from "./user-picker";
import styles from "./case-study-studio-form.module.css";

// Mirrors apps/dashboard-api/src/case-study-studio/case-study-studio.dto.ts — kept in sync by
// hand, same approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const SHORT_TEXT_MAX_LENGTH = 255;
const LONG_TEXT_MAX_LENGTH = 40_000;
const ID_LIST_MAX_COUNT = 200;

// Narrowed to only the fields this form actually reads — matches ServiceLibraryForm's/
// PersonaLibraryForm's/ProofAndClaimsLibraryForm's own established convention for this exact
// relationship-picker use case.
export type CaseStudyServiceOption = Pick<Service, "id" | "publicName" | "canonicalName">;
// `claim` is real rich-text HTML (not a plain short name), so `publicId` is the only honest,
// always-plain-text display value available — same reasoning `ProofAndClaimsLibraryListPage`'s own
// `ClaimRow` already documents for linking on `publicId` instead of `claim`.
export type CaseStudyClaimOption = Pick<ProofClaim, "id" | "publicId">;

function toServiceOptions(
  services: readonly CaseStudyServiceOption[],
): readonly RelationshipOption[] {
  return services.map((service) => ({
    id: service.id,
    displayName: service.publicName ?? service.canonicalName,
  }));
}

function toClaimOptions(claims: readonly CaseStudyClaimOption[]): readonly RelationshipOption[] {
  return claims.map((claim) => ({ id: claim.id, displayName: claim.publicId }));
}

export type CaseStudyStudioFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly caseStudyId: string; readonly initial: CaseStudy }
) & {
  readonly services: readonly CaseStudyServiceOption[];
  readonly claims: readonly CaseStudyClaimOption[];
  /** Already resolved to a display summary by the edit page's own server-side `getUser()` call —
   *  this form never resolves an id to a name itself, mirroring `InternalLinkForm`'s/
   *  `ProjectForm`'s own reviewer/owner split. `null` covers both "no reviewer assigned" and "the
   *  assigned reviewer id no longer resolves" (disabled/removed) identically. Absent on create,
   *  where no reviewer can be pre-assigned yet. */
  readonly initialReviewer?: UserSummary | null;
};

/**
 * Create/edit form for a case study's PARENT `case_studies` record only —
 * `case_study_assets`/`case_study_consents`/`case_study_approvals` are all separate sections on
 * the detail page (`CaseStudyAssetsSection`/`CaseStudyConsentsSection`/`CaseStudyApprovalsSection`),
 * matching how Proof and Claims Library's own `claim_sources` sub-resource is a separate section,
 * not inlined into `ProofAndClaimsLibraryForm`. No approved wireframe exists for this module's
 * screens — `docs/implementation/module-case-study-studio.md`'s own D5 field grouping is the only
 * source, matching every sibling module's own "smallest honest reading" precedent for an
 * unsourced screen.
 *
 * `status`/`publishedAt`/`unpublishReason`/`version` are deliberately never fields here — only the
 * dedicated `POST .../:id/status` route (`CaseStudyStatusActions`) may change them, matching
 * `updateCaseStudySchema`'s own contract. `publicId` is create-only (shown read-only on edit,
 * matching every sibling form's own convention). `clientApprovalRequired` is ALSO create-only —
 * the backend's own `updateCaseStudySchema` excludes it entirely (a one-time intake decision,
 * immutable once set, per the backend's own code-review-fixed design) — shown disabled with an
 * explanatory note on edit rather than omitted outright, so its value stays visible.
 *
 * `challenge`/`solution`/`implementation`/`results` use `RichTextEditor` (Tiptap), per the
 * 2026-08-22 standing rule requiring every dashboard-web long-text field to use the rich-text
 * editor — the backend already sanitizes these server-side
 * (`CaseStudiesService.create()`/`update()`'s `sanitizeNullableRichText()`/
 * `sanitizeNullableRichTextIfChanged()`) and again at render time on the detail page via the shared
 * `SanitizedRichText` component, the same double-sanitization pattern every other rich-text field
 * in this app already establishes.
 *
 * `relatedServiceIds` and `relatedClaimIds` are two INDEPENDENT `RelationshipPicker`s, each a real,
 * existence-validated identifier list (against `services`/`proof_claims` respectively) — matching
 * `ProofAndClaimsLibraryForm`'s own `relatedServiceIds` wiring, including the raw-id-fallback-chip
 * behavior for a selected id outside the 100-row fetch window (a known, already-fixed-once bug
 * class in this codebase — not reintroduced here).
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses.
 */
export function CaseStudyStudioForm(props: CaseStudyStudioFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [projectTitle, setProjectTitle] = useState(initial?.projectTitle ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "");
  const [visibility, setVisibility] = useState<CaseStudyVisibility | "">(initial?.visibility ?? "");
  const [embargoDate, setEmbargoDate] = useState(initial?.embargoDate ?? "");
  const [challenge, setChallenge] = useState(initial?.challenge ?? "");
  const [solution, setSolution] = useState(initial?.solution ?? "");
  const [implementation, setImplementation] = useState(initial?.implementation ?? "");
  const [results, setResults] = useState(initial?.results ?? "");
  const [relatedServiceIds, setRelatedServiceIds] = useState<readonly string[]>(
    initial?.relatedServiceIds ?? [],
  );
  const [relatedClaimIds, setRelatedClaimIds] = useState<readonly string[]>(
    initial?.relatedClaimIds ?? [],
  );
  const [reviewer, setReviewer] = useState<UserSummary | null>(
    props.mode === "edit" ? (props.initialReviewer ?? null) : null,
  );
  // Tracks whether the user actually interacted with the reviewer picker — as opposed to
  // `reviewer` simply being `null` because the initial reviewer id couldn't be resolved to a
  // display summary (disabled/removed account). Only an explicit interaction should ever change
  // what gets submitted for assignedReviewerUserId, mirroring ProjectForm's/InternalLinkForm's own
  // ownerTouched/approverTouched.
  const [reviewerTouched, setReviewerTouched] = useState(false);
  const [clientApprovalRequired, setClientApprovalRequired] = useState(
    initial?.clientApprovalRequired ?? false,
  );
  const [scheduledPublishAt, setScheduledPublishAt] = useState(
    toDateTimeLocalValue(initial?.scheduledPublishAt ?? null),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleReviewerChange(next: UserSummary | null): void {
    setReviewer(next);
    setReviewerTouched(true);
  }

  const [serviceQuery, setServiceQuery] = useState("");
  const serviceOptionsById = useMemo(
    () => new Map(props.services.map((service) => [service.id, service])),
    [props.services],
  );
  const serviceOptions = useMemo(() => {
    const lowerQuery = serviceQuery.trim().toLowerCase();
    return toServiceOptions(
      props.services.filter(
        (service) =>
          !relatedServiceIds.includes(service.id) &&
          (lowerQuery === "" ||
            (service.publicName ?? service.canonicalName).toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [props.services, relatedServiceIds, serviceQuery]);

  const [claimQuery, setClaimQuery] = useState("");
  const claimOptionsById = useMemo(
    () => new Map(props.claims.map((claim) => [claim.id, claim])),
    [props.claims],
  );
  const claimOptions = useMemo(() => {
    const lowerQuery = claimQuery.trim().toLowerCase();
    return toClaimOptions(
      props.claims.filter(
        (claim) =>
          !relatedClaimIds.includes(claim.id) &&
          (lowerQuery === "" || claim.publicId.toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [props.claims, relatedClaimIds, claimQuery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmedClientName = clientName.trim();
    const trimmedProjectTitle = projectTitle.trim();
    if (!trimmedClientName || !trimmedProjectTitle) {
      setError("Client name and project title are required.");
      return;
    }

    function plainTextField(value: string): string | null | undefined {
      return plainTextFieldValue(value, props.mode);
    }

    function richTextField(value: string): string | null | undefined {
      return richTextFieldValue(value, props.mode);
    }

    const lengthError = findOverLongRichTextField(
      [
        ["Challenge", challenge],
        ["Solution", solution],
        ["Implementation", implementation],
        ["Results", results],
      ],
      LONG_TEXT_MAX_LENGTH,
    );
    if (lengthError) {
      setError(lengthError);
      return;
    }

    setSubmitting(true);
    try {
      const sharedFields = {
        clientName: trimmedClientName,
        projectTitle: trimmedProjectTitle,
        industry: plainTextField(industry),
        platform: plainTextField(platform),
        visibility: visibility === "" ? undefined : visibility,
        embargoDate:
          embargoDate === "" ? (props.mode === "create" ? undefined : null) : embargoDate,
        challenge: richTextField(challenge),
        solution: richTextField(solution),
        implementation: richTextField(implementation),
        results: richTextField(results),
        relatedServiceIds,
        relatedClaimIds,
        assignedReviewerUserId: reviewerTouched
          ? (reviewer?.id ?? null)
          : props.mode === "edit"
            ? props.initial.assignedReviewerUserId
            : undefined,
        scheduledPublishAt:
          fromDateTimeLocalValue(scheduledPublishAt) ??
          (props.mode === "create" ? undefined : null),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), clientApprovalRequired }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/case-study-studio/case-studies`
          : `${getApiBaseUrl()}/case-study-studio/case-studies/${props.caseStudyId}/update`;

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
      router.push(`/case-study-studio/${body.data.id}`);
    } catch (err) {
      console.error("Failed to save case study", err);
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

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="clientName" className={styles.label}>
              Client name
            </label>
            <input
              id="clientName"
              type="text"
              required
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="projectTitle" className={styles.label}>
              Project title
            </label>
            <input
              id="projectTitle"
              type="text"
              required
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="industry" className={styles.label}>
              Industry
            </label>
            <input
              id="industry"
              type="text"
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="platform" className={styles.label}>
              Platform
            </label>
            <input
              id="platform"
              type="text"
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className={styles.input}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Visibility</legend>

        <div className={styles.field}>
          <label htmlFor="visibility" className={styles.label}>
            Visibility
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as CaseStudyVisibility | "")}
            className={styles.select}
          >
            <option value="">Not set</option>
            {VISIBILITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {VISIBILITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="embargoDate" className={styles.label}>
            Embargo date
          </label>
          <input
            id="embargoDate"
            type="date"
            value={embargoDate ?? ""}
            onChange={(event) => setEmbargoDate(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="scheduledPublishAt" className={styles.label}>
            Scheduled publish at
          </label>
          <input
            id="scheduledPublishAt"
            type="datetime-local"
            value={scheduledPublishAt}
            onChange={(event) => setScheduledPublishAt(event.target.value)}
            className={styles.input}
          />
        </div>

        {props.mode === "create" ? (
          <div className={styles.checkboxField}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={clientApprovalRequired}
                onChange={(event) => setClientApprovalRequired(event.target.checked)}
              />
              Client approval required
            </label>
            <span className={styles.helperText}>
              Set once at intake — determines whether this case study must pass through a separate
              client-approval stage before it can be scheduled. Cannot be changed once the case
              study is created.
            </span>
          </div>
        ) : (
          <div className={styles.checkboxField}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={props.initial.clientApprovalRequired} disabled />
              Client approval required
            </label>
            <span className={styles.helperText}>
              Set once at intake and immutable — this value can no longer be changed.
            </span>
          </div>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Narrative</legend>

        <div className={styles.field}>
          <label htmlFor="challenge" className={styles.label}>
            Challenge
          </label>
          <RichTextEditor id="challenge" value={challenge} onChange={setChallenge} />
        </div>

        <div className={styles.field}>
          <label htmlFor="solution" className={styles.label}>
            Solution
          </label>
          <RichTextEditor id="solution" value={solution} onChange={setSolution} />
        </div>

        <div className={styles.field}>
          <label htmlFor="implementation" className={styles.label}>
            Implementation
          </label>
          <RichTextEditor id="implementation" value={implementation} onChange={setImplementation} />
        </div>

        <div className={styles.field}>
          <label htmlFor="results" className={styles.label}>
            Results
          </label>
          <RichTextEditor id="results" value={results} onChange={setResults} />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <RelationshipPicker
          label="Related services"
          query={serviceQuery}
          onQueryChange={setServiceQuery}
          options={serviceOptions}
          // An id outside the picker's 100-row fetch window falls back to showing the raw id
          // itself as its own chip, rather than being silently filtered out — matches
          // ProofAndClaimsLibraryForm's/PersonaLibraryForm's own established fix.
          selected={relatedServiceIds.map((id) => {
            const service = serviceOptionsById.get(id);
            return {
              id,
              displayName: service ? (service.publicName ?? service.canonicalName) : id,
            };
          })}
          onSelect={(option) => {
            if (relatedServiceIds.length >= ID_LIST_MAX_COUNT) return;
            setRelatedServiceIds([...relatedServiceIds, option.id]);
          }}
          onRemove={(id) =>
            setRelatedServiceIds(relatedServiceIds.filter((existing) => existing !== id))
          }
          hint="Search and select the services this case study is relevant to."
        />

        <RelationshipPicker
          label="Related claims"
          query={claimQuery}
          onQueryChange={setClaimQuery}
          options={claimOptions}
          selected={relatedClaimIds.map((id) => {
            const claim = claimOptionsById.get(id);
            return { id, displayName: claim ? claim.publicId : id };
          })}
          onSelect={(option) => {
            if (relatedClaimIds.length >= ID_LIST_MAX_COUNT) return;
            setRelatedClaimIds([...relatedClaimIds, option.id]);
          }}
          onRemove={(id) =>
            setRelatedClaimIds(relatedClaimIds.filter((existing) => existing !== id))
          }
          hint="Search and select the proof claims backing this case study."
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Governance</legend>

        <UserPicker
          id="assignedReviewerUserId"
          label="Assigned reviewer"
          value={reviewer}
          onChange={handleReviewerChange}
          helperText={
            props.mode === "edit" &&
            !reviewerTouched &&
            !reviewer &&
            props.initial.assignedReviewerUserId
              ? "This case study has an assigned reviewer that could not be resolved (the account may be disabled or removed). The existing assignment will be kept as-is unless you search and select someone new."
              : "Search by name or email. Leave unset for no assigned reviewer."
          }
        />
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create case study" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? "/case-study-studio"
              : `/case-study-studio/${props.caseStudyId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
