"use client";

import { useEffect, useState, type ReactNode } from "react";
import type {
  ApiSuccessResponse,
  CaseStudyConsent,
  CaseStudyConsentType,
} from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { CONSENT_TYPE_LABEL, CONSENT_TYPE_VALUES } from "@/lib/case-study-studio-query";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/datetime-local";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./case-study-consents-section.module.css";

const SHORT_TEXT_MAX_LENGTH = 255;

interface ConsentFormValues {
  readonly consentType: CaseStudyConsentType;
  readonly consentEvidenceReference: string;
  readonly grantedBy: string;
  readonly grantedAt: string;
  readonly notes: string;
}

const EMPTY_FORM: ConsentFormValues = {
  consentType: CONSENT_TYPE_VALUES[0]!,
  consentEvidenceReference: "",
  grantedBy: "",
  grantedAt: "",
  notes: "",
};

export interface CaseStudyConsentsSectionProps {
  readonly caseStudyId: string;
  readonly initialConsents: readonly CaseStudyConsent[];
}

/**
 * `case_study_consents` editing — a real one-to-many child of `case_studies` (case-study-level
 * consent evidence, distinct from an individual asset's own `consent_reference` on Asset Library),
 * built with full add/edit/delete CRUD from day one, matching `ClaimSourcesSection`'s own
 * structural precedent exactly (its closest sibling: a real sub-resource, not a relationship
 * picker). `notes` stays a plain `<input>`, not `RichTextEditor` — the backend's own
 * `createCaseStudyConsentSchema`/`updateCaseStudyConsentSchema` types it as a `shortTextField`
 * (`z.string().max(255)`), not a rich-text field, mirroring `ClaimSourcesSection`'s own reasoning
 * for why its `source` field stays plain: this is a short evidence note, not authored narrative
 * content, so it isn't the kind of "long-text field" the 2026-08-22 standing rich-text rule
 * targets.
 *
 * `consentEvidenceReference` is validated server-side via the shared `safeHttpUrlSchema`
 * (`http:`/`https:` only) — `isSafeHttpUrl()` is still applied client-side before ever rendering a
 * stored value as a link, matching `ClaimSourcesSection`'s/`ProjectEnvironmentsSection`'s own
 * identical defense-in-depth guard.
 *
 * Delete goes through `POST .../:id/delete` (not the `DELETE` HTTP method), matching the module's
 * own established `POST .../:id/update` convention for every other mutation.
 *
 * No `router.refresh()` after a mutation here — no other section on the detail page reads consent
 * data, matching `ClaimSourcesSection`'s own identical reasoning.
 */
