"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { PortfolioRecord, PortfolioVisibility, ProofClaim } from "@webdesk/shared-types";
import { RelationshipPicker, TagListField, type RelationshipOption } from "@webdesk/ui";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { plainTextFieldValue } from "@/lib/form-field-value";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { VISIBILITY_LABEL, VISIBILITY_VALUES } from "@/lib/portfolio-library-query";
import styles from "./portfolio-library-form.module.css";

// Mirrors apps/dashboard-api/src/portfolio-library/portfolio-library.dto.ts — kept in sync by
// hand, same approach every sibling form in this app uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const SHORT_TEXT_MAX_LENGTH = 255;
const CATEGORY_TAG_MAX_LENGTH = 255;
const CATEGORY_TAG_MAX_COUNT = 200;
const ID_LIST_MAX_COUNT = 200;

// Narrowed to only the field this form actually reads — matches CaseStudyStudioForm's own
// established convention for this exact relationship-picker use case (`claim` is real rich-text
// HTML on `ProofClaim`, so `publicId` is the only honest, always-plain-text display value
// available).
export type PortfolioClaimOption = Pick<ProofClaim, "id" | "publicId">;

function toClaimOptions(claims: readonly PortfolioClaimOption[]): readonly RelationshipOption[] {
  return claims.map((claim) => ({ id: claim.id, displayName: claim.publicId }));
}

export type PortfolioLibraryFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly recordId: string; readonly initial: PortfolioRecord }
) & {
  readonly claims: readonly PortfolioClaimOption[];
};

/**
 * Create/edit form for a portfolio record — no approved wireframe/screen spec exists for this
 * module (`03_Detailed_Module_Specifications.md`'s own field list is the only source), matching
 * the Brand/Content Template/Design Reference Library form pages' own "smallest honest reading"
 * precedent for an unsourced screen. `approvalStatus`/`version`/`isPublished`/`publishedAt` are
 * deliberately never fields here — `approvalStatus` only changes via the dedicated
 * `POST .../:id/status` route (`PortfolioLibraryStatusActions`), `isPublished`/`publishedAt` only
 * change via the dedicated `POST .../:id/publish`/`unpublish` routes
 * (`PortfolioLibraryPublishActions`), and `version` is server-managed. `publicId` is create-only
 * (shown read-only on edit, matching `updatePortfolioRecordSchema`'s own
 * `.omit({publicId: true})` contract).
 *
 * No long-text/rich-text fields exist on this module at all — every text field is a short,
 * single-line value (`z.string().max(255)`), so `RichTextEditor` never applies here.
 *
 * `url` is a plain `type="url"` text input, validated client-side via `isSafeHttpUrl()` before
 * submit (showing an inline error rather than relying solely on the backend's 400) — the
 * backend's own `safeHttpUrlSchema` (`@webdesk/validation`) restricts it to `http:`/`https:`
 * server-side, closing the same stored-XSS class `ProjectEnvironment.url`/
 * `DesignReferenceRecord.sourceUrl` once shipped with unguarded.
 *
 * `additionalCategories`/`tags` are plain, unvalidated free-text tag lists (`TagListField`,
 * `@webdesk/ui`) — no backing categories/tags taxonomy module exists (D8), mirroring
 * `DesignReferenceLibraryForm`'s own `tags` field.
 *
 * `relatedProofIds` is a real, existence-validated `RelationshipPicker` against the `proof_claims`
 * table (D3) — matches `CaseStudyStudioForm`'s own `relatedClaimIds` wiring, including the
 * raw-id-fallback-chip behavior for a selected id outside the 100-row fetch window (a known,
 * already-fixed-once bug class in this codebase — not reintroduced here).
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses.
 */
