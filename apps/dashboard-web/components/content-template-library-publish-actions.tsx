"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ContentTemplateApprovalStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./content-template-library-publish-actions.module.css";

export interface ContentTemplatePublishActionsProps {
  readonly templateId: string;
  readonly approvalStatus: ContentTemplateApprovalStatus;
  readonly isPublished: boolean;
}

/**
 * The first real publish/unpublish control in this app — task package D1/D2
 * (`docs/task-packages/module-content-template-library.md`): `isPublished`/`publishedAt` are
 * orthogonal to `approvalStatus`, gated only inside `ContentTemplatesService.publish()` itself
 * (`approvalStatus === "approved"` required; `unpublish()` has no such gate — always offered once
 * published, even against a template that later moved to `archived`/`superseded`, D3). This
 * component mirrors that gate in its own render logic purely for UX (so a doomed request is never
 * even offered) — the backend's own `publish()`/`unpublish()` remain the real, sole enforcement
 * point, exactly like every sibling `*StatusActions` component's own relationship to its backend
 * `TRANSITIONS` table.
 *
 * Neither transition prompts a `window.confirm()`: publish is reversible via unpublish (provided
 * the template is still approved), and unpublish is itself reversible via re-publish, so neither
 * is the kind of one-way, no-going-back action this app's own `*StatusActions` components reserve
 * confirmation for (matches `archived`/`superseded`'s own precedent there).
 *
 * Renders alongside, not merged into, `ContentTemplateStatusActions` — a separate island because
 * `publish`/`unpublish` are independently-governed RBAC actions from `submit`/`review`/`approve`
 * (D1), not another `approvalStatus` transition. A known, accepted limitation shared with every
 * sibling `*StatusActions` component in this app: this component's `approvalStatus`/`isPublished`
 * props are only ever read once, at mount, into local state — a status change made via the
 * sibling `ContentTemplateStatusActions` component on the same page won't be reflected here until
 * a full navigation remounts this component, even though `router.refresh()` re-renders the Server
 * Component tree around it. Not a correctness gap: the backend's own `publish()` gate still
 * rejects a stale-state request with a clean 400, surfaced via the same error path below — only a
 * momentary UI staleness.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern every
 * mutation in this app already uses.
 */
export function ContentTemplatePublishActions({
  templateId,
  approvalStatus,
  isPublished: initialIsPublished,
}: ContentTemplatePublishActionsProps): ReactNode {
  const router = useRouter();
  const [isPublished, setIsPublished] = useState(initialIsPublished);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"publish" | "unpublish" | null>(null);

  const canPublish = approvalStatus === "approved" && !isPublished;
  const canUnpublish = isPublished;
  if (!canPublish && !canUnpublish) {
    return null;
  }

  async function handle(action: "publish" | "unpublish"): Promise<void> {
    setError(null);
    setPending(action);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/content-template-library/templates/${templateId}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      // Same batched-render pattern ContentTemplateStatusActions/PersonaStatusActions use: update
      // the rendered button set from the just-confirmed transition immediately, rather than
      // waiting on router.refresh() to reconcile it.
      setIsPublished(action === "publish");
      router.refresh();
    } catch (err) {
      console.error(`Failed to ${action} content template`, err);
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
