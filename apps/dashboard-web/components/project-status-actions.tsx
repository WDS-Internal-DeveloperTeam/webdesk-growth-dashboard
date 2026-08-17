"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Project } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./project-status-actions.module.css";

type ProjectStatus = Project["status"];

export interface ProjectStatusActionsProps {
  readonly projectId: string;
  readonly status: ProjectStatus;
}

/** Mirrors `ALLOWED_TRANSITIONS` in apps/dashboard-api/src/projects/project.service.ts (D2) — kept
 *  in sync by hand, same approach every other client-side mirror of a backend contract in this app
 *  already uses. `archived` is terminal: once set, this component renders no actions at all. */
const ALLOWED_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: [],
};

/** Labels the action that REACHES the given status, not the status itself — e.g. the button that
 *  moves a project to "paused" reads "Pause", not "Set to paused". */
const ACTION_LABEL: Readonly<Record<ProjectStatus, string>> = {
  active: "Resume",
  paused: "Pause",
  archived: "Archive",
};

/** Only the archive transition is confirmed — it's the one transition this state machine can never
 *  reverse (`ALLOWED_TRANSITIONS.archived` is empty), unlike pause/resume which freely toggle. */
const CONFIRM_MESSAGE: Partial<Record<ProjectStatus, string>> = {
  archived: "Archive this project? Archived projects can't be reactivated.",
};

/**
 * Status-transition actions for the Project Detail page's header — D2's own two named actions
 * (`module-projects-foundation.md` §7): pause/resume and archive. Renders only the transitions
 * `POST /projects/:projectId/status` would actually accept from the project's current status, so
 * an invalid-transition response from the backend is unreachable through this UI in normal use
 * (the endpoint's own validation remains the authoritative check either way).
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"`, the same pattern every
 * other mutation in this app uses (`components/project-form.tsx`) — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header. On success, calls
 * `router.refresh()` rather than navigating away, since the user is already looking at the one
 * page a status change is relevant to.
 */
export function ProjectStatusActions({ projectId, status }: ProjectStatusActionsProps): ReactNode {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ProjectStatus | null>(null);

  const targets = ALLOWED_TRANSITIONS[status];
  if (targets.length === 0) {
    return null;
  }

  async function handleTransition(nextStatus: ProjectStatus): Promise<void> {
    const confirmMessage = CONFIRM_MESSAGE[nextStatus];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPending(nextStatus);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      router.refresh();
    } catch {
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
          className={target === "archived" ? styles.archiveButton : styles.actionButton}
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
