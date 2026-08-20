"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { BusinessKnowledgeRecordStatus } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./business-knowledge-status-actions.module.css";

export interface BusinessKnowledgeStatusActionsProps {
  readonly recordId: string;
  readonly status: BusinessKnowledgeRecordStatus;
}

/** Mirrors `ALLOWED_TRANSITIONS` in
 *  `apps/dashboard-api/src/business-knowledge/business-knowledge-records.service.ts` — kept in
 *  sync by hand, same approach `ProjectStatusActions`'s own `ALLOWED_TRANSITIONS` mirror already
 *  uses. `deprecated` is terminal: once set, this component renders no actions at all. */
const ALLOWED_TRANSITIONS: Readonly<
  Record<BusinessKnowledgeRecordStatus, readonly BusinessKnowledgeRecordStatus[]>
> = {
  draft: ["mandatory", "advisory", "restricted", "deprecated"],
  mandatory: ["advisory", "restricted", "draft", "deprecated"],
  advisory: ["mandatory", "restricted", "draft", "deprecated"],
  restricted: ["mandatory", "advisory", "draft", "deprecated"],
  deprecated: [],
};

/** Labels the action that REACHES the given status, not the status itself — same convention
 *  `ProjectStatusActions.ACTION_LABEL` already establishes. */
const ACTION_LABEL: Readonly<Record<BusinessKnowledgeRecordStatus, string>> = {
  mandatory: "Approve as Mandatory",
  advisory: "Approve as Advisory",
  restricted: "Restrict",
  draft: "Send to Draft",
  deprecated: "Deprecate",
};

/** Only the deprecate transition is confirmed — it's the one transition this state machine can
 *  never reverse (`ALLOWED_TRANSITIONS.deprecated` is empty), matching `ProjectStatusActions`'s own
 *  "only the irreversible transition prompts a confirm" precedent. */
const CONFIRM_MESSAGE: Partial<Record<BusinessKnowledgeRecordStatus, string>> = {
  deprecated: "Deprecate this record? Deprecated records can't be reactivated.",
};

/**
 * Status-transition actions for the record detail page's header — draft/mandatory/advisory/
 * restricted/deprecated (task package D4). Renders only the transitions
 * `POST /business-knowledge/records/:id/status` would actually accept from the record's current
 * status, so an invalid-transition response is unreachable through this UI in normal use — the
 * endpoint's own validation remains the authoritative check either way. A concurrent status change
 * elsewhere (the backend's atomic compare-and-swap losing a race) surfaces as a real `409`, shown
 * via the same `parseApiErrorMessage()` allowlist every other mutation in this app uses.
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"`, the same pattern
 * `ProjectStatusActions`/`components/project-form.tsx` already use — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header.
 */
export function BusinessKnowledgeStatusActions({
  recordId,
  status: initialStatus,
}: BusinessKnowledgeStatusActionsProps): ReactNode {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BusinessKnowledgeRecordStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status] ?? [];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: BusinessKnowledgeRecordStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/business-knowledge/records/${recordId}/status`,
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
      // Same batched-render pattern ProjectStatusActions uses: update the rendered button set from
      // the just-confirmed transition immediately, rather than waiting on router.refresh() to
      // reconcile it, so buttons never re-enable against the stale pre-transition status.
      setStatus(nextStatus);
      router.refresh();
    } catch (err) {
      console.error("Failed to change business knowledge record status", err);
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
          className={target === "deprecated" ? styles.deprecateButton : styles.actionButton}
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
