"use client";

import { useEffect, useState } from "react";

/**
 * `useState` seeded from a server-passed prop, re-synced via `useEffect` whenever that prop
 * changes — the "pick up a sibling component's own `router.refresh()`" pattern this codebase has
 * now hand-copied 5 times across 4 files (`ContentTemplateStatusActions`, `ContentTemplatePublishActions`,
 * and — twice — `ReviewProcessActions`, plus once in `ReviewDecisionActions`), each occurrence's
 * own doc comment explicitly citing the prior as precedent rather than importing a shared
 * implementation (code-review finding, `dashboard-web-review-and-approval-center` branch).
 * Extracted here, matching this project's own established precedent for extracting a repeated
 * small stateful pattern once it recurs (`usePendingIds`, `useRelationshipSection`).
 *
 * Only the two new call sites in this branch (`ReviewDecisionActions`/`ReviewProcessActions`) were
 * migrated to it — retrofitting the two pre-existing `ContentTemplate*Actions` call sites is out of
 * scope for a branch that doesn't otherwise touch that module.
 */
export function useSyncedState<T>(value: T): [T, (next: T) => void] {
  const [state, setState] = useState(value);

  useEffect(() => {
    setState(value);
  }, [value]);

  return [state, setState];
}
