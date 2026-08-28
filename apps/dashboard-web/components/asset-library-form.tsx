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
 * `visibility`/`fileReference`/`consentReference` need one further piece of care this form's
 * siblings don't: on a `restricted` asset, the backend genuinely OMITS `fileReference`/
 * `consentReference` from the response for any caller lacking `view_confidential` (D2) — which is
 * every role today (zero-seeded) — via `AuthorizationService`'s shared `redactConfidentialFields()`
 * primitive, which `delete`s the key rather than nulling it (the same `undefined`-signals-redaction
 * convention `BusinessKnowledgeRecord.content`/`.notes` already establish). This form checks
 * `=== undefined`, not `=== null`, for exactly that reason (code-review finding, `dashboard-web-
asset-library` — an earlier revision checked `=== null`, which is always false for a genuinely
 * redacted field and so never actually engaged, silently letting a save clear the real confidential
 * value). Each field's redaction is tracked independently, since one may be redacted while the
 * other is genuinely visible (e.g. a caller who holds `view_confidential` sees both as real,
 * non-`undefined` values; a caller who doesn't sees both as `undefined`, key omitted). Wherever a
 * field is redacted, this form shows an inert notice instead of a blank, editable field, and —
 * critically — never resubmits a value for it, so a save can never silently overwrite real
 * confidential content the caller simply couldn't see.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses.
 */
export function AssetLibraryForm(props: AssetLibraryFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  // `undefined` (the key genuinely absent from the fetched Asset) is the real redaction signal —
  // see the doc comment above. Tracked independently per field: a caller who holds
  // view_confidential sees BOTH as real, non-undefined values and must still be able to edit them
  // normally, so this can never be reduced to a single visibility-derived flag. Computed once from
  // the initial load; visibility itself is not editable in this pass (there is no dedicated
  // visibility-transition route, so it stays a plain field below, but this specific "was I shown a
  // redacted field" fact should not change mid-edit).
  // `initial !== null` (not optional chaining) is deliberate: in create mode `initial` is `null`
  // and `initial?.fileReference` would ALSO evaluate to `undefined`, which is indistinguishable
  // from a real redaction signal via optional chaining alone — this guard keeps create mode from
  // ever being misread as "redacted."
  const isFileReferenceRedacted = initial !== null && initial.fileReference === undefined;
  const isConsentReferenceRedacted = initial !== null && initial.consentReference === undefined;

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

      // A discriminated result rather than an `NaN`-as-sentinel: `Number.isNaN(null)`/
      // `Number.isNaN(undefined)` are always `false`, so a NaN sentinel needed an unchecked
      // `as number` cast at every call site to type-check — this makes an invalid value
      // impossible to silently miss (code-review finding).
      type IntegerFieldResult =
        { readonly ok: true; readonly value: number | null | undefined } | { readonly ok: false };
      function integerField(value: string): IntegerFieldResult {
        if (value === "") {
          return { ok: true, value: props.mode === "create" ? undefined : null };
        }
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PG_INTEGER) {
          return { ok: false };
        }
        return { ok: true, value: parsed };
      }
      const widthPxResult = integerField(trimmedWidthPx);
      const heightPxResult = integerField(trimmedHeightPx);
      const durationSecondsResult = integerField(trimmedDurationSeconds);
      if (!widthPxResult.ok || !heightPxResult.ok || !durationSecondsResult.ok) {
        setError(`Width, height, and duration must be whole numbers up to ${MAX_PG_INTEGER}.`);
        return;
      }
      const parsedWidthPx = widthPxResult.value;
      const parsedHeightPx = heightPxResult.value;
      const parsedDurationSeconds = durationSecondsResult.value;

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
        // Never resubmits a redacted field as a real clear — an empty value here means
        // "unchanged," not "clear," whenever the caller couldn't actually see the real stored
        // value. Each field guarded independently (see the isXRedacted doc comment above).
        fileReference: isFileReferenceRedacted ? undefined : plainField(trimmedFileReference),
        mimeType: plainField(mimeType.trim()),
        fileSizeBytes: plainField(trimmedFileSizeBytes),
        checksum: plainField(checksum.trim()),
        widthPx: parsedWidthPx,
        heightPx: parsedHeightPx,
        durationSeconds: parsedDurationSeconds,
        description: richTextField(description),
        licence: richTextField(licence),
        licenceHolder: plainField(licenceHolder.trim()),
        consentReference: isConsentReferenceRedacted ? undefined : richTextField(consentReference),
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
          {isFileReferenceRedacted ? (
            <p className={styles.redactedNotice}>
              This asset is restricted, and its stored file reference is confidential — you
              don&apos;t have permission to view or change it. Saving this form will leave it
              exactly as it is.
            </p>
          ) : (
            <>
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
            </>
          )}
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

        {(
          [
            { id: "widthPx", label: "Width (px)", value: widthPx, onChange: setWidthPx },
            { id: "heightPx", label: "Height (px)", value: heightPx, onChange: setHeightPx },
            {
              id: "durationSeconds",
              label: "Duration (seconds)",
              value: durationSeconds,
              onChange: setDurationSeconds,
            },
          ] as const
        ).map(({ id, label, value, onChange }) => (
          <div key={id} className={styles.field}>
            <label htmlFor={id} className={styles.label}>
              {label}
            </label>
            <input
              id={id}
              type="number"
              min={0}
              max={MAX_PG_INTEGER}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className={styles.input}
            />
          </div>
        ))}
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
          {isConsentReferenceRedacted ? (
            <p className={styles.redactedNotice}>
              This asset is restricted, and its stored consent reference is confidential — you
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
