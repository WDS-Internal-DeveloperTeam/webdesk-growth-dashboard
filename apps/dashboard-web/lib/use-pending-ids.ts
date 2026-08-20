"use client";

import { useState } from "react";

/**
 * Shared per-row "is this id's mutation in flight" tracker — a `Set<string>` rather than a single
 * id so concurrent mutations on different rows don't race each other (the bug already found and
 * fixed once in `ProjectTeamSection`/`ProjectApproversSection`'s own code review, before this hook
 * existed). Extracted here because the four Projects sub-resource sections
 * (`ProjectObjectivesSection`/`ProjectEnvironmentsSection`/`ProjectRepositoriesSection`/
 * `ProjectRoadmapSection`) each independently reimplemented this identical logic — a code-review
 * finding on `dashboard-web-subresource-editing`.
 */
export function usePendingIds(): {
  readonly pendingIds: ReadonlySet<string>;
  readonly markPending: (id: string, pending: boolean) => void;
} {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  function markPending(id: string, pending: boolean): void {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  return { pendingIds, markPending };
}
