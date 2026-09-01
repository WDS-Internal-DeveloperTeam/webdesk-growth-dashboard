"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { PortfolioApprovalStatus } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./portfolio-library-publish-actions.module.css";

export interface PortfolioLibraryPublishActionsProps {
  readonly recordId: string;
  readonly approvalStatus: PortfolioApprovalStatus;
  readonly isPublished: boolean;
}

/**
 * Mirrors `DesignReferenceLibraryPublishActions`/`BrandLibraryPublishActions`/
 * `ContentTemplatePublishActions` exactly — `isPublished`/`publishedAt` are orthogonal to
 * `approvalStatus`, gated only inside `PortfolioRecordsService.publish()` itself
 * (`approvalStatus === "approved"` required; `unpublish()` has no such gate — always offered once
 * published, even against a record that later moved to `archived`/`superseded`, per D5, reusing
 * Brand/Design Reference Library's own identical asymmetry). This component mirrors that gate in
 * its own render logic purely for UX (so a doomed request is never even offered) — the backend's
 * own `publish()`/`unpublish()` remain the real, sole enforcement point, exactly like every
 * sibling `*StatusActions`/`*PublishActions` component's own relationship to its backend logic.
 *
 * Publish prompts no `window.confirm()` — it's reversible via unpublish, provided the record is
 * still approved. **Unpublish DOES prompt one** when the record is no longer `approved`
 * (`archived`/`superseded`, both terminal with no outgoing edge, including back to `approved`) —
 * that specific combination is genuinely irreversible: nothing can ever move the record back to
 * `approved`, so it can never be republished again through any UI, matching
 * `DesignReferenceLibraryPublishActions`'s/`BrandLibraryPublishActions`'s own identical reasoning.
 *
 * Renders alongside, not merged into, `PortfolioLibraryStatusActions` — a separate island because
 * `publish`/`unpublish` are independently-governed RBAC actions from `submit`/`review`/`approve`,
 * not another `approvalStatus` transition. `isPublished` is re-synced from the server-passed prop
 * via the shared `useSyncedState()` hook whenever it changes — without this, a transition made via
 * the sibling `PortfolioLibraryStatusActions` component, or a second tab/operator's own publish/
 * unpublish, would go unreflected here even after the surrounding Server Component tree re-fetches
 * via `router.refresh()`, since React never resets `useState` from new props on its own — a stale
 * click would still be safely rejected by the backend's own gate, but only after a needless failed
 * round trip. `approvalStatus` needs no such syncing — it's read directly from the live prop on
 * every render, never copied into local state.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern every
 * mutation in this app already uses.
 */
export function PortfolioLibraryPublishActions({
  recordId,
  approvalStatus,
  isPublished: initialIsPublished,
}: PortfolioLibraryPublishActionsProps): ReactNode {
  const router = useRouter();
  // useSyncedState re-syncs from the server-passed prop whenever it changes — see the doc comment
  // above. Does not fire on this component's own optimistic setIsPublished() call below, since
  // that already matches the prop's next value once router.refresh() resolves.
  const [isPublished, setIsPublished] = useSyncedState(initialIsPublished);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"publish" | "unpublish" | null>(null);

  const canPublish = approvalStatus === "approved" && !isPublished;
  const canUnpublish = isPublished;
  if (!canPublish && !canUnpublish) {
    return null;
  }

  // Unpublishing a record that's no longer approved (archived/superseded) is genuinely
  // irreversible — see the doc comment above — so it gets the same confirmation treatment
  // PortfolioLibraryStatusActions reserves for its own terminal-state transitions.
  const IRREVERSIBLE_UNPUBLISH_MESSAGE =
    "Unpublish this portfolio record? Its approval status is " +
    `'${approvalStatus}', which can never become 'approved' again — once unpublished, it can ` +
    "never be republished through this app.";

  async function handle(action: "publish" | "unpublish"): Promise<void> {
    if (action === "unpublish" && approvalStatus !== "approved") {
      if (!window.confirm(IRREVERSIBLE_UNPUBLISH_MESSAGE)) {
        return;
      }
    }
    setError(null);
    setPending(action);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/portfolio-library/records/${recordId}/${action}`,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern PortfolioLibraryStatusActions/every sibling *PublishActions
      // component uses: update the rendered button set from the just-confirmed transition
      // immediately, rather than waiting on router.refresh() to reconcile it.
      setIsPublished(action === "publish");
      router.refresh();
    } catch (err) {
      console.error(`Failed to ${action} portfolio record`, err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      {canPublish ? (
        <button
          type="button"
          onClick={() => {
            void handle("publish");
          }}
          disabled={pending !== null}
          className={styles.actionButton}
        >
          {pending === "publish" ? "…" : "Publish"}
        </button>
      ) : null}
      {canUnpublish ? (
        <button
          type="button"
          onClick={() => {
            void handle("unpublish");
          }}
          disabled={pending !== null}
          className={styles.actionButton}
        >
          {pending === "unpublish" ? "…" : "Unpublish"}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