export function PortfolioLibraryForm(props: PortfolioLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [projectOrClientName, setProjectOrClientName] = useState(
    initial?.projectOrClientName ?? "",
  );
  const [url, setUrl] = useState(initial?.url ?? "");
  const [primaryCategory, setPrimaryCategory] = useState(initial?.primaryCategory ?? "");
  const [additionalCategories, setAdditionalCategories] = useState<readonly string[]>(
    initial?.additionalCategories ?? [],
  );
  const [tags, setTags] = useState<readonly string[]>(initial?.tags ?? []);
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "");
  const [serviceType, setServiceType] = useState(initial?.serviceType ?? "");
  const [launchDate, setLaunchDate] = useState(initial?.launchDate ?? "");
  const [visibility, setVisibility] = useState<PortfolioVisibility | "">(initial?.visibility ?? "");
  const [relatedProofIds, setRelatedProofIds] = useState<readonly string[]>(
    initial?.relatedProofIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
          !relatedProofIds.includes(claim.id) &&
          (lowerQuery === "" || claim.publicId.toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [props.claims, relatedProofIds, claimQuery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    // projectOrClientName/publicId are real HTML `required` fields — the browser's own constraint
    // validation blocks a submit event from ever firing while either is empty, so no redundant
    // JS-level check is needed for them here, matching CaseStudyStudioForm/ProjectForm's own
    // precedent.
    const trimmedProjectOrClientName = projectOrClientName.trim();
    const trimmedUrl = url.trim();

    if (trimmedUrl !== "" && !isSafeHttpUrl(trimmedUrl)) {
      setError("URL must be a valid http:// or https:// URL.");
      return;
    }

    function plainField(value: string): string | null | undefined {
      return plainTextFieldValue(value, props.mode);
    }

    // Free-text array fields: omitted entirely (create) or sent as an explicit null (edit) when
    // empty — an omitted key leaves the field unchanged on update, matching
    // updatePortfolioRecordSchema's own nullish contract; an explicit null is what actually clears
    // an existing value back to "none". Mirrors plainField()'s own convention, applied to an
    // array instead of a string.
    function arrayField(values: readonly string[]): readonly string[] | null | undefined {
      if (values.length > 0) return values;
      return props.mode === "create" ? undefined : null;
    }

    setSubmitting(true);
    try {
      const sharedFields = {
        projectOrClientName: trimmedProjectOrClientName,
        url: plainField(url),
        primaryCategory: plainField(primaryCategory),
        additionalCategories: arrayField(additionalCategories),
        tags: arrayField(tags),
        industry: plainField(industry),
        platform: plainField(platform),
        serviceType: plainField(serviceType),
        launchDate: launchDate === "" ? (props.mode === "create" ? undefined : null) : launchDate,
        relatedProofIds,
        visibility: visibility === "" ? undefined : visibility,
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const submitUrl =
        props.mode === "create"
          ? `${getApiBaseUrl()}/portfolio-library/records`
          : `${getApiBaseUrl()}/portfolio-library/records/${props.recordId}/update`;

      const result = await postMutation<{ id: string }>(submitUrl, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/portfolio-library/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save portfolio record", err);
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
          <label htmlFor="projectOrClientName" className={styles.label}>
            Project/client name
          </label>
          <input
            id="projectOrClientName"
            type="text"
            required
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={projectOrClientName}
            onChange={(event) => setProjectOrClientName(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="url" className={styles.label}>
            URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            The live project or client URL — only http:// or https:// URLs are accepted.
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Classification</legend>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="primaryCategory" className={styles.label}>
              Primary category
            </label>
            <input
              id="primaryCategory"
              type="text"
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={primaryCategory}
              onChange={(event) => setPrimaryCategory(event.target.value)}
              className={styles.input}
            />
          </div>
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
        </div>

        <div className={styles.fieldRow}>
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
          <div className={styles.field}>
            <label htmlFor="serviceType" className={styles.label}>
              Service type
            </label>
            <input
              id="serviceType"
              type="text"
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <TagListField
          id="additionalCategories"
          label="Additional categories"
          hint="Free-text labels — no backing categories taxonomy exists yet."
          values={additionalCategories}
          onChange={setAdditionalCategories}
          maxLength={CATEGORY_TAG_MAX_LENGTH}
          maxCount={CATEGORY_TAG_MAX_COUNT}
        />
        <TagListField
          id="tags"
          label="Tags"
          hint="Free-text labels — no backing tags taxonomy exists yet."
          values={tags}
          onChange={setTags}
          maxLength={CATEGORY_TAG_MAX_LENGTH}
          maxCount={CATEGORY_TAG_MAX_COUNT}
        />

        <div className={styles.field}>
          <label htmlFor="launchDate" className={styles.label}>
            Launch date
          </label>
          <input
            id="launchDate"
            type="date"
            value={launchDate ?? ""}
            onChange={(event) => setLaunchDate(event.target.value)}
            className={styles.input}
          />
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
            onChange={(event) => setVisibility(event.target.value as PortfolioVisibility | "")}
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
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <RelationshipPicker
          label="Related proof claims"
          query={claimQuery}
          onQueryChange={setClaimQuery}
          options={claimOptions}
          // An id outside the picker's 100-row fetch window falls back to showing the raw id
          // itself as its own chip, rather than being silently filtered out — matches
          // CaseStudyStudioForm's/ProofAndClaimsLibraryForm's own established fix.
          selected={relatedProofIds.map((id) => {
            const claim = claimOptionsById.get(id);
            return { id, displayName: claim ? claim.publicId : id };
          })}
          onSelect={(option) => {
            if (relatedProofIds.length >= ID_LIST_MAX_COUNT) return;
            setRelatedProofIds([...relatedProofIds, option.id]);
          }}
          onRemove={(id) =>
            setRelatedProofIds(relatedProofIds.filter((existing) => existing !== id))
          }
          hint="Search and select the proof claims backing this portfolio record."
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
            props.mode === "create" ? "/portfolio-library" : `/portfolio-library/${props.recordId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
