"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { withProjectId } from "@/lib/keyword-and-entity-library-query";

export interface EntityDeleteButtonProps {
  readonly projectId: string;
  readonly entityId: string;
  readonly entityName: string;
}

/**
 * Entities are the first top-level (not sub-resource) record in this app with a real hard-delete
 * route — `POST .../entities/:id/delete` (task package D3: lightweight reference records, not
 * full-lifecycle audited artifacts, unlike every other module's own archive-only precedent under
 * ADR-0016). Confirms first (the one irreversible action on this page, same "only the irreversible
 * transition confirms" precedent every status-actions component in this app already establishes),
 * then redirects to the entities list on success — there's no detail page left to stay on.
 */
export function EntityDeleteButton({
  projectId,
  entityId,
  entityName,
}: EntityDeleteButtonProps): ReactNode {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDelete(): Promise<void> {
    if (!window.confirm(`Delete "${entityName}"? This can't be undone.`)) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/keyword-and-entity-library/projects/${projectId}/entities/${entityId}/delete`,
        { method: "POST", credentials: "include" },
      );
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      router.push(withProjectId("/keyword-and-entity-library/entities", projectId));
    } catch (err) {
      console.error("Failed to delete entity", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
      <button
        type="button"
        onClick={() => {
          void handleDelete();
        }}
        disabled={pending}
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--webdesk-dashboard-color-danger)",
          background: "none",
          border: "1px solid var(--webdesk-dashboard-color-danger)",
          borderRadius: "0.25rem",
          padding: "0.4rem 0.9rem",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <span
          role="alert"
          style={{ fontSize: "0.75rem", color: "var(--webdesk-dashboard-color-danger)" }}
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}
