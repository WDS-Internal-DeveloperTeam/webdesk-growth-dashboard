"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { ProofClaim, ProofClaimVerificationStatus, Service } from "@webdesk/shared-types";
import { RelationshipPicker, TagListField, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import {
  findOverLongRichTextField,
  isEmptyRichTextHtml,
  richTextFieldValue,
} from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./proof-and-claims-library-form.module.css";

// Mirrors apps/dashboard-api/src/proof-and-claims-library/proof-and-claims-library.dto.ts — kept
// in sync by hand, same approach ProjectForm/ServiceLibraryForm/PersonaLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const SHORT_TEXT_MAX_LENGTH = 255;
// Raised from the backend's own original 20_000 alongside its LONG_TEXT_MAX_LENGTH bump — claim/
// approvedWording/restrictions are now HTML from the rich-text editor, carrying real markup
// overhead over the equivalent plain text, same reasoning as service-library-form.tsx's/
// persona-library-form.tsx's own identical raise.
const LONG_TEXT_MAX_LENGTH = 40_000;
const ID_LIST_MAX_LENGTH = 128;
const ID_LIST_MAX_COUNT = 200;

const VERIFICATION_STATUS_VALUES: readonly ProofClaimVerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
];
const VERIFICATION_STATUS_LABEL: Readonly<Record<ProofClaimVerificationStatus, string>> = {
  unverified: "Unverified",
  pending: "Pending",
  verified: "Verified",
};

// Narrowed to only the fields this form actually reads — matches ServiceLibraryForm's/
// PersonaLibraryForm's own established convention for this exact relationship-picker use case.
export type ProofClaimServiceOption = Pick<Service, "id" | "publicName" | "canonicalName">;

export type ProofAndClaimsLibraryFormProps = (
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly claimId: string; readonly initial: ProofClaim }
) & {
  readonly services: readonly ProofClaimServiceOption[];
};

function toRelationshipOptions(
  services: readonly ProofClaimServiceOption[],
): readonly RelationshipOption[] {
  return services.map((service) => ({
    id: service.id,
    displayName: service.publicName ?? service.canonicalName,
  }));
}

/**
 * Create/edit form for a proof claim — `04_Data_Model_and_Ownership.md:119-120`'s own field
 * grouping is the only source (no approved wireframe/screen spec exists for this module, matching
 * the Projects/Business Knowledge Center/Persona Library list/form pages' own "smallest honest
 * reading" precedent for an unsourced screen). `approvalStatus` is deliberately never a field
 * here — only the dedicated `POST .../:id/status` route (`ProofClaimStatusActions`) may change it,
 * matching `updateProofClaimSchema`'s own contract. `publicId` is create-only (shown read-only on
 * edit, matching `ProjectForm`/`ServiceLibraryForm`/`PersonaLibraryForm`'s own precedent).
 *
 * `claim`/`approvedWording`/`restrictions` use `RichTextEditor` (Tiptap), per the 2026-08-22
 * standing rule requiring every dashboard-web long-text field to use the rich-text editor going
 * forward — the backend's original build (`module-proof-and-claims-library`) deliberately kept
 * these as plain, unsanitized text specifically because no UI existed yet (mirroring Persona
 * Library's own original backend build before its later, separate rich-text-editor conversion
 * pass); this UI build is that same follow-up point for this module. The resulting HTML is
 * sanitized server-side before it's ever stored (`claims.service.ts`'s
 * `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`) and again at render time on
 * the detail page, the same double-sanitization pattern every other rich-text field in this app
 * already establishes. `claim` is the one REQUIRED rich-text field in this app so far — checked
 * client-side via `isEmptyRichTextHtml()` before submit (the backend's own `min(1)` would also
 * reject an empty value, but a clean client-side check avoids a wasted round trip).
 *
 * `claimType`/`beforeValue`/`afterValue` are plain short-text fields; `expiryReviewDate` is a date
 * picker (backend `z.string().date()`, `YYYY-MM-DD`). `relatedCaseStudyIds`/`relatedPageIds` are
 * free-text tag lists (`TagListField`, unvalidated, matching Service Library's own `icpIds` shape —
 * `case_study_studio`/`page_inventory` don't exist yet) — `relatedServiceIds` is a real,
 * existence-validated identifier list against the `services` table (`RelationshipPicker`, matching
 * Service Library's/Persona Library's own deliverable/platform/related-service pickers).
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses.
 */
