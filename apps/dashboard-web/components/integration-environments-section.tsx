"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type {
  ApiSuccessResponse,
  IntegrationEnvironment,
  IntegrationStatus,
} from "@webdesk/shared-types";
import { StatusBadge } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { integrationStatusBadge, STATUS_LABEL, STATUS_VALUES } from "@/lib/integrations-query";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./integration-subresource-section.module.css";

export interface IntegrationEnvironmentsSectionProps {
  readonly integrationId: string;
  readonly initialEnvironments: readonly IntegrationEnvironment[];
}

// Mirrors apps/dashboard-api/src/integrations/integrations.dto.ts's
// createIntegrationEnvironmentSchema/updateIntegrationEnvironmentSchema.
const ENVIRONMENT_NAME_MAX_LENGTH = 255;
const CONFIG_REFERENCE_MAX_LENGTH = 2000;
const NOTES_MAX_LENGTH = 10_000;

interface EnvironmentFormValues {
  readonly environmentName: string;
  readonly status: IntegrationStatus | "";
  readonly configReference: string;
  readonly notes: string;
}

const EMPTY_FORM: EnvironmentFormValues = {
  environmentName: "",
  status: "",
  configReference: "",
  notes: "",
};

/**
 * Real one-to-many sub-resource editing — create/list/update/delete via
 * `POST`/`POST .../:environmentId/update`/`DELETE /integrations/:integrationId/environments...`,
 * mirroring `ProjectEnvironmentsSection`'s own established CRUD pattern exactly. `integrationId` is
 * carried exclusively via the URL path segment (never a body field), matching the backend's own
 * `createIntegrationEnvironmentSchema`/`updateIntegrationEnvironmentSchema` contract.
 *
 * No `router.refresh()` after a mutation here — no other section on the Integration Detail page
 * reads environment data, so the optimistic local-state update already fully reflects reality,
 * matching `ProjectEnvironmentsSection`'s own identical reasoning.
 */
