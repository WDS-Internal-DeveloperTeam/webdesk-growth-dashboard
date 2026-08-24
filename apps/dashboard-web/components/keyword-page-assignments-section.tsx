"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Page, PageKeywordAssignment } from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { getApiBaseUrl } from "@/lib/auth";
import { useRelationshipSection } from "@/lib/use-relationship-section";
import styles from "./keyword-relationship-section.module.css";

const ASSIGNMENT_NOTE_MAX_LENGTH = 500;

export interface KeywordPageAssignmentsSectionProps {
  readonly projectId: string;
  readonly keywordId: string;
  readonly initialAssignments: readonly PageKeywordAssignment[];
  /** Up to 100 of the project's own Page Inventory pages (`getPagesForKeywordPicker()`), the
   *  picker's search pool — same bounded-window/raw-id-fallback reasoning as
   *  `KeywordEntityRelationshipsSection`'s own `entities` prop. */
  readonly pages: readonly Page[];
}

function toRelationshipOptions(records: readonly Page[]): readonly RelationshipOption[] {
  return records.map((page) => ({ id: page.id, displayName: page.pageName }));
}

/**
 * `page_keyword_assignments` editing — a genuine join into Page Inventory's own `pages`, carrying
 * one extra field beyond the join itself, `assignmentNote` (task package D1/D10). Same structural
 * shape as `KeywordEntityRelationshipsSection` (own row list + a `RelationshipPicker` used purely
 * as the search-and-add widget, `selected={[]}`/a no-op `onRemove` since chip rendering has no room
 * for a note line) — the one real difference is the "Note" input above the picker: since
 * `RelationshipPicker.onSelect` fires the add immediately on click with no separate submit step,
 * whatever note is currently typed at the moment a page is picked is what gets attached to that
 * assignment, then cleared. This keeps the add flow to a single click (matching every sibling
 * `RelationshipPicker` consumer's own click-to-select semantics) rather than introducing a second,
 * inconsistent "pick, then press a separate Add button" step just for this one field. The shared
 * add/remove state machine lives in `useRelationshipSection()`; `assignmentNote` is the one piece of
 * state genuinely local to this component (it's not part of the join list itself, only the pending
 * value for the NEXT add), threaded into the shared hook via `buildAddBody`/`onAdded`.
 */
export function KeywordPageAssignmentsSection({
  projectId,
  keywordId,
  initialAssignments,
  pages,
}: KeywordPageAssignmentsSectionProps): ReactNode {
  const [assignmentNote, setAssignmentNote] = useState("");
  const basePath = `${getApiBaseUrl()}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}/page-assignments`;

  const { links, query, setQuery, error, pendingIds, linkedRecordIds, add, remove } =
    useRelationshipSection<PageKeywordAssignment>({
      basePath,
      initialLinks: initialAssignments,
      getLinkedRecordId: (assignment) => assignment.pageId,
      buildAddBody: (pageId) => ({ pageId, assignmentNote: assignmentNote.trim() || null }),
      onAdded: () => setAssignmentNote(""),
      failureVerb: { add: "assign page", remove: "remove page assignment" },
    });

  const pageById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return toRelationshipOptions(
      pages.filter(
        (page) =>
          !linkedRecordIds.has(page.id) &&
          (lowerQuery === "" || page.pageName.toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [pages, linkedRecordIds, query]);

  return (
    <div>
      {links.length === 0 ? (
        <p className={styles.muted}>No pages assigned yet.</p>
      ) : (
        <ul className={styles.list}>
          {links.map((assignment) => {
            const page = pageById.get(assignment.pageId);
            return (
              <li key={assignment.id} className={styles.row}>
                <span className={styles.primaryText}>
                  {page ? page.pageName : assignment.pageId}
                  {assignment.assignmentNote ? (
                    <span className={styles.secondaryText}> — {assignment.assignmentNote}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={styles.removeButton}
                  disabled={pendingIds.has(assignment.id)}
                  onClick={() => {
                    void remove(assignment);
                  }}
                >
                  {pendingIds.has(assignment.id) ? "…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.noteField}>
        <label htmlFor="page-assignment-note" className={styles.noteLabel}>
          Note (optional)
        </label>
        <input
          id="page-assignment-note"
          type="text"
          maxLength={ASSIGNMENT_NOTE_MAX_LENGTH}
          value={assignmentNote}
          onChange={(event) => setAssignmentNote(event.target.value)}
          className={styles.noteInput}
        />
      </div>

      <div className={styles.pickerWrapper}>
        <RelationshipPicker
          label="Assign a page"
          query={query}
          onQueryChange={setQuery}
          options={options}
          selected={[]}
          onSelect={(option) => {
            void add(option);
          }}
          onRemove={() => {}}
          hint="Search and select a Page Inventory page. Any note above is attached to the assignment."
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
