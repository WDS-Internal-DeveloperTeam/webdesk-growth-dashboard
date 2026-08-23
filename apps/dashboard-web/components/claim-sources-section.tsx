"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, ClaimSource } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./claim-sources-section.module.css";

export interface ClaimSourcesSectionProps {
  readonly claimId: string;
  readonly initialSources: readonly ClaimSource[];
}

// Mirrors apps/dashboard-api/src/proof-and-claims-library/proof-and-claims-library.dto.ts's
// createClaimSourceSchema/updateClaimSourceSchema's own dedicated CLAIM_SOURCE_MAX_LENGTH
// constant — a real, independent bound for this field (not borrowed from the parent's
// rich-text-sized LONG_TEXT_MAX_LENGTH, a prior accidental coupling this constant's own doc
// comment on the backend explains — code-review finding).
const SOURCE_MAX_LENGTH = 2_000;

interface SourceFormValues {
  readonly source: string;
  readonly sourceUrl: string;
}

const EMPTY_FORM: SourceFormValues = { source: "", sourceUrl: "" };

/**
 * `claim_sources` editing — a real one-to-many child of `proof_claims`
 * (`04_Data_Model_and_Ownership.md:119-120`), built correctly with full add/edit/delete CRUD from
 * day one (matching Projects' own sub-resource-editing precedent,
 * `dashboard-web-subresource-editing`) rather than starting read-only. `source` stays a plain
 * `<textarea>`, not `RichTextEditor` — surfaced explicitly during code review as a candidate
 * violation of the 2026-08-22 standing rich-text rule ("every long-text field... never a plain
 * textarea"), since that rule's own text names no sub-resource carve-out. Resolved by giving
 * `source` its own dedicated, deliberately short `CLAIM_SOURCE_MAX_LENGTH` (2,000 chars — see the
 * backend DTO's own doc comment) instead of the module's rich-text-sized `LONG_TEXT_MAX_LENGTH` it
 * had accidentally inherited: `source` is a short citation/reference description, not authored
 * narrative content, so it isn't the kind of "long-text field" the standing rule targets — the same
 * reasoning Projects' own rich-text rollout already applied when its Objectives/Repositories/
 * Environments sub-resource fields stayed plain alongside `description`'s own conversion. The
 * backend's own `safeHttpUrlSchema` (`packages/validation`) restricts `sourceUrl` to
 * `http:`/`https:` server-side — `isSafeHttpUrl()` is still applied client-side before ever
 * rendering a stored value as a link, matching `ProjectEnvironmentsSection`'s own identical guard,
 * as defense-in-depth for a value stored before that schema existed.
 *
 * Delete goes through `POST .../:id/delete` (not the `DELETE` HTTP method
 * `ProjectEnvironmentsSection` uses) — `ClaimSourcesController.remove()` is a `@Post(":id/delete")`
 * route, matching the module's own established `POST .../:id/update` convention for every other
 * mutation rather than mixing HTTP-verb semantics into this sub-resource's own routes.
 *
 * No `router.refresh()` after a mutation here — matches `ProjectEnvironmentsSection`'s own
 * identical reasoning: no other section on the detail page reads source data, so the optimistic
 * local-state update already fully reflects reality.
 */
export function ClaimSourcesSection({
  claimId,
  initialSources,
}: ClaimSourcesSectionProps): ReactNode {
  const [sources, setSources] = useState(initialSources);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [addValues, setAddValues] = useState<SourceFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSources(initialSources);
  }, [initialSources]);

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const source = addValues.source.trim();
    if (!source) {
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/proof-and-claims-library/claims/${claimId}/sources`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source,
            sourceUrl: addValues.sourceUrl.trim() || null,
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ClaimSource>;
      setSources((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add claim source", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: SourceFormValues): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/proof-and-claims-library/claims/${claimId}/sources/${id}/update`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: values.source.trim(),
            sourceUrl: values.sourceUrl.trim() || null,
          }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ClaimSource>;
      setSources((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update claim source", err);
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
        `${getApiBaseUrl()}/proof-and-claims-library/claims/${claimId}/sources/${id}/delete`,
        { method: "POST", credentials: "include" },
      );
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setSources((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete claim source", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {sources.length === 0 ? (
        <p className={styles.muted}>No sources recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {sources.map((source) =>
            editingId === source.id ? (
              <li key={source.id} className={styles.row}>
                <SourceEditForm
                  source={source}
                  pending={pendingIds.has(source.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(source.id, values)}
                />
              </li>
            ) : (
              <li key={source.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>{source.source}</span>
                  {source.sourceUrl ? (
                    isSafeHttpUrl(source.sourceUrl) ? (
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.secondaryText}
                      >
                        {source.sourceUrl}
                      </a>
                    ) : (
                      <span className={styles.secondaryText}>{source.sourceUrl}</span>
                    )
                  ) : (
                    <span className={styles.secondaryText}>No URL set</span>
                  )}
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(source.id)}
                    onClick={() => setEditingId(source.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(source.id)}
                    onClick={() => {
                      void handleDelete(source.id);
                    }}
                  >
                    {pendingIds.has(source.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add source</p>
        <div className={styles.field}>
          <label htmlFor="new-source-source" className={styles.label}>
            Source
          </label>
          <textarea
            id="new-source-source"
            required
            rows={2}
            maxLength={SOURCE_MAX_LENGTH}
            value={addValues.source}
            onChange={(event) => setAddValues((v) => ({ ...v, source: event.target.value }))}
            className={styles.textarea}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="new-source-url" className={styles.label}>
            Source URL
          </label>
          <input
            id="new-source-url"
            type="url"
            value={addValues.sourceUrl}
            onChange={(event) => setAddValues((v) => ({ ...v, sourceUrl: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={adding || !addValues.source.trim()}
          >
            {adding ? "Adding…" : "Add source"}
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

interface SourceEditFormProps {
  readonly source: ClaimSource;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: SourceFormValues) => void;
}

function SourceEditForm({ source, pending, onCancel, onSave }: SourceEditFormProps): ReactNode {
  const [values, setValues] = useState<SourceFormValues>({
    source: source.source,
    sourceUrl: source.sourceUrl ?? "",
  });

  // Resyncs to the latest stored values if this source is genuinely updated elsewhere while this
  // row stays open for editing — keyed on `updatedAt`, not the whole object, matching
  // `ProjectEnvironmentsSection`'s own `EnvironmentEditForm` identical reasoning: it doesn't fire
  // (and wipe an in-progress unsaved edit) on every incidental re-fetch that leaves this specific
  // record unchanged.
  useEffect(() => {
    setValues({
      source: source.source,
      sourceUrl: source.sourceUrl ?? "",
    });
  }, [source.id, source.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.field}>
        <label htmlFor={`edit-source-source-${source.id}`} className={styles.label}>
          Source
        </label>
        <textarea
          id={`edit-source-source-${source.id}`}
          required
          rows={2}
          maxLength={SOURCE_MAX_LENGTH}
          value={values.source}
          onChange={(event) => setValues((v) => ({ ...v, source: event.target.value }))}
          className={styles.textarea}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`edit-source-url-${source.id}`} className={styles.label}>
          Source URL
        </label>
        <input
          id={`edit-source-url-${source.id}`}
          type="url"
          value={values.sourceUrl}
          onChange={(event) => setValues((v) => ({ ...v, sourceUrl: event.target.value }))}
          className={styles.input}
        />
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={pending || !values.source.trim()}
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
