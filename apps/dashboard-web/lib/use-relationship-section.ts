"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RelationshipOption } from "@webdesk/ui";
import { parseApiErrorMessage } from "./api-errors";
import { usePendingIds } from "./use-pending-ids";

export interface UseRelationshipSectionOptions<TLink extends { readonly id: string }> {
  readonly basePath: string;
  readonly initialLinks: readonly TLink[];
  /** The id of the OTHER side of the join (e.g. `relationship.entityId`/`assignment.pageId`) —
   *  used to build the "already linked" set the picker's own search excludes. */
  readonly getLinkedRecordId: (link: TLink) => string;
  /** The POST body for a new link, given the picked option's id. */
  readonly buildAddBody: (recordId: string) => Record<string, unknown>;
  /** Fired after a successful add, before the query is cleared — e.g. to also clear a
   *  component-local field (like `page-keyword-assignments`'s own `assignmentNote`) that isn't
   *  part of this hook's own state. */
  readonly onAdded?: () => void;
  /** Verbs for the two `console.error()` calls, e.g. `{ add: "link entity", remove: "unlink
   *  entity" }` — kept distinct per consumer since the two components describe different
   *  relationships. */
  readonly failureVerb: { readonly add: string; readonly remove: string };
}

export interface UseRelationshipSectionResult<TLink> {
  readonly links: readonly TLink[];
  readonly query: string;
  readonly setQuery: (value: string) => void;
  readonly error: string | null;
  readonly adding: boolean;
  readonly pendingIds: ReadonlySet<string>;
  readonly linkedRecordIds: ReadonlySet<string>;
  readonly add: (option: RelationshipOption) => Promise<void>;
  readonly remove: (link: TLink) => Promise<void>;
}

/**
 * Shared state/fetch machinery for a pure join sub-resource (create/list/remove only, no content
 * fields of its own beyond the join) rendered as its own row list plus a `RelationshipPicker` used
 * purely as a search-and-add widget. Extracted after `KeywordEntityRelationshipsSection` and
 * `KeywordPageAssignmentsSection` independently reimplemented ~150 identical lines of this each
 * (code-review finding, `dashboard-web-keyword-and-entity-library`) — the same "past the 2-copy
 * threshold" extraction discipline this branch's own `project-scoped-href.ts`/`use-pending-ids.ts`
 * already establish. The row-list JSX (including any extra per-link fields, like
 * `page-keyword-assignments`'s own `assignmentNote`) stays per-component — only the add/remove
 * state machine is shared here.
 */
export function useRelationshipSection<TLink extends { readonly id: string }>({
  basePath,
  initialLinks,
  getLinkedRecordId,
  buildAddBody,
  onAdded,
  failureVerb,
}: UseRelationshipSectionOptions<TLink>): UseRelationshipSectionResult<TLink> {
  const [links, setLinks] = useState<readonly TLink[]>(initialLinks);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { pendingIds, markPending } = usePendingIds();

  useEffect(() => {
    setLinks(initialLinks);
  }, [initialLinks]);

  const linkedRecordIds = useMemo(
    () => new Set(links.map(getLinkedRecordId)),
    [links, getLinkedRecordId],
  );

  async function add(option: RelationshipOption): Promise<void> {
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
        body: JSON.stringify(buildAddBody(option.id)),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<TLink>;
      setLinks((current) => [...current, body.data]);
      setQuery("");
      onAdded?.();
    } catch (err) {
      console.error(`Failed to ${failureVerb.add}`, err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(link: TLink): Promise<void> {
    if (pendingIds.has(link.id)) {
      return;
    }
    setError(null);
    markPending(link.id, true);
    try {
      const response = await fetch(`${basePath}/${link.id}/delete`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setLinks((current) => current.filter((item) => item.id !== link.id));
    } catch (err) {
      console.error(`Failed to ${failureVerb.remove}`, err);
      setError("Something went wrong. Please try again.");
    } finally {
      markPending(link.id, false);
    }
  }

  return { links, query, setQuery, error, adding, pendingIds, linkedRecordIds, add, remove };
}
