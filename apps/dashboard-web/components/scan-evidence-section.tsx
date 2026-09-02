"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, ScanEvidence } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import styles from "./scan-evidence-section.module.css";

export interface ScanEvidenceSectionProps {
  readonly projectId: string;
  readonly findingId: string;
  readonly initialEvidence: readonly ScanEvidence[];
}

interface EvidenceFormValues {
  readonly evidenceType: string;
  readonly reference: string;
  readonly notes: string;
  readonly capturedAt: string;
}

const EMPTY_FORM: EvidenceFormValues = {
  evidenceType: "",
  reference: "",
  notes: "",
  capturedAt: "",
};

// Mirrors apps/dashboard-api/src/scan-center/scan-center.dto.ts's createScanEvidenceSchema.
const EVIDENCE_TYPE_MAX_LENGTH = 100;
const NOTES_MAX_LENGTH = 10_000;

/**
 * `scan_evidence` editing — append-only (ADR-0016, `ScanEvidenceEntity`'s own doc comment): the
 * backend exposes no update/delete route for this table at all, unlike every genuine sub-resource
 * elsewhere in this app (`PageUrlsSection`/`ClaimSourcesSection`, both full add/edit/delete CRUD).
 * This section is therefore add-and-list only, composing its CSS from the same shared
 * `project-subresource-section.module.css` base those two use, minus the edit-form/delete-button
 * classes neither this table needs.
 *
 * `reference` is optional and validated (when present) client-side via `isSafeHttpUrl()` before
 * submit, and only ever rendered as a clickable link when that same guard passes — the backend's
 * own `safeHttpUrlSchema` already restricts it server-side, but this stays defense-in-depth,
 * matching every other stored-URL field in this app. `capturedAt` is an optional
 * `datetime-local` input, converted to a full ISO datetime string before submit (the backend
 * expects `z.string().datetime()`).
 */
export function ScanEvidenceSection({
  projectId,
  findingId,
  initialEvidence,
}: ScanEvidenceSectionProps): ReactNode {
  const [evidence, setEvidence] = useState(initialEvidence);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<EvidenceFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setEvidence(initialEvidence);
  }, [initialEvidence]);

  const basePath = `${getApiBaseUrl()}/scan-center/projects/${projectId}/findings/${findingId}/evidence`;

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const reference = values.reference.trim();
    if (reference !== "" && !isSafeHttpUrl(reference)) {
      setError("Reference must be a valid http:// or https:// URL.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: `EVD-${crypto.randomUUID()}`,
          evidenceType: values.evidenceType.trim() || null,
          reference: reference || null,
          notes: values.notes.trim() || null,
          capturedAt: values.capturedAt ? new Date(values.capturedAt).toISOString() : null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ScanEvidence>;
      setEvidence((current) => [...current, body.data]);
      setValues(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add scan evidence", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {evidence.length === 0 ? (
        <p className={styles.muted}>No evidence recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {evidence.map((item) => (
            <li key={item.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.primaryText}>
                  {item.evidenceType ?? "Evidence"}
                  {item.reference ? (
                    <>
                      {" — "}
                      {isSafeHttpUrl(item.reference) ? (
                        <a href={item.reference} target="_blank" rel="noopener noreferrer">
                          {item.reference}
                        </a>
                      ) : (
                        item.reference
                      )}
                    </>
                  ) : null}
                </span>
                {item.notes ? <span className={styles.secondaryText}>{item.notes}</span> : null}
                {item.capturedAt ? (
                  <span className={styles.secondaryText}>Captured {item.capturedAt}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add evidence</p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-evidence-type" className={styles.label}>
              Type
            </label>
            <input
              id="new-evidence-type"
              type="text"
              maxLength={EVIDENCE_TYPE_MAX_LENGTH}
              value={values.evidenceType}
              onChange={(event) => setValues((v) => ({ ...v, evidenceType: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-evidence-reference" className={styles.label}>
              Reference URL
            </label>
            <input
              id="new-evidence-reference"
              type="url"
              value={values.reference}
              onChange={(event) => setValues((v) => ({ ...v, reference: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-evidence-captured-at" className={styles.label}>
              Captured at
            </label>
            <input
              id="new-evidence-captured-at"
              type="datetime-local"
              value={values.capturedAt}
              onChange={(event) => setValues((v) => ({ ...v, capturedAt: event.target.value }))}
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="new-evidence-notes" className={styles.label}>
            Notes
          </label>
          <textarea
            id="new-evidence-notes"
            maxLength={NOTES_MAX_LENGTH}
            value={values.notes}
            onChange={(event) => setValues((v) => ({ ...v, notes: event.target.value }))}
            className={styles.textarea}
            rows={2}
          />
        </div>
        <div className={styles.formActions}>
          <button type="submit" className={styles.submitButton} disabled={adding}>
            {adding ? "Adding…" : "Add evidence"}
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
