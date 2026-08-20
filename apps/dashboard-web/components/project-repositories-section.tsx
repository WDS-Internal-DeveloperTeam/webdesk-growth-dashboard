"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, ProjectRepository } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./project-subresource-section.module.css";

export interface ProjectRepositoriesSectionProps {
  readonly projectId: string;
  readonly initialRepositories: readonly ProjectRepository[];
}

// Mirrors apps/dashboard-api/src/projects/projects.dto.ts's repoOwnerOrName/
// createProjectRepositorySchema/updateProjectRepositorySchema.
const SEGMENT_MAX_LENGTH = 255;
const SEGMENT_PATTERN = /^[\w.-]+$/;
const SEGMENT_HELP = "Letters, numbers, dots, hyphens, underscores only — no slashes or spaces.";
const NOTES_MAX_LENGTH = 10_000;
const DEFAULT_BRANCH_FALLBACK = "main";

interface RepositoryFormValues {
  readonly repoOwner: string;
  readonly repoName: string;
  readonly defaultBranch: string;
  readonly notes: string;
}

const EMPTY_FORM: RepositoryFormValues = {
  repoOwner: "",
  repoName: "",
  defaultBranch: DEFAULT_BRANCH_FALLBACK,
  notes: "",
};

function isValidSegment(value: string): boolean {
  return SEGMENT_PATTERN.test(value);
}

/**
 * Repositories editing (Projects module gap 4, `CLAUDE.md` "Active tasks" item 13) — create/edit/
 * delete via `POST`/`POST .../:id/update`/`DELETE /projects/:projectId/repositories`, all already
 * built and RBAC-gated on `project_configuration:edit`.
 *
 * Known, tracked, out-of-scope backend gap (flagged, not fixed, in this frontend-only branch):
 * `project-repositories.service.ts` has no handling for a duplicate `(project_id, repo_owner,
 * repo_name)` submission — a raw `SequelizeUniqueConstraintError` propagates uncaught, which
 * `parseApiErrorMessage()`'s allowlist then reduces to the generic "Something went wrong" message
 * rather than a clear "this repository is already linked" error. Fixing that means editing the
 * already-reviewed, already-merged Projects module backend, out of scope here.
 */
