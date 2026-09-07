"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Integration } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { PROVIDER_LABEL, PROVIDER_VALUES } from "@/lib/integrations-query";
import styles from "./integration-form.module.css";

// Mirrors apps/dashboard-api/src/integrations/integrations.dto.ts — kept in sync by hand, same
// approach every sibling module's own form uses.
const PUBLIC_ID_MAX_LENGTH = 64;
const DISPLAY_NAME_MAX_LENGTH = 255;
const CONFIG_REFERENCE_MAX_LENGTH = 2000;
const NOTES_MAX_LENGTH = 10_000;

export type IntegrationFormProps =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly integrationId: string; readonly initial: Integration };

/**
 * Create/edit form for an integration record — no approved wireframe exists for this module; every
 * field mirrors the real backend contract directly
 * (`apps/dashboard-api/src/integrations/integrations.dto.ts`), matching every sibling module's own
 * "smallest honest reading" precedent for an unsourced screen. `publicId`/`provider` are both
 * create-only (shown read-only on edit, matching `updateIntegrationSchema`'s own
 * `.omit({ publicId: true, provider: true })` contract, mirroring `BrandLibraryForm`'s own
 * precedent for a create-only discriminator field). `status`/`lastVerified*`/`isActive` are
 * deliberately never fields here — `status`/`lastVerified*`/`lastVerificationNotes` only change via
 * the dedicated `POST .../:id/verify` route (`IntegrationVerifyAction`), and `isActive` only
 * changes via the dedicated `POST .../:id/toggle-active` route (`IntegrationActiveToggle`).
 *
 * `configReference`/`notes` render as plain `<input>`/`<textarea>` fields, NOT `RichTextEditor` —
 * an explicit, documented exception to the 2026-08-22 standing rule requiring every long-text field
 * to use the rich-text editor: the backend's own DTOs never sanitize these fields as HTML (plain
 * ops metadata — where a secret/config actually lives, never the value itself, per the module
 * registry's own seeded confidentiality note), so treating them as rich text on the frontend alone
 * would be dishonest, matching the identical, already-established exception for Ready for Claude
 * Queue's own long-text fields.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation in this app already uses.
 */
export function IntegrationForm(props: IntegrationFormProps): ReactNode {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [publicId, setPublicId] = useState(initial?.publicId ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [configReference, setConfigReference] = useState(initial?.configReference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // displayName/provider/publicId are real HTML `required` fields — the browser's own
      // constraint validation blocks a submit event from ever firing while any is empty, so no
      // redundant JS-level check is needed for them here, matching BrandLibraryForm/ProjectForm's
      // own precedent.
      const trimmedDisplayName = displayName.trim();

      // Omitted entirely (create) or sent as an explicit null (edit) when empty — an omitted key
      // leaves the field unchanged on update, matching updateIntegrationSchema's own nullish
      // contract; an explicit null is what actually clears an existing value back to "none".
      // Mirrors BrandLibraryForm's own urlField() convention, applied to a plain string.
      function textField(value: string): string | null | undefined {
        if (value !== "") return value;
        return props.mode === "create" ? undefined : null;
      }

      const sharedFields = {
        displayName: trimmedDisplayName,
        configReference: textField(configReference.trim()),
        notes: textField(notes),
      };

      const payload =
        props.mode === "create"
          ? { ...sharedFields, publicId: publicId.trim(), provider }
          : sharedFields;

      const url =
        props.mode === "create"
          ? `${getApiBaseUrl()}/integrations`
          : `${getApiBaseUrl()}/integrations/${props.integrationId}/update`;

      const result = await postMutation<{ id: string }>(url, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/integrations/${result.data.id}`);
    } catch (err) {
      console.error("Failed to save integration", err);
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
            <label htmlFor="provider" className={styles.label}>
              Provider
            </label>
            <select
              id="provider"
              required
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className={styles.select}
            >
              <option value="" disabled>
                Select a provider…
              </option>
              {PROVIDER_VALUES.map((value) => (
                <option key={value} value={value}>
                  {PROVIDER_LABEL[value]}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Immutable once created — changing it would be a different integration.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Provider</span>
            <span className={styles.readonlyValue}>{PROVIDER_LABEL[props.initial.provider]}</span>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="displayName" className={styles.label}>
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            required
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className={styles.input}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>Configuration</legend>

        <div className={styles.field}>
          <label htmlFor="configReference" className={styles.label}>
            Config reference
          </label>
          <input
            id="configReference"
            type="text"
            maxLength={CONFIG_REFERENCE_MAX_LENGTH}
            value={configReference}
            onChange={(event) => setConfigReference(event.target.value)}
            className={styles.input}
          />
          <span className={styles.helperText}>
            Where the real secret/config actually lives (e.g. &quot;Vercel env: dashboard-api /
            GOOGLE_OAUTH_CLIENT_SECRET&quot;) — never the value itself.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="notes" className={styles.label}>
            Notes
          </label>
          <textarea
            id="notes"
            rows={4}
            maxLength={NOTES_MAX_LENGTH}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={styles.textarea}
          />
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Saving…" : props.mode === "create" ? "Create integration" : "Save changes"}
        </button>
        <a
          href={props.mode === "create" ? "/integrations" : `/integrations/${props.integrationId}`}
          className={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
