"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { KnowledgeLibraryRecordStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./knowledge-library-status-actions.module.css";

export interface KnowledgeLibraryStatusActionsProps {
  readonly recordId: string;
  readonly status: KnowledgeLibraryRecordStatus;
}

/**
 * Mirrors the `ALLOWED_TRANSITIONS` table in
 * `apps/dashboard-api/src/knowledge-library/knowledge-library-records.service.ts` — kept in sync
 * by hand, same approach every sibling status-actions component in this app uses. The backend's
 * own `AuthorizationService`/`RequirePermission("approve")` check remains the authoritative gate
 * either way; a caller without the real grant still gets a clean 403, shown via the same
 * `parseApiErrorMessage()` allowlist every mutation in this app uses. `deprecated` is terminal (no
 * hard delete, ADR-0016).
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<KnowledgeLibraryRecordStatus, readonly KnowledgeLibraryRecordStatus[]>
> = {
  draft: ["mandatory", "advisory", "deprecated"],
  mandatory: ["advisory", "draft", "deprecated"],
  advisory: ["mandatory", "draft", "deprecated"],
  deprecated: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention every
 *  sibling status-actions component's `ACTION_LABEL` establishes. */
const ACTION_LABEL: Readonly<Record<KnowledgeLibraryRecordStatus, string>> = {
  mandatory: "Mark Mandatory",
  advisory: "Mark Advisory",
  draft: "Revert to Draft",
  deprecated: "Deprecate",
};

/** Only the one transition whose OWN target status is terminal (`deprecated`) prompts a
 *  confirmation, matching every sibling status-actions component's "only the irreversible
 *  transition confirms" precedent. */
const CONFIRM_MESSAGE: Partial<Record<KnowledgeLibraryRecordStatus, string>> = {
  deprecated: "Deprecate this record? Deprecated records can't be reactivated.",
};

/**
 * Status-transition actions for the Knowledge Library record detail page's header. Renders only
 * the transitions `POST /knowledge-library/records/:id/status` would actually accept from the
 * record's current status, so an invalid-transition response is unreachable through this UI in
 * normal use.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, the same pattern
 * every mutation form in this app already uses.
 */
export function KnowledgeLibraryStatusActions({
  recordId,
  status: initialStatus,
}: KnowledgeLibraryStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<KnowledgeLibraryRecordStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: KnowledgeLibraryRecordStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/knowledge-library/records/${recordId}/status`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      // Update the rendered button set from the just-confirmed transition immediately, rather
      // than waiting on router.refresh() to reconcile it, so buttons never re-enable against the
      // stale pre-transition status — same pattern every sibling status-actions component uses.
      setStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change knowledge library record status", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      {targets.map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => {
            void handleTransition(target);
          }}
          disabled={pending !== null}
          className={
            ALLOWED_TRANSITIONS[target].length === 0 ? styles.terminalButton : styles.actionButton
          }
        >
          {pending === target ? "…" : ACTION_LABEL[target]}
        </button>
      ))}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
