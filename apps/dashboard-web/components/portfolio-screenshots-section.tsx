"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiSuccessResponse, Asset, PortfolioAsset } from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./portfolio-screenshots-section.module.css";

const ROLE_MAX_LENGTH = 64;
const CAPTION_MAX_LENGTH = 255;

export interface PortfolioScreenshotsSectionProps {
  readonly recordId: string;
  readonly initialScreenshots: readonly PortfolioAsset[];
  /** Up to 100 of Asset Library's own assets (`getAssetsForPortfolioPicker()`), the picker's
   *  search pool — same bounded-window/raw-id-fallback reasoning as
   *  `CaseStudyAssetsSection`'s own `assets` prop. */
  readonly assets: readonly Asset[];
}

interface RoleCaptionValues {
  readonly role: string;
  readonly caption: string;
}

/**
 * `portfolio_assets` editing (screenshots, D2) — a real many-to-many join into Asset Library's own
 * `assets` table, but UNLIKE a pure join, each row also carries its own `role`/`caption` that must
 * be set at add time AND stay editable afterward. `role` is a plain, free-text string (unlike
 * `CaseStudyAsset.role`'s closed enum) — no fixed screenshot-role taxonomy is named anywhere in the
 * canonical spec for this module, so it's a plain text input, not a `<select>`. The shared
 * `useRelationshipSection()` hook (add/remove only, no per-link update capability) doesn't cover
 * that edit-after requirement, so this component is hand-built directly rather than built on that
 * hook — mirrors `CaseStudyAssetsSection`'s own identical reasoning/shape.
 *
 * Delete goes through `POST .../:id/delete` (not the `DELETE` HTTP method), matching the module's
 * own established `POST .../:id/update` convention for every other mutation, same as
 * `CaseStudyAssetsSection`.
 *
 * No `router.refresh()` after a mutation here — no other section on the detail page reads
 * screenshot data, so the optimistic local-state update already fully reflects reality, matching
 * `CaseStudyAssetsSection`'s/`ClaimSourcesSection`'s own identical reasoning.
 */
export function PortfolioScreenshotsSection({
  recordId,
  initialScreenshots,
  assets,
}: PortfolioScreenshotsSectionProps): ReactNode {
  const [links, setLinks] = useState(initialScreenshots);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [query, setQuery] = useState("");
  const [addRole, setAddRole] = useState("");
  const [addCaption, setAddCaption] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLinks(initialScreenshots);
  }, [initialScreenshots]);

  const basePath = `${getApiBaseUrl()}/portfolio-library/records/${recordId}/screenshots`;

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const linkedAssetIds = useMemo(() => new Set(links.map((link) => link.assetId)), [links]);

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return assets
      .filter(
        (asset) =>
          !linkedAssetIds.has(asset.id) &&
          (lowerQuery === "" || asset.title.toLowerCase().includes(lowerQuery)),
      )
      .map((asset): RelationshipOption => ({ id: asset.id, displayName: asset.title }))
      .slice(0, 20);
  }, [assets, linkedAssetIds, query]);

  async function handleAdd(option: RelationshipOption): Promise<void> {
    if (adding) {
      return;
    }
    const trimmedRole = addRole.trim();
    if (trimmedRole === "") {
      setError("Role is required to link a screenshot.");
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
          assetId: option.id,
          role: trimmedRole,
          caption: addCaption.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<PortfolioAsset>;
      setLinks((current) => [...current, body.data]);
      setQuery("");
      setAddRole("");
      setAddCaption("");
    } catch (err) {
      console.error("Failed to link screenshot", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: RoleCaptionValues): Promise<void> {
    const trimmedRole = values.role.trim();
    if (trimmedRole === "") {
      setError("Role is required.");
      return;
    }
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}/update`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: trimmedRole, caption: values.caption.trim() || null }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<PortfolioAsset>;
      setLinks((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update linked screenshot", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  async function handleRemove(id: string): Promise<void> {
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
      setLinks((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to unlink screenshot", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {links.length === 0 ? (
        <p className={styles.muted}>No screenshots linked yet.</p>
      ) : (
        <ul className={styles.list}>
          {links.map((link) =>
            editingId === link.id ? (
              <li key={link.id} className={styles.row}>
                <ScreenshotEditForm
                  link={link}
                  pending={pendingIds.has(link.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => void handleSaveEdit(link.id, values)}
                />
              </li>
            ) : (
              <li key={link.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.primaryText}>
                    {assetById.get(link.assetId)?.title ?? link.assetId}
                  </span>
                  <span className={styles.secondaryText}>
                    {link.role}
                    {link.caption ? ` — ${link.caption}` : ""}
                  </span>
                </span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    disabled={pendingIds.has(link.id)}
                    onClick={() => setEditingId(link.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={pendingIds.has(link.id)}
                    onClick={() => {
                      void handleRemove(link.id);
                    }}
                  >
                    {pendingIds.has(link.id) ? "…" : "Remove"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <div className={styles.addForm}>
        <p className={styles.addFormTitle}>Link a screenshot</p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-screenshot-role" className={styles.label}>
              Role
            </label>
            <input
              id="new-screenshot-role"
              type="text"
              maxLength={ROLE_MAX_LENGTH}
              value={addRole}
              onChange={(event) => setAddRole(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-screenshot-caption" className={styles.label}>
              Caption (optional)
            </label>
            <input
              id="new-screenshot-caption"
              type="text"
              maxLength={CAPTION_MAX_LENGTH}
              value={addCaption}
              onChange={(event) => setAddCaption(event.target.value)}
              className={styles.input}
            />
          </div>
        </div>
        <RelationshipPicker
          label="Screenshot"
          query={query}
          onQueryChange={setQuery}
          options={options}
          selected={[]}
          onSelect={(option) => {
            void handleAdd(option);
          }}
          onRemove={() => {}}
          hint="Search and select a screenshot asset. The role/caption above are attached to the link."
        />
      </div>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ScreenshotEditFormProps {
  readonly link: PortfolioAsset;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: RoleCaptionValues) => void;
}

function ScreenshotEditForm({
  link,
  pending,
  onCancel,
  onSave,
}: ScreenshotEditFormProps): ReactNode {
  const [values, setValues] = useState<RoleCaptionValues>({
    role: link.role,
    caption: link.caption ?? "",
  });

  // Resyncs to the latest stored values if this link is genuinely updated elsewhere while this row
  // stays open for editing — keyed on `updatedAt`, matching `CaseStudyAssetsSection`'s own
  // `AssetEditForm` identical reasoning.
  useEffect(() => {
    setValues({ role: link.role, caption: link.caption ?? "" });
  }, [link.id, link.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.field}>
        <label htmlFor={`edit-screenshot-role-${link.id}`} className={styles.label}>
          Role
        </label>
        <input
          id={`edit-screenshot-role-${link.id}`}
          type="text"
          maxLength={ROLE_MAX_LENGTH}
          value={values.role}
          onChange={(event) => setValues((v) => ({ ...v, role: event.target.value }))}
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`edit-screenshot-caption-${link.id}`} className={styles.label}>
          Caption
        </label>
        <input
          id={`edit-screenshot-caption-${link.id}`}
          type="text"
          maxLength={CAPTION_MAX_LENGTH}
          value={values.caption}
          onChange={(event) => setValues((v) => ({ ...v, caption: event.target.value }))}
          className={styles.input}
        />
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={pending}
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