export function ProjectRepositoriesSection({
  projectId,
  initialRepositories,
}: ProjectRepositoriesSectionProps): ReactNode {
  const router = useRouter();
  const [repositories, setRepositories] = useState(initialRepositories);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [addValues, setAddValues] = useState<RepositoryFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setRepositories(initialRepositories);
  }, [initialRepositories]);

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

  const addIsValid =
    isValidSegment(addValues.repoOwner.trim()) && isValidSegment(addValues.repoName.trim());

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!addIsValid) {
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/repositories`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoOwner: addValues.repoOwner.trim(),
          repoName: addValues.repoName.trim(),
          defaultBranch: addValues.defaultBranch.trim() || DEFAULT_BRANCH_FALLBACK,
          notes: addValues.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectRepository>;
      setRepositories((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      console.error("Failed to add repository", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: RepositoryFormValues): Promise<void> {
    if (!isValidSegment(values.repoOwner.trim()) || !isValidSegment(values.repoName.trim())) {
      return;
    }
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/projects/${projectId}/repositories/${id}/update`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoOwner: values.repoOwner.trim(),
            repoName: values.repoName.trim(),
            defaultBranch: values.defaultBranch.trim() || DEFAULT_BRANCH_FALLBACK,
            notes: values.notes.trim() || null,
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectRepository>;
      setRepositories((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to update repository", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/repositories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setRepositories((current) => current.filter((item) => item.id !== id));
      router.refresh();
    } catch (err) {
      console.error("Failed to delete repository", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {repositories.length === 0 ? (
        <p className={styles.muted}>No repositories linked yet.</p>
      ) : (
        <ul className={styles.list}>
          {repositories.map((repository) =>
            editingId === repository.id ? (
              <li key={repository.id} className={styles.row}>
                <RepositoryEditForm
                  repository={repository}
                  pending={pendingIds.has(repository.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(repository.id, values)}
                />
              </li>
            ) : (
              <li key={repository.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <a
                    href={`https://github.com/${repository.repoOwner}/${repository.repoName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.primaryText}
                  >
                    {repository.repoOwner}/{repository.repoName}
                  </a>
                  <span className={styles.secondaryText}>
                    Default branch: {repository.defaultBranch}
                    {repository.notes ? ` · ${repository.notes}` : ""}
                  </span>
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(repository.id)}
                    onClick={() => setEditingId(repository.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(repository.id)}
                    onClick={() => {
                      void handleDelete(repository.id);
                    }}
                  >
                    {pendingIds.has(repository.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add repository</p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-repo-owner" className={styles.label}>
              Owner
            </label>
            <input
              id="new-repo-owner"
              type="text"
              required
              maxLength={SEGMENT_MAX_LENGTH}
              value={addValues.repoOwner}
              onChange={(event) => setAddValues((v) => ({ ...v, repoOwner: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-repo-name" className={styles.label}>
              Repository name
            </label>
            <input
              id="new-repo-name"
              type="text"
              required
              maxLength={SEGMENT_MAX_LENGTH}
              value={addValues.repoName}
              onChange={(event) => setAddValues((v) => ({ ...v, repoName: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-repo-branch" className={styles.label}>
              Default branch
            </label>
            <input
              id="new-repo-branch"
              type="text"
              maxLength={SEGMENT_MAX_LENGTH}
              value={addValues.defaultBranch}
              onChange={(event) =>
                setAddValues((v) => ({ ...v, defaultBranch: event.target.value }))
              }
              className={styles.input}
            />
          </div>
        </div>
        <p className={styles.helperText}>{SEGMENT_HELP}</p>
        <div className={styles.field}>
          <label htmlFor="new-repo-notes" className={styles.label}>
            Notes
          </label>
          <textarea
            id="new-repo-notes"
            rows={2}
            maxLength={NOTES_MAX_LENGTH}
            value={addValues.notes}
            onChange={(event) => setAddValues((v) => ({ ...v, notes: event.target.value }))}
            className={styles.textarea}
          />
        </div>
        <div className={styles.formActions}>
          <button type="submit" className={styles.submitButton} disabled={adding || !addIsValid}>
            {adding ? "Adding…" : "Add repository"}
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

interface RepositoryEditFormProps {
  readonly repository: ProjectRepository;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: RepositoryFormValues) => void;
}

function RepositoryEditForm({
  repository,
  pending,
  onCancel,
  onSave,
}: RepositoryEditFormProps): ReactNode {
  const [values, setValues] = useState<RepositoryFormValues>({
    repoOwner: repository.repoOwner,
    repoName: repository.repoName,
    defaultBranch: repository.defaultBranch,
    notes: repository.notes ?? "",
  });
  const isValid = isValidSegment(values.repoOwner.trim()) && isValidSegment(values.repoName.trim());

  return (
    <div className={styles.editForm}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor={`edit-repo-owner-${repository.id}`} className={styles.label}>
            Owner
          </label>
          <input
            id={`edit-repo-owner-${repository.id}`}
            type="text"
            required
            maxLength={SEGMENT_MAX_LENGTH}
            value={values.repoOwner}
            onChange={(event) => setValues((v) => ({ ...v, repoOwner: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`edit-repo-name-${repository.id}`} className={styles.label}>
            Repository name
          </label>
          <input
            id={`edit-repo-name-${repository.id}`}
            type="text"
            required
            maxLength={SEGMENT_MAX_LENGTH}
            value={values.repoName}
            onChange={(event) => setValues((v) => ({ ...v, repoName: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`edit-repo-branch-${repository.id}`} className={styles.label}>
            Default branch
          </label>
          <input
            id={`edit-repo-branch-${repository.id}`}
            type="text"
            maxLength={SEGMENT_MAX_LENGTH}
            value={values.defaultBranch}
            onChange={(event) => setValues((v) => ({ ...v, defaultBranch: event.target.value }))}
            className={styles.input}
          />
        </div>
      </div>
      <p className={styles.helperText}>{SEGMENT_HELP}</p>
      <div className={styles.field}>
        <label htmlFor={`edit-repo-notes-${repository.id}`} className={styles.label}>
          Notes
        </label>
        <textarea
          id={`edit-repo-notes-${repository.id}`}
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
          disabled={pending || !isValid}
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
