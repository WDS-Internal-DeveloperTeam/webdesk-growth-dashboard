"use client";

import { useMemo, type ReactNode } from "react";
import type { EntityRecord, KeywordEntityRelationship } from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { getApiBaseUrl } from "@/lib/auth";
import { useRelationshipSection } from "@/lib/use-relationship-section";
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
 * removing a row immediately POSTs `.../:id/delete`. The add/remove state machine itself lives in
 * the shared `useRelationshipSection()` hook (code-review finding, `dashboard-web-keyword-and-
 * entity-library` — this component and `KeywordPageAssignmentsSection` independently reimplemented
 * ~150 identical lines of it before the hook existed); only the row-rendering (this component's own
 * `entityType` secondary-line text) stays here.
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
  const basePath = `${getApiBaseUrl()}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}/entity-relationships`;

  const { links, query, setQuery, error, pendingIds, linkedRecordIds, add, remove } =
    useRelationshipSection<KeywordEntityRelationship>({
      basePath,
      initialLinks: initialRelationships,
      getLinkedRecordId: (relationship) => relationship.entityId,
      buildAddBody: (entityId) => ({ entityId }),
      failureVerb: { add: "link entity", remove: "unlink entity" },
    });

  const entityById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return toRelationshipOptions(
      entities.filter(
        (entity) =>
          !linkedRecordIds.has(entity.id) &&
          (lowerQuery === "" || entity.name.toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [entities, linkedRecordIds, query]);

  return (
    <div>
      {links.length === 0 ? (
        <p className={styles.muted}>No entities linked yet.</p>
      ) : (
        <ul className={styles.list}>
          {links.map((relationship) => {
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
                    void remove(relationship);
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
            void add(option);
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