export function IntegrationEnvironmentsSection({
  integrationId,
  initialEnvironments,
}: IntegrationEnvironmentsSectionProps): ReactNode {
  const [environments, setEnvironments] = useState(initialEnvironments);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [addValues, setAddValues] = useState<EnvironmentFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setEnvironments(initialEnvironments);
  }, [initialEnvironments]);

  const basePath = `${getApiBaseUrl()}/integrations/${integrationId}/environments`;

  function toBody(values: EnvironmentFormValues): Record<string, unknown> {
    return {
      environmentName: values.environmentName.trim(),
      status: values.status || null,
      configReference: values.configReference.trim() || null,
      notes: values.notes.trim() || null,
    };
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const environmentName = addValues.environmentName.trim();
    if (!environmentName) {
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
      const body = (await response.json()) as ApiSuccessResponse<IntegrationEnvironment>;
      setEnvironments((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add integration environment", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: EnvironmentFormValues): Promise<void> {
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
      const body = (await response.json()) as ApiSuccessResponse<IntegrationEnvironment>;
      setEnvironments((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update integration environment", err);
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
      setEnvironments((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete integration environment", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {environments.length === 0 ? (
        <p className={styles.muted}>No environments recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {environments.map((environment) =>
            editingId === environment.id ? (
              <li key={environment.id} className={styles.row}>
                <EnvironmentEditForm
                  environment={environment}
                  pending={pendingIds.has(environment.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(environment.id, values)}
                />
              </li>
            ) : (
              <li key={environment.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>{environment.environmentName}</span>
                  <span className={styles.secondaryText}>
                    <StatusBadge
                      status={integrationStatusBadge(environment.status).token}
                      label={integrationStatusBadge(environment.status).label}
                    />
                  </span>
                  {environment.configReference ? (
                    <span className={styles.secondaryText}>{environment.configReference}</span>
                  ) : null}
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(environment.id)}
                    onClick={() => setEditingId(environment.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(environment.id)}
                    onClick={() => {
                      void handleDelete(environment.id);
                    }}
                  >
                    {pendingIds.has(environment.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add environment</p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-integration-environment-name" className={styles.label}>
              Environment name
            </label>
            <input
              id="new-integration-environment-name"
              type="text"
              required
              maxLength={ENVIRONMENT_NAME_MAX_LENGTH}
              value={addValues.environmentName}
              onChange={(event) =>
                setAddValues((v) => ({ ...v, environmentName: event.target.value }))
              }
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-integration-environment-status" className={styles.label}>
              Status
            </label>
            <select
              id="new-integration-environment-status"
              value={addValues.status}
              onChange={(event) =>
                setAddValues((v) => ({ ...v, status: event.target.value as IntegrationStatus }))
              }
              className={styles.select}
            >
              <option value="">Unset</option>
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="new-integration-environment-config-reference" className={styles.label}>
            Config reference
          </label>
          <input
            id="new-integration-environment-config-reference"
            type="text"
            maxLength={CONFIG_REFERENCE_MAX_LENGTH}
            value={addValues.configReference}
            onChange={(event) =>
              setAddValues((v) => ({ ...v, configReference: event.target.value }))
            }
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="new-integration-environment-notes" className={styles.label}>
            Notes
          </label>
          <textarea
            id="new-integration-environment-notes"
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
            disabled={adding || !addValues.environmentName.trim()}
          >
            {adding ? "Adding…" : "Add environment"}
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

interface EnvironmentEditFormProps {
  readonly environment: IntegrationEnvironment;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: EnvironmentFormValues) => void;
}

function EnvironmentEditForm({
  environment,
  pending,
  onCancel,
  onSave,
}: EnvironmentEditFormProps): ReactNode {
  const [values, setValues] = useState<EnvironmentFormValues>({
    environmentName: environment.environmentName,
    status: environment.status,
    configReference: environment.configReference ?? "",
    notes: environment.notes ?? "",
  });

  // Resyncs to the latest stored values if this environment is genuinely updated elsewhere while
  // this row stays open for editing — keyed on `updatedAt`, not the whole object, so it doesn't
  // fire (and wipe an in-progress unsaved edit) on every incidental re-fetch that leaves this
  // specific record unchanged, matching `ProjectEnvironmentsSection`'s own identical reasoning.
  useEffect(() => {
    setValues({
      environmentName: environment.environmentName,
      status: environment.status,
      configReference: environment.configReference ?? "",
      notes: environment.notes ?? "",
    });
  }, [environment.id, environment.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label
            htmlFor={`edit-integration-environment-name-${environment.id}`}
            className={styles.label}
          >
            Environment name
          </label>
          <input
            id={`edit-integration-environment-name-${environment.id}`}
            type="text"
            required
            maxLength={ENVIRONMENT_NAME_MAX_LENGTH}
            value={values.environmentName}
            onChange={(event) => setValues((v) => ({ ...v, environmentName: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label
            htmlFor={`edit-integration-environment-status-${environment.id}`}
            className={styles.label}
          >
            Status
          </label>
          <select
            id={`edit-integration-environment-status-${environment.id}`}
            value={values.status}
            onChange={(event) =>
              setValues((v) => ({ ...v, status: event.target.value as IntegrationStatus }))
            }
            className={styles.select}
          >
            <option value="">Unset</option>
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.field}>
        <label
          htmlFor={`edit-integration-environment-config-reference-${environment.id}`}
          className={styles.label}
        >
          Config reference
        </label>
        <input
          id={`edit-integration-environment-config-reference-${environment.id}`}
          type="text"
          maxLength={CONFIG_REFERENCE_MAX_LENGTH}
          value={values.configReference}
          onChange={(event) => setValues((v) => ({ ...v, configReference: event.target.value }))}
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label
          htmlFor={`edit-integration-environment-notes-${environment.id}`}
          className={styles.label}
        >
          Notes
        </label>
        <textarea
          id={`edit-integration-environment-notes-${environment.id}`}
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
          disabled={pending || !values.environmentName.trim()}
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
