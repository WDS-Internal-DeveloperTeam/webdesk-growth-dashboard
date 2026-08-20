"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { StatusBadge, typographyTokens } from "@webdesk/ui";
import type { ApiSuccessResponse, ProjectDetail, RoadmapItem } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { roadmapItemStatusBadge } from "@/lib/status-badges";
import styles from "./project-subresource-section.module.css";

export interface ProjectRoadmapSectionProps {
  readonly projectId: string;
  readonly initialRoadmapItems: readonly RoadmapItem[];
  readonly initialActivePhaseId: string | null;
}

// Mirrors apps/dashboard-api/src/projects/projects.dto.ts's createRoadmapItemSchema/
// updateRoadmapItemSchema (name/sequence only — see the doc comment below on why `status` is
// deliberately omitted from this form).
const NAME_MAX_LENGTH = 255;

interface RoadmapItemFormValues {
  readonly name: string;
  readonly sequence: string;
}

const EMPTY_FORM: RoadmapItemFormValues = { name: "", sequence: "" };

/**
 * Roadmap editing (Projects module gap 4, `CLAUDE.md` "Active tasks" item 13) — create/edit/delete
 * via `POST`/`POST .../:id/update`/`DELETE /projects/:projectId/roadmap-items`, plus "Set as active
 * phase" via `POST /projects/:projectId/active-phase` (`{roadmapItemId}`), all already built and
 * RBAC-gated on `project_configuration:edit`. Previously unreachable from any `dashboard-web` UI.
 *
 * Deliberately omits `status` from both the add and edit forms, by explicit product decision: the
 * backend's `RoadmapItemsService.update()` silently strips any `status` sent through the generic
 * update route (only `setActivePhase()` is allowed to change it, to protect the
 * one-active-phase-per-project invariant) — so a status field on this form would silently no-op,
 * misleading whoever used it. Instead, "Set as active phase" (only shown for a non-active item) and
 * "Clear active phase" (shown once one is set) drive status the one real way the backend allows.
 * There is currently no way to reach `complete`/`skipped` from any code path — a known, accepted
 * gap recorded in `docs/implementation/dashboard-web-subresource-editing.md`, not fixed here.
 */
