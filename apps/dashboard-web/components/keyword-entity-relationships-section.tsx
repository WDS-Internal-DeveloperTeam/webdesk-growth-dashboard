"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ApiSuccessResponse,
  EntityRecord,
  KeywordEntityRelationship,
} from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { usePendingIds } from "@/lib/use-pending-ids";
import styles from "./keyword-relationship-section.module.css";

export interface KeywordEntityRelationshipsSectionProps {
  readonly projectId: string;
  readonly keywordId: string;
  readonly initialRelationships: readonly KeywordEntityRelationship[];
  /** Up to 100 of the project's own entities (`getEntitiesForKeywordPicker()`), the picker's
   *  search pool — mirrors `PersonaLibraryForm`'s own bounded `services` prop for
   *  `relatedServiceIds`. An entity outside this window (a real, previously-known limitation this
   *  component inherits from `RelationshipPicker` having no server-side search of its own) still
   *  renders correctly as its own row via `entityById.get(id) ?? id`, the same raw-id fallback
   *  `PersonaLibraryForm`'s own code review already established for the identical case — a linked
   *  entity is never invisible or unremovable here, even if it can't be found by name in the
   *  picker's own search pool.
   */
  readonly entities: readonly EntityRecord[];
}

function toRelationshipOptions(records: readonly EntityRecord[]): readonly RelationshipOption[] {
  return records.map((entity) => ({ id: entity.id, displayName: entity.name }));
}

/**
 * `keyword_entity_relationships` editing — a genuine many-to-many join with no content fields of
 * its own to edit in place (task package D1), only create/list/remove, mirroring
 * `KeywordEntityRelationshipsService`'s own backend shape. Unlike `PageUrlsSection`/
 * `ClaimSourcesSection` (which each render their OWN add-form fields), this section renders its own
 * row list (name + Remove) and uses `@webdesk/ui`'s `RelationshipPicker` purely as the "search and
 * add" widget, always passing `selected={[]}`/a no-op `onRemove` to it — `RelationshipPicker`'s own
 * built-in chip rendering has no room for a secondary line, so a real per-row list (built here) is
 * used instead of relying on its chips for display. Picking an option from the picker's own dropdown
 * immediately POSTs the new relationship (no separate "Add" button — `onSelect` fires exactly once
 * per click, matching every other `RelationshipPicker` consumer's own click-to-select semantics);
 * removing a row immediately POSTs `.../:id/delete`.
 *
 * No `router.refresh()` after a mutation here — the same reasoning `ProjectEnvironmentsSection`/
 * `ClaimSourcesSection`/`PageUrlsSection` all already establish: no other section on the detail page
 * reads this data, so the local-state update already fully reflects reality.
 */
export function KeywordEntityRelationshipsSection({
  projectId,
  keywordId,
  initialRelationships,
  entities,
}: KeywordEntityRelationshipsSectionProps): ReactNode {
  const [relationships, setRelationships] = useState(initialRelationships);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { pendingIds, markPending } = usePendingIds();

  useEffect(() => {
    setRelationships(initialRelationships);
  }, [initialRelationships]);

  const entityById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
  const linkedEntityIds = useMemo(
    () => new Set(relationships.map((relationship) => relationship.entityId)),
    [relationships],
  );

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return toRelationshipOptions(
      entities.filter(
        (entity) =>
          !linkedEntityIds.has(entity.id) &&
          (lowerQuery === "" || entity.name.toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [entities, linkedEntityIds, query]);

  const basePath = `${getApiBaseUrl()}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}/entity-relationships`;

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
        body: JSON.stringify({ entityId: option.id }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<KeywordEntityRelationship>;
      setRelationships((current) => [...current, body.data]);
      setQuery("");
    } catch (err) {
      console.error("Failed to link entity", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(relationship: KeywordEntityRelationship): Promise<void> {
    if (pendingIds.has(relationship.id)) {
      return;
    }
    setError(null);
    markPending(relationship.id, true);
    try {
      const response = await fetch(`${basePath}/${relationship.id}/delete`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setRelationships((current) => current.filter((item) => item.id !== relationship.id));
    } catch (err) {
      console.error("Failed to unlink entity", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(relationship.id, false);
    }
  }

  return (
    <div>
      {relationships.length === 0 ? (
        <p className={styles.muted}>No entities linked yet.</p>
      ) : (
        <ul className={styles.list}>
          {relationships.map((relationship) => {
            const entity = entityById.get(relationship.entityId);
            return (
              <li key={relationship.id} className={styles.row}>
                <span className={styles.primaryText}>
                  {entity ? entity.name : relationship.entityId}
                  {entity?.entityType ? (
                    <span className={styles.secondaryText}> — {entity.entityType}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={styles.removeButton}
                  disabled={pendingIds.has(relationship.id)}
                  onClick={() => {
                    void handleRemove(relationship);
                  }}
                >
                  {pendingIds.has(relationship.id) ? "…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.pickerWrapper}>
        <RelationshipPicker
          label="Link an entity"
          query={query}
          onQueryChange={setQuery}
          options={options}
          selected={[]}
          onSelect={(option) => {
            void handleAdd(option);
          }}
          onRemove={() => {}}
          hint="Search and select an entity to link to this keyword."
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
