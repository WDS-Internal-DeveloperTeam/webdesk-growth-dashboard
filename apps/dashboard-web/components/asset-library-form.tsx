"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Asset, AssetVisibility } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { VISIBILITY_LABEL, VISIBILITY_VALUES } from "@/lib/asset-library-query";
import { findOverLongRichTextField, richTextFieldValue } from "@/lib/rich-text";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { RichTextEditor } from "./rich-text-editor";
import styles from "./asset-library-form.module.css";

// Mirrors apps/dashboard-api/src/asset-library/asset-library.dto.ts — kept in sync by hand, same
// approach BrandLibraryForm/ServiceLibraryForm/ProofAndClaimsLibraryForm all use.
const PUBLIC_ID_MAX_LENGTH = 64;
const TITLE_MAX_LENGTH = 255;
const FILE_REFERENCE_MAX_LENGTH = 500;
const SHORT_TEXT_MAX_LENGTH = 255;
const LONG_TEXT_MAX_LENGTH = 4000;
const CHECKSUM_MAX_LENGTH = 128;
// Postgres INTEGER ceiling — widthPx/heightPx/durationSeconds are all INTEGER columns
// (asset-library.dto.ts's own nonNegativeIntegerField).
const MAX_PG_INTEGER = 2147483647;

export type AssetLibraryFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly assetId: string; readonly initial: Asset };

/**
 * Create/edit form for an asset (`03_Detailed_Module_Specifications.md §12`'s own field list — no
 * approved wireframe/screen spec exists for this module, matching the Brand/Content Template/
 * Persona/Service Library form pages' own "smallest honest reading" precedent for an unsourced
 * screen). `approvalStatus`/`scanStatus`/`version`/`isPublished`/`publishedAt` are deliberately
 * never fields here — `approvalStatus` only changes via the dedicated `POST .../:id/status` route
 * (`AssetLibraryStatusActions`), `isPublished`/`publishedAt` only via the dedicated
 * `POST .../:id/{publish,unpublish}` routes (`AssetLibraryPublishActions`), `scanStatus` is
 * server-managed and never accepted as caller input (D4 — no scanner exists), and `version` is
 * server-managed. `publicId` is create-only (shown read-only on edit, matching
 * `updateAssetSchema`'s own `.omit({publicId: true})` contract).
 *
 * `fileReference` is a plain `type="url"` text input, validated client-side via `isSafeHttpUrl()`
 * before submit — the backend's own `safeHttpUrlSchema` (`@webdesk/validation`) restricts it to
 * `http:`/`https:` server-side, mirroring `BrandLibraryRecord.fileReference`'s own guard.
 * `mimeType`/`fileSizeBytes`/`checksum`/dimension/`durationSeconds` are caller-supplied metadata in
 * this pass (D1 — no Vercel Blob store is provisioned, so no real upload path exists yet).
 * `fileSizeBytes` is submitted as a plain digit-string, matching the backend's own BIGINT-safe
 * string contract (`fileSizeBytesField`) — a plain `z.number()` would lose precision on a large
 * value.
 *
 * `description`/`licence`/`consentReference`/`altTextGuidance`/`retentionNote` use `RichTextEditor`
 * (Tiptap), per the 2026-08-22 standing rule requiring every dashboard-web long-text field to use
 * the rich-text editor going forward. The resulting HTML is sanitized server-side before it's ever
 * stored and again at render time via `SanitizedRichText`, the same double-sanitization pattern
 * every sibling module's own rich-text fields already establish.
 *
 * `visibility`/`consentReference` need one further piece of care this form's siblings don't: on a
 * `restricted` asset, the backend redacts `fileReference`/`consentReference` to `null` for any
 * caller lacking `view_confidential` (D2) — which is every role today (zero-seeded). A redacted
 * `null` and a genuinely-unset `null` are indistinguishable from `Asset`'s own shape, so this form
 * shows an inert notice instead of a blank, editable field whenever the initial record is
 * `restricted`, and — critically — never resubmits an empty value for either field in that case,
 * so a save can never silently overwrite real confidential content the caller simply couldn't see.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses.
 */
