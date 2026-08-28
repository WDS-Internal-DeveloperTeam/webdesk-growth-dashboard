"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type {
  ApiSuccessResponse,
  AssetRelatedRecord,
  ModuleRegistrySummary,
} from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { moduleDisplayName, sortModulesForPicker } from "@/lib/review-and-approval-center-query";
import { isUuid } from "@/lib/uuid";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./asset-related-records-section.module.css";

const NOTE_MAX_LENGTH = 500;

export interface AssetRelatedRecordsSectionProps {
  readonly assetId: string;
  readonly initialRecords: readonly AssetRelatedRecord[];
  /** Sourced from `getServerSession()`'s already-fetched `session.navigation` (`GET /me/navigation`,
   *  `SessionGuard`-only), not a dedicated `GET /authz/module-registry` fetch — held by every
   *  authenticated session regardless of role, the exact fix `ReviewForm`'s own code review already
   *  made once for the identical module-key-picker need (the original `GET /authz/module-registry`
   *  version is gated on `users_roles:view`, held by only 2 of 7 seeded roles). Can still be empty
   *  if the underlying navigation fetch itself failed — the empty-state warning below covers that
   *  case honestly, matching `ReviewForm`'s own precedent. */
  readonly modules: readonly ModuleRegistrySummary[];
}

interface AddFormValues {
  readonly moduleKey: string;
  readonly recordId: string;
  readonly note: string;
}

/**
 * `asset_related_records` editing — a real polymorphic sub-resource of one asset (D3), mirroring
 * `Review.targetModuleKey`/`targetId`'s own already-reviewed pattern and built with full add/edit/
 * delete CRUD from day one, matching `ClaimSourcesSection`'s/Projects' own sub-resource-editing
 * precedent. `recordId` is a plain, client-side UUID-format-checked text input, not a picker —
 * mirroring `ReviewForm`'s own `targetId` field: no generic cross-module record-lookup capability
 * exists anywhere in this app. `moduleKey` reuses that same form's own `modules` picker data.
 *
 * Only `note` is patchable via edit — `moduleKey`/`recordId` together ARE the relationship's
 * identity (`updateAssetRelatedRecordSchema`'s own contract); repointing either is a delete plus a
 * create, not an edit, so the edit form below offers only the note field.
 *
 * Delete goes through `POST .../:id/delete`, matching `ClaimSourcesSection`'s own convention rather
 * than mixing HTTP-verb semantics into this sub-resource's own routes. No `router.refresh()` after
 * a mutation here — matches `ClaimSourcesSection`'s own identical reasoning: no other section on
 * the detail page reads related-record data, so the optimistic local-state update already fully
 * reflects reality.
 */
export function AssetRelatedRecordsSection({
  assetId,
  initialRecords,
  modules,
}: AssetRelatedRecordsSectionProps): ReactNode {
  const [records, setRecords] = useState(initialRecords);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const sortedModules = sortModulesForPicker(modules);
  const [addValues, setAddValues] = useState<AddFormValues>({
    moduleKey: sortedModules[0]?.key ?? "",
    recordId: "",
    note: "",
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  function moduleLabel(moduleKey: string): string {
    const match = modules.find((module) => module.key === moduleKey);
    return match ? moduleDisplayName(match) : moduleKey;
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const recordId = addValues.recordId.trim();
    if (!addValues.moduleKey || !isUuid(recordId)) {
      setError("A target module and a valid record ID (UUID) are both required.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/asset-library/assets/${assetId}/related-records`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleKey: addValues.moduleKey,
            recordId,
            note: addValues.note.trim() || null,
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<AssetRelatedRecord>;
      setRecords((current) => [...current, body.data]);
      setAddValues({ moduleKey: sortedModules[0]?.key ?? "", recordId: "", note: "" });
    } catch (err) {
      console.error("Failed to link related record", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveNote(id: string, note: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/asset-library/assets/${assetId}/related-records/${id}/update`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim() || null }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<AssetRelatedRecord>;
      setRecords((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update related record note", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/asset-library/assets/${assetId}/related-records/${id}/delete`,
        { method: "POST", credentials: "include" },
      );
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setRecords((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to unlink related record", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {records.length === 0 ? (
        <p className={styles.muted}>No related records linked yet.</p>
      ) : (
        <ul className={styles.list}>
          {records.map((record) =>
            editingId === record.id ? (
              <li key={record.id} className={styles.row}>
                <NoteEditForm
                  record={record}
                  pending={pendingIds.has(record.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(note) => void handleSaveNote(record.id, note)}
                />
              </li>
            ) : (
              <li key={record.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>
                    {moduleLabel(record.moduleKey)} — {record.recordId}
                  </span>
                  <span className={styles.secondaryText}>{record.note ?? "No note"}</span>
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(record.id)}
                    onClick={() => setEditingId(record.id)}
                  >
                    Edit note
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(record.id)}
                    onClick={() => {
                      void handleDelete(record.id);
                    }}
                  >
                    {pendingIds.has(record.id) ? "…" : "Unlink"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Link a related record</p>
        {sortedModules.length === 0 ? (
          <p className={styles.muted}>
            The list of target modules couldn&apos;t be loaded, so this form can&apos;t be submitted
            right now. Try reloading the page.
          </p>
        ) : (
          <>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="related-record-module" className={styles.label}>
                  Module
                </label>
                <select
                  id="related-record-module"
                  required
                  value={addValues.moduleKey}
                  onChange={(event) =>
                    setAddValues((v) => ({ ...v, moduleKey: event.target.value }))
                  }
                  className={styles.select}
                >
                  {sortedModules.map((module) => (
                    <option key={module.key} value={module.key}>
                      {moduleDisplayName(module)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="related-record-id" className={styles.label}>
                  Record ID
                </label>
                <input
                  id="related-record-id"
                  type="text"
                  required
                  value={addValues.recordId}
                  onChange={(event) =>
                    setAddValues((v) => ({ ...v, recordId: event.target.value }))
                  }
                  className={styles.input}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="related-record-note" className={styles.label}>
                Note
              </label>
              <input
                id="related-record-note"
                type="text"
                maxLength={NOTE_MAX_LENGTH}
                value={addValues.note}
                onChange={(event) => setAddValues((v) => ({ ...v, note: event.target.value }))}
                className={styles.input}
              />
            </div>
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={adding || !addValues.moduleKey || !addValues.recordId.trim()}
              >
                {adding ? "Linking…" : "Link record"}
              </button>
            </div>
          </>
        )}
      </form>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface NoteEditFormProps {
  readonly record: AssetRelatedRecord;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (note: string) => void;
}

function NoteEditForm({ record, pending, onCancel, onSave }: NoteEditFormProps): ReactNode {
  const [note, setNote] = useState(record.note ?? "");

  // Resyncs to the latest stored note if this relationship is genuinely updated elsewhere while
  // this row stays open for editing — keyed on `updatedAt`, matching `ClaimSourcesSection`'s own
  // `SourceEditForm` identical reasoning.
  useEffect(() => {
    setNote(record.note ?? "");
  }, [record.id, record.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.field}>
        <label htmlFor={`edit-related-record-note-${record.id}`} className={styles.label}>
          Note
        </label>
        <input
          id={`edit-related-record-note-${record.id}`}
          type="text"
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={styles.input}
        />
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={pending}
          onClick={() => onSave(note)}
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
