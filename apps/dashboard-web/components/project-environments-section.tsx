"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, ProjectEnvironment } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import styles from "./project-subresource-section.module.css";

export interface ProjectEnvironmentsSectionProps {
  readonly projectId: string;
  readonly initialEnvironments: readonly ProjectEnvironment[];
}

// Mirrors apps/dashboard-api/src/projects/projects.dto.ts's createEnvironmentSchema/updateEnvironmentSchema.
const NAME_MAX_LENGTH = 64;
const NOTES_MAX_LENGTH = 10_000;

interface EnvironmentFormValues {
  readonly name: string;
  readonly url: string;
  readonly notes: string;
}

const EMPTY_FORM: EnvironmentFormValues = { name: "", url: "", notes: "" };

/**
 * Environments editing (Projects module gap 4, `CLAUDE.md` "Active tasks" item 13) — create/edit/
 * delete via `POST`/`POST .../:id/update`/`DELETE /projects/:projectId/environments`, all already
 * built and RBAC-gated on `project_configuration:edit`. The backend's `safeHttpUrlSchema`
 * (`packages/validation`) restricts `url` to `http:`/`https:` server-side — `isSafeHttpUrl()` is
 * still applied client-side before ever rendering a stored value as a link (matches the read-only
 * detail page's own existing guard), since this form doesn't change what's already stored for
 * environments created before that schema existed.
 */
export function ProjectEnvironmentsSection({
  projectId,
  initialEnvironments,
}: ProjectEnvironmentsSectionProps): ReactNode {
  const router = useRouter();
  const [environments, setEnvironments] = useState(initialEnvironments);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [addValues, setAddValues] = useState<EnvironmentFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setEnvironments(initialEnvironments);
  }, [initialEnvironments]);

  function markPending(id: string, pending: boolean): void {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = addValues.name.trim();
    if (!name) {
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/environments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url: addValues.url.trim() || null,
          notes: addValues.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectEnvironment>;
      setEnvironments((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      console.error("Failed to add environment", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: EnvironmentFormValues): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/projects/${projectId}/environments/${id}/update`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            url: values.url.trim() || null,
            notes: values.notes.trim() || null,
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectEnvironment>;
      setEnvironments((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to update environment", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/environments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setEnvironments((current) => current.filter((item) => item.id !== id));
      router.refresh();
    } catch (err) {
      console.error("Failed to delete environment", err);
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
                  <span className={styles.primaryText}>{environment.name}</span>
                  {environment.url ? (
                    isSafeHttpUrl(environment.url) ? (
                      <a
                        href={environment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.secondaryText}
                      >
                        {environment.url}
                      </a>
                    ) : (
                      <span className={styles.secondaryText}>{environment.url}</span>
                    )
                  ) : (
                    <span className={styles.secondaryText}>No URL set</span>
                  )}
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
            <label htmlFor="new-environment-name" className={styles.label}>
              Name
            </label>
            <input
              id="new-environment-name"
              type="text"
              required
              maxLength={NAME_MAX_LENGTH}
              value={addValues.name}
              onChange={(event) => setAddValues((v) => ({ ...v, name: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-environment-url" className={styles.label}>
              URL
            </label>
            <input
              id="new-environment-url"
              type="url"
              value={addValues.url}
              onChange={(event) => setAddValues((v) => ({ ...v, url: event.target.value }))}
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="new-environment-notes" className={styles.label}>
            Notes
          </label>
          <textarea
            id="new-environment-notes"
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
            disabled={adding || !addValues.name.trim()}
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
  readonly environment: ProjectEnvironment;
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
    name: environment.name,
    url: environment.url ?? "",
    notes: environment.notes ?? "",
  });

  return (
    <div className={styles.editForm}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor={`edit-environment-name-${environment.id}`} className={styles.label}>
            Name
          </label>
          <input
            id={`edit-environment-name-${environment.id}`}
            type="text"
            required
            maxLength={NAME_MAX_LENGTH}
            value={values.name}
            onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`edit-environment-url-${environment.id}`} className={styles.label}>
            URL
          </label>
          <input
            id={`edit-environment-url-${environment.id}`}
            type="url"
            value={values.url}
            onChange={(event) => setValues((v) => ({ ...v, url: event.target.value }))}
            className={styles.input}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor={`edit-environment-notes-${environment.id}`} className={styles.label}>
          Notes
        </label>
        <textarea
          id={`edit-environment-notes-${environment.id}`}
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
          disabled={pending || !values.name.trim()}
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