export function ProjectRoadmapSection({
  projectId,
  initialRoadmapItems,
  initialActivePhaseId,
}: ProjectRoadmapSectionProps): ReactNode {
  const router = useRouter();
  const [roadmapItems, setRoadmapItems] = useState(initialRoadmapItems);
  const [activePhaseId, setActivePhaseId] = useState(initialActivePhaseId);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [addValues, setAddValues] = useState<RoadmapItemFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [settingActive, setSettingActive] = useState(false);

  useEffect(() => {
    setRoadmapItems(initialRoadmapItems);
  }, [initialRoadmapItems]);

  useEffect(() => {
    setActivePhaseId(initialActivePhaseId);
  }, [initialActivePhaseId]);

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
      const sequence = addValues.sequence.trim();
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/roadmap-items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(sequence ? { sequence: Number(sequence) } : {}),
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<RoadmapItem>;
      setRoadmapItems((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      console.error("Failed to add roadmap item", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: RoadmapItemFormValues): Promise<void> {
    const name = values.name.trim();
    if (!name) {
      return;
    }
    setError(null);
    markPending(id, true);
    try {
      const sequence = values.sequence.trim();
      const response = await fetch(
        `${getApiBaseUrl()}/projects/${projectId}/roadmap-items/${id}/update`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            ...(sequence ? { sequence: Number(sequence) } : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<RoadmapItem>;
      setRoadmapItems((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to update roadmap item", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/roadmap-items/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setRoadmapItems((current) => current.filter((item) => item.id !== id));
      router.refresh();
    } catch (err) {
      console.error("Failed to delete roadmap item", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleSetActivePhase(roadmapItemId: string | null): Promise<void> {
    setError(null);
    setSettingActive(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/active-phase`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapItemId }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectDetail>;
      setActivePhaseId(body.data.activePhaseId);
      router.refresh();
    } catch (err) {
      console.error("Failed to set active phase", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSettingActive(false);
    }
  }

  return (
    <div>
      {activePhaseId ? (
        <div className={styles.sectionToolbar}>
          <p className={styles.muted}>
            Active phase: {roadmapItems.find((item) => item.id === activePhaseId)?.name ?? "—"}
          </p>
          <button
            type="button"
            className={styles.linkButton}
            disabled={settingActive}
            onClick={() => void handleSetActivePhase(null)}
          >
            Clear active phase
          </button>
        </div>
      ) : null}

      {roadmapItems.length === 0 ? (
        <p className={styles.muted}>No roadmap items yet.</p>
      ) : (
        <ol className={styles.list}>
          {roadmapItems.map((item) => {
            const isActive = item.id === activePhaseId;
            const itemBadge = roadmapItemStatusBadge(item.status);
            return editingId === item.id ? (
              <li key={item.id} className={styles.row}>
                <RoadmapItemEditForm
                  item={item}
                  pending={pendingIds.has(item.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(item.id, values)}
                />
              </li>
            ) : (
              <li key={item.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>
                    <span style={sequenceStyle}>{item.sequence}</span> {item.name}
                  </span>
                </span>
                <span className={styles.rowActions}>
                  <StatusBadge status={itemBadge.token} label={itemBadge.label} />
                  {isActive ? (
                    <span className={styles.secondaryText}>Active</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.actionButton}
                      disabled={settingActive}
                      onClick={() => void handleSetActivePhase(item.id)}
                    >
                      Set active
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(item.id)}
                    onClick={() => setEditingId(item.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(item.id) || isActive}
                    title={
                      isActive ? "Clear the active phase before deleting this item" : undefined
                    }
                    onClick={() => {
                      void handleDelete(item.id);
                    }}
                  >
                    {pendingIds.has(item.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add roadmap item</p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-roadmap-name" className={styles.label}>
              Name
            </label>
            <input
              id="new-roadmap-name"
              type="text"
              required
              maxLength={NAME_MAX_LENGTH}
              value={addValues.name}
              onChange={(event) => setAddValues((v) => ({ ...v, name: event.target.value }))}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-roadmap-sequence" className={styles.label}>
              Sequence
            </label>
            <input
              id="new-roadmap-sequence"
              type="number"
              min={0}
              value={addValues.sequence}
              onChange={(event) => setAddValues((v) => ({ ...v, sequence: event.target.value }))}
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={adding || !addValues.name.trim()}
          >
            {adding ? "Adding…" : "Add roadmap item"}
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

interface RoadmapItemEditFormProps {
  readonly item: RoadmapItem;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: RoadmapItemFormValues) => void;
}

function RoadmapItemEditForm({
  item,
  pending,
  onCancel,
  onSave,
}: RoadmapItemEditFormProps): ReactNode {
  const [values, setValues] = useState<RoadmapItemFormValues>({
    name: item.name,
    sequence: String(item.sequence),
  });

  return (
    <div className={styles.editForm}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor={`edit-roadmap-name-${item.id}`} className={styles.label}>
            Name
          </label>
          <input
            id={`edit-roadmap-name-${item.id}`}
            type="text"
            required
            maxLength={NAME_MAX_LENGTH}
            value={values.name}
            onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`edit-roadmap-sequence-${item.id}`} className={styles.label}>
            Sequence
          </label>
          <input
            id={`edit-roadmap-sequence-${item.id}`}
            type="number"
            min={0}
            value={values.sequence}
            onChange={(event) => setValues((v) => ({ ...v, sequence: event.target.value }))}
            className={styles.input}
          />
        </div>
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

const sequenceStyle = {
  fontFamily: typographyTokens.fontFamilyMono,
  color: "var(--webdesk-dashboard-color-foreground-subtle)",
} as const;
