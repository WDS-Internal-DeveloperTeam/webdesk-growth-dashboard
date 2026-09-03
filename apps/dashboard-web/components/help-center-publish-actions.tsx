"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./help-center-publish-actions.module.css";

export interface HelpCenterPublishActionsProps {
  readonly articleId: string;
  readonly isPublished: boolean;
}

/**
 * Toggles `isPublished` — unlike every sibling `*PublishActions` component
 * (`ContentTemplatePublishActions`/`DesignReferenceLibraryPublishActions`/
 * `BrandLibraryPublishActions`), this module has no `approvalStatus` to gate against and no
 * dedicated `POST .../publish`/`unpublish` routes: the seeded `system_settings` RBAC group this
 * module reuses carries no `P` (Publish/Unpublish) letter at all
 * (`00013-seed-rbac-matrix.ts`/`help-center.constants.ts`'s own doc comment), so `isPublished` is
 * a plain field toggled through the ordinary `POST .../:id/update` route (gated only on `edit`,
 * the same action the create/edit form itself uses). There is no terminal/archived state on this
 * module either — publish and unpublish are both always fully reversible, so unlike
 * `ContentTemplatePublishActions`'s own irreversible-unpublish case, neither transition here ever
 * needs a `window.confirm()`.
 *
 * `isPublished` is re-synced from the server-passed prop via the shared `useSyncedState()` hook
 * whenever it changes — without this, a second tab/operator's own toggle would go unreflected
 * here even after the surrounding Server Component tree re-fetches via `router.refresh()`, since
 * React never resets `useState` from new props on its own.
 *
 * Submits via `postMutation()` (`lib/api-errors.ts`) — the shared `fetch()`-with-`credentials:
 * "include"` helper, required for `dashboard-api`'s `OriginCheckGuard` to see a real browser
 * `Origin` header, the same pattern every mutation in this app already uses.
 */
export function HelpCenterPublishActions({
  articleId,
  isPublished: initialIsPublished,
}: HelpCenterPublishActionsProps): ReactNode {
  const router = useRouter();
  const [isPublished, setIsPublished] = useSyncedState(initialIsPublished);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"publish" | "unpublish" | null>(null);

  async function handle(action: "publish" | "unpublish"): Promise<void> {
    setError(null);
    setPending(action);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/help-center/articles/${articleId}/update`,
        { isPublished: action === "publish" },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern every sibling *PublishActions component uses: update the
      // rendered button set from the just-confirmed transition immediately, rather than waiting
      // on router.refresh() to reconcile it.
      setIsPublished(action === "publish");
      router.refresh();
    } catch (err) {
      console.error(`Failed to ${action} help article`, err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      {isPublished ? (
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
      ) : (
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
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
