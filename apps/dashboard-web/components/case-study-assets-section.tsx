"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Asset,
  ApiSuccessResponse,
  CaseStudyAsset,
  CaseStudyAssetRole,
} from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { ASSET_ROLE_LABEL, ASSET_ROLE_VALUES } from "@/lib/case-study-studio-query";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./case-study-assets-section.module.css";

const CAPTION_MAX_LENGTH = 255;

export interface CaseStudyAssetsSectionProps {
  readonly caseStudyId: string;
  readonly initialAssets: readonly CaseStudyAsset[];
  /** Up to 100 of Asset Library's own assets (`getAssetsForCaseStudyPicker()`), the picker's
   *  search pool — same bounded-window/raw-id-fallback reasoning as
   *  `KeywordEntityRelationshipsSection`'s own `entities` prop. */
  readonly assets: readonly Asset[];
}

interface RoleCaptionValues {
  readonly role: CaseStudyAssetRole;
  readonly caption: string;
}

/**
 * `case_study_assets` editing — a real many-to-many join into Asset Library's own `assets`
 * table (D3), but UNLIKE a pure join (`KeywordEntityRelationshipsSection`), each row also carries
 * its own `role`/`caption` that must be set at add time AND stay editable afterward. The shared
 * `useRelationshipSection()` hook (add/remove only, no per-link update capability) doesn't cover
 * that edit-after requirement, so this component is hand-built directly rather than built on that
 * hook — the add/remove halves still mirror its exact fetch/state shape, and the edit-after
 * affordance mirrors `ClaimSourcesSection`'s own inline Edit/Save/Cancel row pattern.
 *
 * Delete goes through `POST .../:id/delete` (not the `DELETE` HTTP method), matching the module's
 * own established `POST .../:id/update` convention for every other mutation, same as
 * `ClaimSourcesSection`.
 *
 * No `router.refresh()` after a mutation here — no other section on the detail page reads asset
 * data, so the optimistic local-state update already fully reflects reality, matching
 * `ClaimSourcesSection`'s/`ProjectEnvironmentsSection`'s own identical reasoning.
 */
export function CaseStudyAssetsSection({
  caseStudyId,
  initialAssets,
  assets,
}: CaseStudyAssetsSectionProps): ReactNode {
  const [links, setLinks] = useState(initialAssets);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pendingIds, markPending } = usePendingIds();
  const [query, setQuery] = useState("");
  const [addRole, setAddRole] = useState<CaseStudyAssetRole>(ASSET_ROLE_VALUES[0]!);
  const [addCaption, setAddCaption] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLinks(initialAssets);
  }, [initialAssets]);

  const basePath = `${getApiBaseUrl()}/case-study-studio/case-studies/${caseStudyId}/assets`;

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
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(basePath, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: option.id,
          role: addRole,
          caption: addCaption.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<CaseStudyAsset>;
      setLinks((current) => [...current, body.data]);
      setQuery("");
      setAddCaption("");
    } catch (err) {
      console.error("Failed to link asset", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: string, values: RoleCaptionValues): Promise<void> {
    setError(null);
    markPending(id, true);
    try {
      const response = await fetch(`${basePath}/${id}/update`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: values.role, caption: values.caption.trim() || null }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<CaseStudyAsset>;
      setLinks((current) => current.map((item) => (item.id === id ? body.data : item)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update linked asset", err);
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
      console.error("Failed to unlink asset", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(id, false);
    }
  }

  return (
    <div>
      {links.length === 0 ? (
        <p className={styles.muted}>No assets linked yet.</p>
      ) : (
        <ul className={styles.list}>
          {links.map((link) =>
            editingId === link.id ? (
              <li key={link.id} className={styles.row}>
                <AssetEditForm
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
                    {ASSET_ROLE_LABEL[link.role]}
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
        <p className={styles.addFormTitle}>Link an asset</p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="new-asset-role" className={styles.label}>
              Role
            </label>
            <select
              id="new-asset-role"
              value={addRole}
              onChange={(event) => setAddRole(event.target.value as CaseStudyAssetRole)}
              className={styles.select}
            >
              {ASSET_ROLE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {ASSET_ROLE_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="new-asset-caption" className={styles.label}>
              Caption (optional)
            </label>
            <input
              id="new-asset-caption"
              type="text"
              maxLength={CAPTION_MAX_LENGTH}
              value={addCaption}
              onChange={(event) => setAddCaption(event.target.value)}
              className={styles.input}
            />
          </div>
        </div>
        <RelationshipPicker
          label="Asset"
          query={query}
          onQueryChange={setQuery}
          options={options}
          selected={[]}
          onSelect={(option) => {
            void handleAdd(option);
          }}
          onRemove={() => {}}
          hint="Search and select an asset. The role/caption above are attached to the link."
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

interface AssetEditFormProps {
  readonly link: CaseStudyAsset;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (values: RoleCaptionValues) => void;
}

function AssetEditForm({ link, pending, onCancel, onSave }: AssetEditFormProps): ReactNode {
  const [values, setValues] = useState<RoleCaptionValues>({
    role: link.role,
    caption: link.caption ?? "",
  });

  // Resyncs to the latest stored values if this link is genuinely updated elsewhere while this row
  // stays open for editing — keyed on `updatedAt`, matching `ClaimSourcesSection`'s own
  // `SourceEditForm` identical reasoning.
  useEffect(() => {
    setValues({ role: link.role, caption: link.caption ?? "" });
  }, [link.id, link.updatedAt]);

  return (
    <div className={styles.editForm}>
      <div className={styles.field}>
        <label htmlFor={`edit-asset-role-${link.id}`} className={styles.label}>
          Role
        </label>
        <select
          id={`edit-asset-role-${link.id}`}
          value={values.role}
          onChange={(event) =>
            setValues((v) => ({ ...v, role: event.target.value as CaseStudyAssetRole }))
          }
          className={styles.select}
        >
          {ASSET_ROLE_VALUES.map((value) => (
            <option key={value} value={value}>
              {ASSET_ROLE_LABEL[value]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`edit-asset-caption-${link.id}`} className={styles.label}>
          Caption
        </label>
        <input
          id={`edit-asset-caption-${link.id}`}
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
