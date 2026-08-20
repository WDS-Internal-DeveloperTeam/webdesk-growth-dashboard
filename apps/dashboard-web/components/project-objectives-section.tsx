"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { StatusBadge } from "@webdesk/ui";
import type { ApiSuccessResponse, ProjectObjective } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { objectiveStatusBadge } from "@/lib/status-badges";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./project-subresource-section.module.css";

export interface ProjectObjectivesSectionProps {
  readonly projectId: string;
  readonly initialObjectives: readonly ProjectObjective[];
}

// Mirrors apps/dashboard-api/src/projects/projects.dto.ts's createObjectiveSchema/updateObjectiveSchema.
const DESCRIPTION_MAX_LENGTH = 10_000;

/**
 * Objectives editing (Projects module gap 4, `CLAUDE.md` "Active tasks" item 13) — create/edit/
 * delete via `POST`/`POST .../:id/update`/`DELETE /projects/:projectId/objectives`, all already
 * built, and RBAC-gated on `project_configuration:edit`. Unlike roadmap items, `status` forwards
 * straight through on update with no server-side stripping (see `roadmap-items.service.ts`'s own
 * comment for the contrasting case), so it's a real, working field here.
 *
 * No `router.refresh()` after a mutation here — unlike Roadmap's active-phase change, no other
 * section on the Project Detail page reads objective data, so the optimistic local-state update
 * already fully reflects reality; refreshing would only re-fetch the whole page for no visible
 * benefit (code-review finding, this branch).
 */
export function ProjectObjectivesSection({
  projectId,
  initialObjectives,
}: ProjectObjectivesSectionProps): ReactNode {
  const [objectives, setObjectives] = useState(initialObjectives);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [addDescription, setAddDescription] = useState("");
  const [adding, setAdding] = useState(false);

  // Resync from fresh initialObjectives props (e.g. after a sibling section's own
  // router.refresh()) — this component isn't remounted, so useState's initial value alone would
  // never see the updated list (same pattern as ProjectTeamSection).
  useEffect(() => {
    setObjectives(initialObjectives);
  }, [initialObjectives]);

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const description = addDescription.trim();
    if (!description) {
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/objectives`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectObjective>;
      setObjectives((current) => [...current, body.data]);
      setAddDescription("");
    } catch (err) {
      console.error("Failed to add objective", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(
    id: string,
    description: string,
    status: ProjectObjective["status"],
  ): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/projects/${projectId}/objectives/${id}/update`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: description.trim(), status }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectObjective>;
      setObjectives((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update objective", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/objectives/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setObjectives((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete objective", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {objectives.length === 0 ? (
        <p className={styles.muted}>No objectives yet.</p>
      ) : (
        <ul className={styles.list}>
          {objectives.map((objective) =>
            editingId === objective.id ? (
              <li key={objective.id} className={styles.row}>
                <ObjectiveEditForm
                  objective={objective}
                  pending={pendingIds.has(objective.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(description, status) =>
                    void handleSaveEdit(objective.id, description, status)
                  }
                />
              </li>
            ) : (
              <li key={objective.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>{objective.description}</span>
                </span>
                <span className={styles.rowActions}>
                  {(() => {
                    const badge = objectiveStatusBadge(objective.status);
                    return <StatusBadge status={badge.token} label={badge.label} />;
                  })()}
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(objective.id)}
                    onClick={() => setEditingId(objective.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(objective.id)}
                    onClick={() => {
                      void handleDelete(objective.id);
                    }}
                  >
                    {pendingIds.has(objective.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add objective</p>
        <div className={styles.field}>
          <label htmlFor="new-objective-description" className={styles.label}>
            Description
          </label>
          <textarea
            id="new-objective-description"
            rows={2}
            required
            maxLength={DESCRIPTION_MAX_LENGTH}
            value={addDescription}
            onChange={(event) => setAddDescription(event.target.value)}
            className={styles.textarea}
          />
        </div>
        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={adding || !addDescription.trim()}
          >
            {adding ? "Adding…" : "Add objective"}
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

interface ObjectiveEditFormProps {
  readonly objective: ProjectObjective;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (description: string, status: ProjectObjective["status"]) => void;
}

function ObjectiveEditForm({
  objective,
  pending,
  onCancel,
  onSave,
}: ObjectiveEditFormProps): ReactNode {
  const [description, setDescription] = useState(objective.description);
  const [status, setStatus] = useState(objective.status);

  // Resyncs to the latest stored values if this objective is genuinely updated elsewhere while
  // this row stays open for editing (another tab, another admin, or an unrelated mutation
  // elsewhere on the page triggering a background refresh) — keyed on `updatedAt`, not the whole
  // object, so it doesn't fire (and wipe an in-progress unsaved edit) on every incidental
  // re-fetch that leaves this specific record unchanged (code-review finding, this branch).
  useEffect(() => {
    setDescription(objective.description);
    setStatus(objective.status);
  }, [objective.id, objective.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.field}>
        <label htmlFor={`edit-objective-description-${objective.id}`} className={styles.label}>
          Description
        </label>
        <textarea
          id={`edit-objective-description-${objective.id}`}
          rows={2}
          required
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={styles.textarea}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`edit-objective-status-${objective.id}`} className={styles.label}>
          Status
        </label>
        <select
          id={`edit-objective-status-${objective.id}`}
          value={status}
          onChange={(event) => setStatus(event.target.value as ProjectObjective["status"])}
          className={styles.select}
        >
          <option value="open">Open</option>
          <option value="complete">Complete</option>
        </select>
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={pending || !description.trim()}
          onClick={() => onSave(description, status)}
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
