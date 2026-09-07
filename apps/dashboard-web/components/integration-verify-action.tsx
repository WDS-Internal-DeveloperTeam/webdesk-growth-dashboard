"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { IntegrationVerificationResult } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { VERIFICATION_RESULT_LABEL, VERIFICATION_RESULT_VALUES } from "@/lib/integrations-query";
import styles from "./integration-verify-action.module.css";

export interface IntegrationVerifyActionProps {
  readonly integrationId: string;
}

// Mirrors apps/dashboard-api/src/integrations/integrations.dto.ts's verifyIntegrationSchema —
// notes shares the same 10,000-char cap as every other plain "notes" field on this module.
const NOTES_MAX_LENGTH = 10_000;

/**
 * Records a manual verification result — `POST /integrations/:id/verify`. No real outbound call is
 * ever made (D1, `docs/implementation/module-integrations.md`); this is purely an operator
 * attestation, gated on the `review` action (distinct from `edit`, mirroring how that letter is
 * used elsewhere in this app for an attestation-style action rather than raw field mutation).
 *
 * Unlike `IntegrationActiveToggle`, this component always starts from an empty `result`/`notes`
 * pair — it doesn't reflect the integration's own current `lastVerificationResult`/
 * `lastVerificationNotes` (those render read-only in the Status section on the detail page), it
 * only records a NEW result. On success the form resets and `router.refresh()` re-fetches the
 * page's own server-rendered Status section so the newly-recorded result appears there.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern every
 * mutation in this app already uses.
 */
export function IntegrationVerifyAction({
  integrationId,
}: IntegrationVerifyActionProps): ReactNode {
  const router = useRouter();
  const [result, setResult] = useState<IntegrationVerificationResult | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // `result` is a real HTML `required` <select> — the browser's own constraint validation blocks
    // a submit event from ever firing while it's empty, matching every sibling form's own reliance
    // on native required-field validation for a required select/input.
    if (result === "") {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const trimmedNotes = notes.trim();
      const outcome = await postMutation(
        `${getApiBaseUrl()}/integrations/${integrationId}/verify`,
        {
          result,
          notes: trimmedNotes === "" ? null : trimmedNotes,
        },
      );
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      setResult("");
      setNotes("");
      router.refresh();
    } catch (err) {
      console.error("Failed to record verification result", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="verify-result" className={styles.label}>
          Verification result
        </label>
        <select
          id="verify-result"
          required
          value={result}
          onChange={(event) => setResult(event.target.value as IntegrationVerificationResult)}
          className={styles.select}
        >
          <option value="" disabled>
            Select a result…
          </option>
          {VERIFICATION_RESULT_VALUES.map((value) => (
            <option key={value} value={value}>
              {VERIFICATION_RESULT_LABEL[value]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="verify-notes" className={styles.label}>
          Notes
        </label>
        <textarea
          id="verify-notes"
          rows={2}
          maxLength={NOTES_MAX_LENGTH}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={styles.textarea}
        />
      </div>
      <div className={styles.formActions}>
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Recording…" : "Record verification"}
        </button>
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
