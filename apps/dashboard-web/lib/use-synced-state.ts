"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

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
 * The two `ReviewDecisionActions`/`ReviewProcessActions` call sites were migrated to it when it was
 * extracted; the two pre-existing `ContentTemplate*Actions` call sites were left as-is at the time
 * (retrofitting them was out of scope for a branch that didn't otherwise touch that module), but
 * every module built afterward — starting with `DesignReferenceLibraryStatusActions`/
 * `DesignReferenceLibraryPublishActions` — uses this hook from the start rather than hand-copying
 * the pattern again.
 */
export function useSyncedState<T>(value: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(value);

  useEffect(() => {
    setState(value);
  }, [value]);

  return [state, setState];
}
