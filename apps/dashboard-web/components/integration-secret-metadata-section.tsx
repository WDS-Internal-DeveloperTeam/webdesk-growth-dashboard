"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, SecretMetadata } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/datetime-local";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./integration-subresource-section.module.css";

export interface IntegrationSecretMetadataSectionProps {
  readonly integrationId: string;
  readonly initialSecretMetadata: readonly SecretMetadata[];
}

// Mirrors apps/dashboard-api/src/integrations/integrations.dto.ts's
// createSecretMetadataSchema/updateSecretMetadataSchema.
const SECRET_NAME_MAX_LENGTH = 255;
const STORAGE_LOCATION_MAX_LENGTH = 2000;
const NOTES_MAX_LENGTH = 10_000;

interface SecretMetadataFormValues {
  readonly secretName: string;
  readonly storageLocation: string;
  readonly lastRotatedAt: string;
  readonly rotationDueAt: string;
  readonly notes: string;
}

const EMPTY_FORM: SecretMetadataFormValues = {
  secretName: "",
  storageLocation: "",
  lastRotatedAt: "",
  rotationDueAt: "",
  notes: "",
};

/**
 * Real one-to-many sub-resource editing — create/list/update/delete via
 * `POST`/`POST .../:secretId/update`/`DELETE /integrations/:integrationId/secret-metadata...`,
 * mirroring `IntegrationEnvironmentsSection`'s/`ProjectEnvironmentsSection`'s own established CRUD
 * pattern exactly. **Never renders or accepts a secret value** — the backend's own
 * `SecretMetadataEntity` has no such field at all (D-schema,
 * `docs/implementation/module-integrations.md`): only `secretName`/`storageLocation`/rotation
 * timestamps/`notes` are ever tracked, per the module registry's own seeded confidentiality note
 * ("secret values never stored — metadata/verification status only").
 *
 * `lastRotatedAt`/`rotationDueAt` are `datetime-local` inputs, converted to/from a full ISO
 * datetime string via the shared `lib/datetime-local.ts` helpers (the backend expects
 * `z.string().datetime()`, not a bare date).
 *
 * No `router.refresh()` after a mutation here — no other section on the Integration Detail page
 * reads secret-metadata data, matching `IntegrationEnvironmentsSection`'s own identical reasoning.
 */
