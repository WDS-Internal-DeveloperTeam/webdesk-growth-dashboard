"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ApiSuccessResponse, ProjectTeamEntry, UserSummary } from "@webdesk/shared-types";
import { UserPicker } from "@/components/user-picker";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { ResolvedTeamMember } from "@/lib/projects";
import styles from "./project-roster-section.module.css";

export interface ProjectTeamSectionProps {
  readonly projectId: string;
  readonly initialTeam: readonly ResolvedTeamMember[];
}

/**
 * Team roster management (Projects module gap 2, `CLAUDE.md` "Active tasks" item 13) — add/remove
 * members via `POST`/`DELETE /projects/:projectId/team`, both already built, security-reviewed,
 * and RBAC-gated on `project_configuration:edit`. Renders unconditionally rather than checking the
 * viewer's own capabilities client-side first — this app's standing pattern (`ProjectForm`'s
 * "Edit" link, `ProjectStatusActions`) is that the backend's `PermissionGuard` is the only real
 * enforcement point; an unauthorized viewer simply sees a real 403 message on submit, the same
 * degrade every other mutation control in this app already accepts.
 */
export function ProjectTeamSection({ projectId, initialTeam }: ProjectTeamSectionProps): ReactNode {
  const router = useRouter();
  const [team, setTeam] = useState(initialTeam);
  const [candidate, setCandidate] = useState<UserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleAdd(): Promise<void> {
    if (!candidate) {
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/team`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: candidate.id }),
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<ProjectTeamEntry>;
      setTeam((current) => [
        ...current,
        { id: body.data.id, addedAt: body.data.addedAt, user: candidate },
      ]);
      setCandidate(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to add team member", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(teamEntryId: string): Promise<void> {
    setError(null);
    setPendingRemoveId(teamEntryId);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/team/${teamEntryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setTeam((current) => current.filter((entry) => entry.id !== teamEntryId));
      router.refresh();
    } catch (err) {
      console.error("Failed to remove team member", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPendingRemoveId(null);
    }
  }

  return (
    <div>
      {team.length === 0 ? (
        <p className={styles.muted}>No team members yet.</p>
      ) : (
        <ul className={styles.list}>
          {team.map((entry) => (
            <li key={entry.id} className={styles.row}>
              <span className={styles.identity}>
                <span className={styles.name}>{entry.user?.displayName ?? "Unknown member"}</span>
                {entry.user ? <span className={styles.email}>{entry.user.email}</span> : null}
              </span>
              <span className={styles.meta}>Added {formatTimestamp(entry.addedAt)}</span>
              <button
                type="button"
                className={styles.removeButton}
                disabled={pendingRemoveId === entry.id}
                onClick={() => {
                  void handleRemove(entry.id);
                }}
              >
                {pendingRemoveId === entry.id ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.addRow}>
        <UserPicker
          id="team-member-picker"
          label="Add team member"
          value={candidate}
          onChange={setCandidate}
        />
        <button
          type="button"
          className={styles.addButton}
          disabled={!candidate || adding}
          onClick={() => {
            void handleAdd();
          }}
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
