"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  /** `false` when the viewer's own session couldn't resolve `GET /projects/:projectId/approvers`
   *  (gated on `users_roles:view`, the same permission `UserPicker`'s `GET /users` search needs) —
   *  used as a proxy signal so the picker isn't rendered only to 403 on the first keystroke for
   *  most roles (code-review finding, this branch). See `page.tsx`'s own doc comment for why this
   *  reuses that existing fetch instead of a new permission check. */
  readonly canSearchUsers: boolean;
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
export function ProjectTeamSection({
  projectId,
  initialTeam,
  canSearchUsers,
}: ProjectTeamSectionProps): ReactNode {
  const router = useRouter();
  const [team, setTeam] = useState(initialTeam);
  const [candidate, setCandidate] = useState<UserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Resync from fresh server props after router.refresh() — this component isn't remounted
  // (no key change), so useState's initial value alone would never see the updated roster.
  useEffect(() => {
    setTeam(initialTeam);
  }, [initialTeam]);

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
    setPendingRemoveIds((current) => new Set(current).add(teamEntryId));
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
      setPendingRemoveIds((current) => {
        const next = new Set(current);
        next.delete(teamEntryId);
        return next;
      });
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
                disabled={pendingRemoveIds.has(entry.id)}
                onClick={() => {
                  void handleRemove(entry.id);
                }}
              >
                {pendingRemoveIds.has(entry.id) ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {canSearchUsers ? (
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
      ) : (
        <p className={styles.muted}>Your role can&apos;t search for people to add to this team.</p>
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