export function AssetLibraryForm(props: AssetLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  // A restricted record whose consentReference came back null — either genuinely redacted for a
  // caller lacking view_confidential, or genuinely never set. Deliberately requires BOTH
  // conditions, not just `visibility === "restricted"` alone: a caller who genuinely holds
  // view_confidential sees the real, non-null value here (the backend only redacts, never omits,
  // for a caller with the grant), and must still be able to edit it normally — keying this off
  // visibility alone would have permanently hidden and un-editable-via-this-form a field that
  // caller can legitimately see and change. Computed once from the initial load; visibility itself
  // is not editable in this pass (there is no dedicated visibility-transition route, so it stays a
  // plain field below, but this specific "was I shown a redacted record" fact should not change
  // mid-edit).
  const isRedacted = initial?.visibility === "restricted" && initial?.consentReference === null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [fileReference, setFileReference] = useState(initial?.fileReference ?? "");
  const [mimeType, setMimeType] = useState(initial?.mimeType ?? "");
  const [fileSizeBytes, setFileSizeBytes] = useState(initial?.fileSizeBytes ?? "");
  const [checksum, setChecksum] = useState(initial?.checksum ?? "");
  const [widthPx, setWidthPx] = useState(initial?.widthPx?.toString() ?? "");
  const [heightPx, setHeightPx] = useState(initial?.heightPx?.toString() ?? "");
  const [durationSeconds, setDurationSeconds] = useState(
    initial?.durationSeconds?.toString() ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [licence, setLicence] = useState(initial?.licence ?? "");
  const [licenceHolder, setLicenceHolder] = useState(initial?.licenceHolder ?? "");
  const [consentReference, setConsentReference] = useState(initial?.consentReference ?? "");
  const [altTextGuidance, setAltTextGuidance] = useState(initial?.altTextGuidance ?? "");
  const [visibility, setVisibility] = useState<AssetVisibility>(initial?.visibility ?? "internal");
  const [retentionNote, setRetentionNote] = useState(initial?.retentionNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // title is a real HTML `required` field — the browser's own constraint validation blocks a
      // submit event from ever firing while it's empty, so no redundant JS-level check is needed
      // for it here, matching ProjectForm/BrandLibraryForm's own precedent.
      const trimmedTitle = title.trim();
      const trimmedFileReference = fileReference.trim();
      const trimmedFileSizeBytes = fileSizeBytes.trim();
      const trimmedWidthPx = widthPx.trim();
      const trimmedHeightPx = heightPx.trim();
      const trimmedDurationSeconds = durationSeconds.trim();

      if (trimmedFileReference !== "" && !isSafeHttpUrl(trimmedFileReference)) {
        setError("File reference must be a valid http:// or https:// URL.");
        return;
      }
      if (trimmedFileSizeBytes !== "" && !/^\d+$/.test(trimmedFileSizeBytes)) {
        setError("File size (bytes) must be a non-negative whole number.");
        return;
      }

      function integerField(value: string): number | null | undefined {
        if (value === "") return props.mode === "create" ? undefined : null;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PG_INTEGER) {
          return NaN; // caught below as a validation error
        }
        return parsed;
      }
      const parsedWidthPx = integerField(trimmedWidthPx);
      const parsedHeightPx = integerField(trimmedHeightPx);
      const parsedDurationSeconds = integerField(trimmedDurationSeconds);
      if (
        Number.isNaN(parsedWidthPx as number) ||
        Number.isNaN(parsedHeightPx as number) ||
        Number.isNaN(parsedDurationSeconds as number)
      ) {
        setError(`Width, height, and duration must be whole numbers up to ${MAX_PG_INTEGER}.`);
        return;
      }

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateAssetSchema's own nullish contract;
      // an explicit null is what actually clears an existing value. Mirrors BrandLibraryForm's own
      // urlField()/richTextField() convention, applied to a plain string.
      function plainField(value: string): string | null | undefined {
        if (value !== "") return value;
        return props.mode === "create" ? undefined : null;
      }

      // richTextFieldValue() (lib/rich-text.ts) carries the actual nullish-contract logic, shared
      // with brand-library-form.tsx/service-library-form.tsx/persona-library-form.tsx.
      function richTextField(value: string): string | null | undefined {
        return richTextFieldValue(value, props.mode);
      }

      const richTextFields: ReadonlyArray<readonly [string, string]> = [
        ["Description", description],
        ["Licence", licence],
        ["Consent reference", consentReference],
        ["Alt text guidance", altTextGuidance],
        ["Retention note", retentionNote],
      ];
      const lengthError = findOverLongRichTextField(richTextFields, LONG_TEXT_MAX_LENGTH);
      if (lengthError) {
        setError(lengthError);
        return;
      }

      const sharedFields = {
        title: trimmedTitle,
        fileReference: plainField(trimmedFileReference),
        mimeType: plainField(mimeType.trim()),
        fileSizeBytes: plainField(trimmedFileSizeBytes),
        checksum: plainField(checksum.trim()),
        widthPx: parsedWidthPx,
        heightPx: parsedHeightPx,
        durationSeconds: parsedDurationSeconds,
        description: richTextField(description),
        licence: richTextField(licence),
        licenceHolder: plainField(licenceHolder.trim()),
        // Never resubmits a redacted-null confidential field as a real clear — an empty value here
        // means "unchanged," not "clear," whenever the record is restricted and the caller can't
        // actually see the real stored value.
        consentReference: isRedacted ? undefined : richTextField(consentReference),
        altTextGuidance: richTextField(altTextGuidance),
        visibility,
        retentionNote: richTextField(retentionNote),
      };

      const payload =
        props.mode === "create" ? { ...sharedFields, publicId: publicId.trim() } : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/asset-library/assets`
          : `${getApiBaseUrl()}/asset-library/assets/${props.assetId}/update`;

      const result = await postMutation<{ id: string }>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/asset-library/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save asset", err);
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
          <label htmlFor="title" className={styles.label}>
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={TITLE_MAX_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>File</legend>
        <p className={styles.helperText}>
          Metadata-only in this pass — no direct upload capability exists yet (no Vercel Blob store
          is provisioned). These fields are caller-supplied, not values derived from a file this
          system actually holds.
        </p>

        <div className={styles.field}>
          <label htmlFor="fileReference" className={styles.label}>
            File reference
          </label>
          <input
            id="fileReference"
            type="url"
            maxLength={FILE_REFERENCE_MAX_LENGTH}
            value={fileReference}
            onChange={(event) => setFileReference(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            A link to the asset itself — only http:// or https:// URLs are accepted.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="mimeType" className={styles.label}>
            MIME type
          </label>
          <input
            id="mimeType"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={mimeType}
            onChange={(event) => setMimeType(event.target.value)}
            className={styles.input}
            placeholder="image/png"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="fileSizeBytes" className={styles.label}>
            File size (bytes)
          </label>
          <input
            id="fileSizeBytes"
            type="text"
            inputMode="numeric"
            value={fileSizeBytes}
            onChange={(event) => setFileSizeBytes(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="checksum" className={styles.label}>
            Checksum
          </label>
          <input
            id="checksum"
            type="text"
            maxLength={CHECKSUM_MAX_LENGTH}
            value={checksum}
            onChange={(event) => setChecksum(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="widthPx" className={styles.label}>
            Width (px)
          </label>
          <input
            id="widthPx"
            type="number"
            min={0}
            max={MAX_PG_INTEGER}
            value={widthPx}
            onChange={(event) => setWidthPx(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="heightPx" className={styles.label}>
            Height (px)
          </label>
          <input
            id="heightPx"
            type="number"
            min={0}
            max={MAX_PG_INTEGER}
            value={heightPx}
            onChange={(event) => setHeightPx(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="durationSeconds" className={styles.label}>
            Duration (seconds)
          </label>
          <input
            id="durationSeconds"
            type="number"
            min={0}
            max={MAX_PG_INTEGER}
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Content</legend>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Description
          </label>
          <RichTextEditor id="description" value={description} onChange={setDescription} />
        </div>

        <div className={styles.field}>
          <label htmlFor="licence" className={styles.label}>
            Licence
          </label>
          <RichTextEditor id="licence" value={licence} onChange={setLicence} />
        </div>

        <div className={styles.field}>
          <label htmlFor="licenceHolder" className={styles.label}>
            Licence holder
          </label>
          <input
            id="licenceHolder"
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={licenceHolder}
            onChange={(event) => setLicenceHolder(event.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="consentReference" className={styles.label}>
            Consent reference
          </label>
          {isRedacted ? (
            <p className={styles.redactedNotice}>
              This record is restricted, and its stored consent reference is confidential — you
              don&apos;t have permission to view or change it. Saving this form will leave it
              exactly as it is.
            </p>
          ) : (
            <RichTextEditor
              id="consentReference"
              value={consentReference}
              onChange={setConsentReference}
            />
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="altTextGuidance" className={styles.label}>
            Alt text guidance
          </label>
          <RichTextEditor
            id="altTextGuidance"
            value={altTextGuidance}
            onChange={setAltTextGuidance}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Governance</legend>

        <div className={styles.field}>
          <label htmlFor="visibility" className={styles.label}>
            Visibility
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as AssetVisibility)}
            className={styles.select}
          >
            {VISIBILITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {VISIBILITY_LABEL[value]}
              </option>
            ))}
          </select>
          <span className={styles.helperText}>
            On a Restricted asset, the file reference and consent reference are hidden from anyone
            without confidential-field access — currently everyone, since that grant isn&apos;t
            assigned to any role yet.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="retentionNote" className={styles.label}>
            Retention note
          </label>
          <RichTextEditor id="retentionNote" value={retentionNote} onChange={setRetentionNote} />
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create asset" : "Save changes"}
        </button>
        <a
          href={props.mode === "create" ? "/asset-library" : `/asset-library/${props.assetId}`}
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