export function ProofAndClaimsLibraryForm(props: ProofAndClaimsLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [claim, setClaim] = useState(initial?.claim ?? "");
  const [claimType, setClaimType] = useState(initial?.claimType ?? "");
  const [beforeValue, setBeforeValue] = useState(initial?.beforeValue ?? "");
  const [afterValue, setAfterValue] = useState(initial?.afterValue ?? "");
  const [verificationStatus, setVerificationStatus] = useState<ProofClaimVerificationStatus>(
    initial?.verificationStatus ?? "unverified",
  );
  const [approvedWording, setApprovedWording] = useState(initial?.approvedWording ?? "");
  const [restrictions, setRestrictions] = useState(initial?.restrictions ?? "");
  const [expiryReviewDate, setExpiryReviewDate] = useState(initial?.expiryReviewDate ?? "");
  const [relatedServiceIds, setRelatedServiceIds] = useState<readonly string[]>(
    initial?.relatedServiceIds ?? [],
  );
  const [relatedCaseStudyIds, setRelatedCaseStudyIds] = useState<readonly string[]>(
    initial?.relatedCaseStudyIds ?? [],
  );
  const [relatedPageIds, setRelatedPageIds] = useState<readonly string[]>(
    initial?.relatedPageIds ?? [],
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

    const trimmedClaim = claim.trim();
    if (isEmptyRichTextHtml(trimmedClaim)) {
      setError("Claim is required.");
      return;
    }

    // Plain-text fields: omitted entirely (create) or sent as an explicit null (edit) when
    // empty — an omitted key leaves the field unchanged on update, matching
    // updateProofClaimSchema's own nullish contract; an explicit null is what actually clears an
    // existing value back to "none".
    function textField(value: string): string | null | undefined {
      const trimmed = value.trim();
      if (trimmed !== "") return trimmed;
      return props.mode === "create" ? undefined : null;
    }

    // The actual nullish-contract logic lives in lib/rich-text.ts's richTextFieldValue() — shared
    // with every other rich-text-editor form in this app.
    function richTextField(value: string): string | null | undefined {
      return richTextFieldValue(value, props.mode);
    }

    const lengthError = findOverLongRichTextField(
      [
        ["Claim", trimmedClaim],
        ["Approved wording", approvedWording],
        ["Restrictions", restrictions],
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
        claim: trimmedClaim,
        claimType: textField(claimType),
        beforeValue: textField(beforeValue),
        afterValue: textField(afterValue),
        verificationStatus,
        approvedWording: richTextField(approvedWording),
        restrictions: richTextField(restrictions),
        expiryReviewDate:
          expiryReviewDate === "" ? (props.mode === "create" ? undefined : null) : expiryReviewDate,
        relatedServiceIds,
        relatedCaseStudyIds,
        relatedPageIds,
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/proof-and-claims-library/claims`
          : `${getApiBaseUrl()}/proof-and-claims-library/claims/${props.claimId}/update`;

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
      router.push(`/proof-and-claims-library/${body.data.id}`);
    } catch (err) {
      console.error("Failed to save proof claim", err);
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
          <label htmlFor="claimType" className={styles.label}>
            Claim type
          </label>
          <input
            id="claimType"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={claimType}
            onChange={(event) => setClaimType(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="claim" className={styles.label}>
            Claim
          </label>
          <RichTextEditor id="claim" value={claim} onChange={setClaim} />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Verification</legend>

        <div className={styles.field}>
          <label htmlFor="verificationStatus" className={styles.label}>
            Verification status
          </label>
          <select
            id="verificationStatus"
            value={verificationStatus}
            onChange={(event) =>
              setVerificationStatus(event.target.value as ProofClaimVerificationStatus)
            }
            className={styles.select}
          >
            {VERIFICATION_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {VERIFICATION_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="beforeValue" className={styles.label}>
              Before value
            </label>
            <input
              id="beforeValue"
              type="text"
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={beforeValue}
              onChange={(event) => setBeforeValue(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="afterValue" className={styles.label}>
              After value
            </label>
            <input
              id="afterValue"
              type="text"
              maxLength={SHORT_TEXT_MAX_LENGTH}
              value={afterValue}
              onChange={(event) => setAfterValue(event.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="expiryReviewDate" className={styles.label}>
            Expiry / review date
          </label>
          <input
            id="expiryReviewDate"
            type="date"
            value={expiryReviewDate}
            onChange={(event) => setExpiryReviewDate(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="approvedWording" className={styles.label}>
            Approved wording
          </label>
          <RichTextEditor
            id="approvedWording"
            value={approvedWording}
            onChange={setApprovedWording}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="restrictions" className={styles.label}>
            Restrictions
          </label>
          <RichTextEditor id="restrictions" value={restrictions} onChange={setRestrictions} />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Relationships</legend>

        <RelationshipPicker
          label="Related services"
          query={serviceQuery}
          onQueryChange={setServiceQuery}
          options={serviceOptions}
          // An id outside the picker's 100-row fetch window (matches PersonaLibraryForm's own
          // established fix) falls back to showing the raw id itself as its own chip, rather than
          // being silently filtered out — matches the detail page's own
          // `serviceNameById.get(id) ?? id` fallback for the identical case, so a real
          // relationship is never invisible or unremovable in this UI.
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
          hint="Search and select the services this claim is relevant to."
        />

        <TagListField
          id="relatedCaseStudyIds"
          label="Related case studies"
          hint="Free-text identifiers — no case study module exists yet to validate against."
          values={relatedCaseStudyIds}
          onChange={setRelatedCaseStudyIds}
          maxLength={ID_LIST_MAX_LENGTH}
          maxCount={ID_LIST_MAX_COUNT}
        />
        <TagListField
          id="relatedPageIds"
          label="Related pages"
          hint="Free-text identifiers — no page inventory module exists yet to validate against."
          values={relatedPageIds}
          onChange={setRelatedPageIds}
          maxLength={ID_LIST_MAX_LENGTH}
          maxCount={ID_LIST_MAX_COUNT}
        />
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create claim" : "Save changes"}
        </button>
        <a
          href={
            props.mode === "create"
              ? "/proof-and-claims-library"
              : `/proof-and-claims-library/${props.claimId}`
          }
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
