"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiSuccessResponse, PageUrl } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./page-urls-section.module.css";

export interface PageUrlsSectionProps {
  readonly projectId: string;
  readonly pageId: string;
  readonly initialUrls: readonly PageUrl[];
}

interface UrlFormValues {
  readonly url: string;
  readonly isCanonical: boolean;
}

const EMPTY_FORM: UrlFormValues = { url: "", isCanonical: false };

/**
 * `page_urls` editing — a real one-to-many child of `pages`
 * (`packages/database/src/page-inventory/entities.ts`'s own `PageUrlEntity` doc comment), built
 * with full add/edit/delete CRUD from day one, mirroring `ClaimSourcesSection`'s own structural
 * template (the closest existing precedent for a genuine sub-resource in this codebase) and
 * composing its CSS from the same shared `project-subresource-section.module.css` base.
 *
 * The backend's own `safeHttpUrlSchema` (`packages/validation`) restricts `url` to
 * `http:`/`https:` server-side — `isSafeHttpUrl()` is still applied client-side before ever
 * rendering a stored value as a link, matching `ProjectEnvironmentsSection`'s/
 * `ClaimSourcesSection`'s own identical guard, as defense-in-depth for a value stored before that
 * schema existed. Unlike those two, `url` is REQUIRED here (a page URL with no URL isn't a
 * meaningful row) — the add/edit forms both enforce `required` and a submit-time
 * `isSafeHttpUrl()` check, since a rejected scheme should surface as a real, specific error rather
 * than a raw 400 from the backend.
 *
 * Delete goes through `POST .../:id/delete` (not the `DELETE` HTTP method
 * `ProjectEnvironmentsSection` uses) — `PageUrlsController.remove()` is a `@Post(":id/delete")`
 * route, matching `ClaimSourcesController`'s own identical convention.
 *
 * No `router.refresh()` after a mutation here — the same reasoning `ProjectEnvironmentsSection`/
 * `ClaimSourcesSection` both already establish: no other section on the detail page reads URL
 * data, so the optimistic local-state update already fully reflects reality.
 */
export function PageUrlsSection({
  projectId,
  pageId,
  initialUrls,
}: PageUrlsSectionProps): ReactNode {
  const [urls, setUrls] = useState(initialUrls);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [addValues, setAddValues] = useState<UrlFormValues>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setUrls(initialUrls);
  }, [initialUrls]);

  const basePath = `${getApiBaseUrl()}/page-inventory/projects/${projectId}/pages/${pageId}/urls`;

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const url = addValues.url.trim();
    if (!url) {
      return;
    }
    if (!isSafeHttpUrl(url)) {
      setError("Enter a valid http:// or https:// URL.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, isCanonical: addValues.isCanonical }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<PageUrl>;
      setUrls((current) => [...current, body.data]);
      setAddValues(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add page URL", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: UrlFormValues): Promise<void> {
    const url = values.url.trim();
    if (!isSafeHttpUrl(url)) {
      setError("Enter a valid http:// or https:// URL.");
      return;
    }
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}/update`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, isCanonical: values.isCanonical }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<PageUrl>;
      setUrls((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update page URL", err);
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
      setUrls((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete page URL", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {urls.length === 0 ? (
        <p className={styles.muted}>No URLs recorded yet.</p>
      ) : (
        <ul className={styles.list}>
          {urls.map((pageUrl) =>
            editingId === pageUrl.id ? (
              <li key={pageUrl.id} className={styles.row}>
                <UrlEditForm
                  pageUrl={pageUrl}
                  pending={pendingIds.has(pageUrl.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(pageUrl.id, values)}
                />
              </li>
            ) : (
              <li key={pageUrl.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>
                    {isSafeHttpUrl(pageUrl.url) ? (
                      <a href={pageUrl.url} target="_blank" rel="noopener noreferrer">
                        {pageUrl.url}
                      </a>
                    ) : (
                      pageUrl.url
                    )}
                  </span>
                  {pageUrl.isCanonical ? (
                    <span className={styles.canonicalBadge}>Canonical</span>
                  ) : null}
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(pageUrl.id)}
                    onClick={() => setEditingId(pageUrl.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(pageUrl.id)}
                    onClick={() => {
                      void handleDelete(pageUrl.id);
                    }}
                  >
                    {pendingIds.has(pageUrl.id) ? "…" : "Delete"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form className={styles.addForm} onSubmit={(event) => void handleAdd(event)}>
        <p className={styles.addFormTitle}>Add URL</p>
        <div className={styles.field}>
          <label htmlFor="new-url-url" className={styles.label}>
            URL
          </label>
          <input
            id="new-url-url"
            type="url"
            required
            value={addValues.url}
            onChange={(event) => setAddValues((v) => ({ ...v, url: event.target.value }))}
            className={styles.input}
          />
        </div>
        <div className={styles.checkboxField}>
          <input
            id="new-url-canonical"
            type="checkbox"
            checked={addValues.isCanonical}
            onChange={(event) => setAddValues((v) => ({ ...v, isCanonical: event.target.checked }))}
          />
          <label htmlFor="new-url-canonical" className={styles.label}>
            Canonical
          </label>
        </div>
        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={adding || !addValues.url.trim()}
          >
            {adding ? "Adding…" : "Add URL"}
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

interface UrlEditFormProps {
  readonly pageUrl: PageUrl;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: UrlFormValues) => void;
}

function UrlEditForm({ pageUrl, pending, onCancel, onSave }: UrlEditFormProps): ReactNode {
  const [values, setValues] = useState<UrlFormValues>({
    url: pageUrl.url,
    isCanonical: pageUrl.isCanonical,
  });

  // Resyncs to the latest stored values if this URL is genuinely updated elsewhere while this row
  // stays open for editing — keyed on `updatedAt`, not the whole object, matching
  // `ProjectEnvironmentsSection`'s/`ClaimSourcesSection`'s own identical reasoning: it doesn't fire
  // (and wipe an in-progress unsaved edit) on every incidental re-fetch that leaves this specific
  // record unchanged.
  useEffect(() => {
    setValues({ url: pageUrl.url, isCanonical: pageUrl.isCanonical });
  }, [pageUrl.id, pageUrl.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.field}>
        <label htmlFor={`edit-url-url-${pageUrl.id}`} className={styles.label}>
          URL
        </label>
        <input
          id={`edit-url-url-${pageUrl.id}`}
          type="url"
          required
          value={values.url}
          onChange={(event) => setValues((v) => ({ ...v, url: event.target.value }))}
          className={styles.input}
        />
      </div>
      <div className={styles.checkboxField}>
        <input
          id={`edit-url-canonical-${pageUrl.id}`}
          type="checkbox"
          checked={values.isCanonical}
          onChange={(event) => setValues((v) => ({ ...v, isCanonical: event.target.checked }))}
        />
        <label htmlFor={`edit-url-canonical-${pageUrl.id}`} className={styles.label}>
          Canonical
        </label>
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={pending || !values.url.trim()}
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