export function IntegrationSecretMetadataSection({
  integrationId,
  initialSecretMetadata,
}: IntegrationSecretMetadataSectionProps): ReactNode {
  const [secrets, setSecrets] = useState(initialSecretMetadata);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [addValues, setAddValues] = useState<SecretMetadataFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSecrets(initialSecretMetadata);
  }, [initialSecretMetadata]);

  const basePath = `${getApiBaseUrl()}/integrations/${integrationId}/secret-metadata`;

  function toBody(values: SecretMetadataFormValues): Record<string, unknown> {
    return {
      secretName: values.secretName.trim(),
      storageLocation: values.storageLocation.trim(),
      lastRotatedAt: fromDateTimeLocalValue(values.lastRotatedAt),
      rotationDueAt: fromDateTimeLocalValue(values.rotationDueAt),
      notes: values.notes.trim() || null,
    };
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const secretName = addValues.secretName.trim();
    const storageLocation = addValues.storageLocation.trim();
    if (!secretName || !storageLocation) {
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(addValues)),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<SecretMetadata>;
      setSecrets((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add secret metadata", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: SecretMetadataFormValues): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}/update`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(values)),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<SecretMetadata>;
      setSecrets((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update secret metadata", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setSecrets((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete secret metadata", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {secrets.length === 0 ? (
        <p className={styles.muted}>No secrets recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {secrets.map((secret) =>
            editingId === secret.id ? (
              <li key={secret.id} className={styles.row}>
                <SecretMetadataEditForm
                  secret={secret}
                  pending={pendingIds.has(secret.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(secret.id, values)}
                />
              </li>
            ) : (
              <li key={secret.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>{secret.secretName}</span>
                  <span className={styles.secondaryText}>{secret.storageLocation}</span>
                  <span className={styles.secondaryText}>
                    Last rotated: {secret.lastRotatedAt ? secret.lastRotatedAt : "Never"} · Due:{" "}
                    {secret.rotationDueAt ? secret.rotationDueAt : "Not set"}
                  </span>
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(secret.id)}
                    onClick={() => setEditingId(secret.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(secret.id)}
                    onClick={() => {
                      void handleDelete(secret.id);
                    }}
                  >
                    {pendingIds.has(secret.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add secret</p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-secret-name" className={styles.label}>
              Secret name
            </label>
            <input
              id="new-secret-name"
              type="text"
              required
              maxLength={SECRET_NAME_MAX_LENGTH}
              value={addValues.secretName}
              onChange={(event) => setAddValues((v) => ({ ...v, secretName: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-secret-storage-location" className={styles.label}>
              Storage location
            </label>
            <input
              id="new-secret-storage-location"
              type="text"
              required
              maxLength={STORAGE_LOCATION_MAX_LENGTH}
              value={addValues.storageLocation}
              onChange={(event) =>
                setAddValues((v) => ({ ...v, storageLocation: event.target.value }))
              }
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-secret-last-rotated-at" className={styles.label}>
              Last rotated
            </label>
            <input
              id="new-secret-last-rotated-at"
              type="datetime-local"
              value={addValues.lastRotatedAt}
              onChange={(event) =>
                setAddValues((v) => ({ ...v, lastRotatedAt: event.target.value }))
              }
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-secret-rotation-due-at" className={styles.label}>
              Rotation due
            </label>
            <input
              id="new-secret-rotation-due-at"
              type="datetime-local"
              value={addValues.rotationDueAt}
              onChange={(event) =>
                setAddValues((v) => ({ ...v, rotationDueAt: event.target.value }))
              }
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="new-secret-notes" className={styles.label}>
            Notes
          </label>
          <textarea
            id="new-secret-notes"
            rows={2}
            maxLength={NOTES_MAX_LENGTH}
            value={addValues.notes}
            onChange={(event) => setAddValues((v) => ({ ...v, notes: event.target.value }))}
            className={styles.textarea}
          />
        </div>
        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={adding || !addValues.secretName.trim() || !addValues.storageLocation.trim()}
          >
            {adding ? "Adding…" : "Add secret"}
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

interface SecretMetadataEditFormProps {
  readonly secret: SecretMetadata;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: SecretMetadataFormValues) => void;
}

function SecretMetadataEditForm({
  secret,
  pending,
  onCancel,
  onSave,
}: SecretMetadataEditFormProps): ReactNode {
  const [values, setValues] = useState<SecretMetadataFormValues>({
    secretName: secret.secretName,
    storageLocation: secret.storageLocation,
    lastRotatedAt: toDateTimeLocalValue(secret.lastRotatedAt),
    rotationDueAt: toDateTimeLocalValue(secret.rotationDueAt),
    notes: secret.notes ?? "",
  });

  // Resyncs to the latest stored values if this record is genuinely updated elsewhere while this
  // row stays open for editing — keyed on `updatedAt`, matching
  // `IntegrationEnvironmentsSection`'s own identical reasoning.
  useEffect(() => {
    setValues({
      secretName: secret.secretName,
      storageLocation: secret.storageLocation,
      lastRotatedAt: toDateTimeLocalValue(secret.lastRotatedAt),
      rotationDueAt: toDateTimeLocalValue(secret.rotationDueAt),
      notes: secret.notes ?? "",
    });
  }, [secret.id, secret.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor={`edit-secret-name-${secret.id}`} className={styles.label}>
            Secret name
          </label>
          <input
            id={`edit-secret-name-${secret.id}`}
            type="text"
            required
            maxLength={SECRET_NAME_MAX_LENGTH}
            value={values.secretName}
            onChange={(event) => setValues((v) => ({ ...v, secretName: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`edit-secret-storage-location-${secret.id}`} className={styles.label}>
            Storage location
          </label>
          <input
            id={`edit-secret-storage-location-${secret.id}`}
            type="text"
            required
            maxLength={STORAGE_LOCATION_MAX_LENGTH}
            value={values.storageLocation}
            onChange={(event) => setValues((v) => ({ ...v, storageLocation: event.target.value }))}
            className={styles.input}
          />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor={`edit-secret-last-rotated-at-${secret.id}`} className={styles.label}>
            Last rotated
          </label>
          <input
            id={`edit-secret-last-rotated-at-${secret.id}`}
            type="datetime-local"
            value={values.lastRotatedAt}
            onChange={(event) => setValues((v) => ({ ...v, lastRotatedAt: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`edit-secret-rotation-due-at-${secret.id}`} className={styles.label}>
            Rotation due
          </label>
          <input
            id={`edit-secret-rotation-due-at-${secret.id}`}
            type="datetime-local"
            value={values.rotationDueAt}
            onChange={(event) => setValues((v) => ({ ...v, rotationDueAt: event.target.value }))}
            className={styles.input}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor={`edit-secret-notes-${secret.id}`} className={styles.label}>
          Notes
        </label>
        <textarea
          id={`edit-secret-notes-${secret.id}`}
          rows={2}
          maxLength={NOTES_MAX_LENGTH}
          value={values.notes}
          onChange={(event) => setValues((v) => ({ ...v, notes: event.target.value }))}
          className={styles.textarea}
        />
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={pending || !values.secretName.trim() || !values.storageLocation.trim()}
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