export function CaseStudyConsentsSection({
  caseStudyId,
  initialConsents,
}: CaseStudyConsentsSectionProps): ReactNode {
  const [consents, setConsents] = useState(initialConsents);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [addValues, setAddValues] = useState<ConsentFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setConsents(initialConsents);
  }, [initialConsents]);

  const basePath = `${getApiBaseUrl()}/case-study-studio/case-studies/${caseStudyId}/consents`;

  function buildBody(values: ConsentFormValues): Record<string, unknown> {
    return {
      consentType: values.consentType,
      consentEvidenceReference: values.consentEvidenceReference.trim() || null,
      grantedBy: values.grantedBy.trim() || null,
      grantedAt: fromDateTimeLocalValue(values.grantedAt),
      notes: values.notes.trim() || null,
    };
  }

  async function handleAdd(): Promise<void> {
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(addValues)),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<CaseStudyConsent>;
      setConsents((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add consent record", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: ConsentFormValues): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}/update`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(values)),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<CaseStudyConsent>;
      setConsents((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update consent record", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}/delete`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setConsents((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete consent record", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {consents.length === 0 ? (
        <p className={styles.muted}>No consent records yet.</p>
      ) : (
        <ul className={styles.list}>
          {consents.map((consent) =>
            editingId === consent.id ? (
              <li key={consent.id} className={styles.row}>
                <ConsentEditForm
                  consent={consent}
                  pending={pendingIds.has(consent.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(consent.id, values)}
                />
              </li>
            ) : (
              <li key={consent.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>
                    {CONSENT_TYPE_LABEL[consent.consentType]}
                    {consent.grantedBy ? ` — granted by ${consent.grantedBy}` : ""}
                  </span>
                  {consent.consentEvidenceReference ? (
                    isSafeHttpUrl(consent.consentEvidenceReference) ? (
                      <a
                        href={consent.consentEvidenceReference}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.secondaryText}
                      >
                        {consent.consentEvidenceReference}
                      </a>
                    ) : (
                      <span className={styles.secondaryText}>
                        {consent.consentEvidenceReference}
                      </span>
                    )
                  ) : (
                    <span className={styles.secondaryText}>No evidence reference set</span>
                  )}
                  {consent.notes ? (
                    <span className={styles.secondaryText}>{consent.notes}</span>
                  ) : null}
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(consent.id)}
                    onClick={() => setEditingId(consent.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(consent.id)}
                    onClick={() => {
                      void handleDelete(consent.id);
                    }}
                  >
                    {pendingIds.has(consent.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <ConsentAddForm
        values={addValues}
        onChange={setAddValues}
        adding={adding}
        onSubmit={() => void handleAdd()}
      />

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ConsentFields({
  values,
  onChange,
  idPrefix,
}: {
  readonly values: ConsentFormValues;
  readonly onChange: (values: ConsentFormValues) => void;
  readonly idPrefix: string;
}): ReactNode {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-type`} className={styles.label}>
          Consent type
        </label>
        <select
          id={`${idPrefix}-type`}
          value={values.consentType}
          onChange={(event) =>
            onChange({ ...values, consentType: event.target.value as CaseStudyConsentType })
          }
          className={styles.select}
        >
          {CONSENT_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {CONSENT_TYPE_LABEL[value]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-evidence`} className={styles.label}>
          Evidence reference URL
        </label>
        <input
          id={`${idPrefix}-evidence`}
          type="url"
          value={values.consentEvidenceReference}
          onChange={(event) =>
            onChange({ ...values, consentEvidenceReference: event.target.value })
          }
          className={styles.input}
        />
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-grantedBy`} className={styles.label}>
            Granted by
          </label>
          <input
            id={`${idPrefix}-grantedBy`}
            type="text"
            maxLength={SHORT_TEXT_MAX_LENGTH}
            value={values.grantedBy}
            onChange={(event) => onChange({ ...values, grantedBy: event.target.value })}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-grantedAt`} className={styles.label}>
            Granted at
          </label>
          <input
            id={`${idPrefix}-grantedAt`}
            type="datetime-local"
            value={values.grantedAt}
            onChange={(event) => onChange({ ...values, grantedAt: event.target.value })}
            className={styles.input}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-notes`} className={styles.label}>
          Notes
        </label>
        <input
          id={`${idPrefix}-notes`}
          type="text"
          maxLength={SHORT_TEXT_MAX_LENGTH}
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
          className={styles.input}
        />
      </div>
    </>
  );
}

function ConsentAddForm({
  values,
  onChange,
  adding,
  onSubmit,
}: {
  readonly values: ConsentFormValues;
  readonly onChange: (values: ConsentFormValues) => void;
  readonly adding: boolean;
  readonly onSubmit: () => void;
}): ReactNode {
  return (
    <div className={styles.addForm}>
      <p className={styles.addFormTitle}>Add consent record</p>
      <ConsentFields values={values} onChange={onChange} idPrefix="new-consent" />
      <div className={styles.formActions}>
        <button type="button" className={styles.submitButton} disabled={adding} onClick={onSubmit}>
          {adding ? "Adding…" : "Add consent record"}
        </button>
      </div>
    </div>
  );
}

function ConsentEditForm({
  consent,
  pending,
  onCancel,
  onSave,
}: {
  readonly consent: CaseStudyConsent;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: ConsentFormValues) => void;
}): ReactNode {
  const [values, setValues] = useState<ConsentFormValues>({
    consentType: consent.consentType,
    consentEvidenceReference: consent.consentEvidenceReference ?? "",
    grantedBy: consent.grantedBy ?? "",
    grantedAt: toDateTimeLocalValue(consent.grantedAt),
    notes: consent.notes ?? "",
  });

  // Resyncs to the latest stored values if this consent record is genuinely updated elsewhere
  // while this row stays open for editing — keyed on `updatedAt`, matching `ClaimSourcesSection`'s
  // own `SourceEditForm` identical reasoning.
  useEffect(() => {
    setValues({
      consentType: consent.consentType,
      consentEvidenceReference: consent.consentEvidenceReference ?? "",
      grantedBy: consent.grantedBy ?? "",
      grantedAt: toDateTimeLocalValue(consent.grantedAt),
      notes: consent.notes ?? "",
    });
  }, [consent.id, consent.updatedAt]);

  return (
    <div className={styles.editForm}>
      <ConsentFields values={values} onChange={setValues} idPrefix={`edit-consent-${consent.id}`} />
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={pending}
          onClick={() => onSave(values)}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className={styles.cancelButton} disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
