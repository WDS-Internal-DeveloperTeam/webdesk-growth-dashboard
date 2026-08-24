"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiSuccessResponse, Page, PageKeywordAssignment } from "@webdesk/shared-types";
import { RelationshipPicker, type RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { usePendingIds } from "@/lib/use-pending-ids";
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
 * inconsistent "pick, then press a separate Add button" step just for this one field.
 */
export function KeywordPageAssignmentsSection({
  projectId,
  keywordId,
  initialAssignments,
  pages,
}: KeywordPageAssignmentsSectionProps): ReactNode {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [query, setQuery] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { pendingIds, markPending } = usePendingIds();

  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  const pageById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const assignedPageIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.pageId)),
    [assignments],
  );

  const options = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return toRelationshipOptions(
      pages.filter(
        (page) =>
          !assignedPageIds.has(page.id) &&
          (lowerQuery === "" || page.pageName.toLowerCase().includes(lowerQuery)),
      ),
    ).slice(0, 20);
  }, [pages, assignedPageIds, query]);

  const basePath = `${getApiBaseUrl()}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}/page-assignments`;

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
          pageId: option.id,
          assignmentNote: assignmentNote.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<PageKeywordAssignment>;
      setAssignments((current) => [...current, body.data]);
      setQuery("");
      setAssignmentNote("");
    } catch (err) {
      console.error("Failed to assign page", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(assignment: PageKeywordAssignment): Promise<void> {
    if (pendingIds.has(assignment.id)) {
      return;
    }
    setError(null);
    markPending(assignment.id, true);
    try {
      const response = await fetch(`${basePath}/${assignment.id}/delete`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
    } catch (err) {
      console.error("Failed to remove page assignment", err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(assignment.id, false);
    }
  }

  return (
    <div>
      {assignments.length === 0 ? (
        <p className={styles.muted}>No pages assigned yet.</p>
      ) : (
        <ul className={styles.list}>
          {assignments.map((assignment) => {
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
                    void handleRemove(assignment);
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
            void handleAdd(option);
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
