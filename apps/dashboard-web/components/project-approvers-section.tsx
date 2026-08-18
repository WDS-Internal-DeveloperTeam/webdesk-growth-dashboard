"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { ApiSuccessResponse, UserSummary } from "@webdesk/shared-types";
import { UserPicker } from "@/components/user-picker";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./project-roster-section.module.css";

export interface ProjectApproversSectionProps {
  readonly projectId: string;
  readonly initialApprovers: readonly UserSummary[];
  /** `null` when `GET /authz/roles` couldn't resolve the approver role id (see
   *  `lib/roles.ts#getApproverRoleId`'s own doc comment) — removal is disabled rather than
   *  hidden in that case, since the list itself is still real, useful information. */
  readonly approverRoleId: string | null;
}

/**
 * Approver assignment (Projects module gap 3, `CLAUDE.md` "Active tasks" item 13) — assign via
 * `POST /projects/:projectId/approvers` (already built, security-reviewed,
 * `project_configuration:approve` at the route plus an internal `users_roles:edit` re-check);
 * revoke by reusing the general role-assignment endpoint,
 * `DELETE /authz/users/:userId/roles/:roleId?projectId=`, since no approver-specific revoke route
 * exists. Same unconditional-render-and-let-the-backend-403 pattern as `ProjectTeamSection` — see
 * that component's own doc comment for why this app doesn't duplicate permission logic
 * client-side.
 */
export function ProjectApproversSection({
  projectId,
  initialApprovers,
  approverRoleId,
}: ProjectApproversSectionProps): ReactNode {
  const router = useRouter();
  const [approvers, setApprovers] = useState(initialApprovers);
  const [candidate, setCandidate] = useState<UserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Resync from fresh server props after router.refresh() — this component isn't remounted
  // (no key change), so useState's initial value alone would never see the updated roster.
  useEffect(() => {
    setApprovers(initialApprovers);
  }, [initialApprovers]);

  async function handleAdd(): Promise<void> {
    if (!candidate) {
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/approvers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: candidate.id }),
      });
      if (!response.ok && response.status !== 204) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      setApprovers((current) =>
        current.some((approver) => approver.id === candidate.id)
          ? current
          : [...current, candidate],
      );
      setCandidate(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to assign approver", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: string): Promise<void> {
    if (!approverRoleId) {
      return;
    }
    setError(null);
    setPendingRemoveIds((current) => new Set(current).add(userId));
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/authz/users/${userId}/roles/${approverRoleId}?projectId=${projectId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<{ revoked: boolean }>;
      if (!body.data.revoked) {
        setError("That approver assignment was already removed.");
        return;
      }
      setApprovers((current) => current.filter((approver) => approver.id !== userId));
      router.refresh();
    } catch (err) {
      console.error("Failed to remove approver", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPendingRemoveIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  }

  return (
    <div>
      {approvers.length === 0 ? (
        <p className={styles.muted}>No approvers assigned yet.</p>
      ) : (
        <ul className={styles.list}>
          {approvers.map((approver) => (
            <li key={approver.id} className={styles.row}>
              <span className={styles.identity}>
                <span className={styles.name}>{approver.displayName}</span>
                <span className={styles.email}>{approver.email}</span>
              </span>
              <button
                type="button"
                className={styles.removeButton}
                disabled={!approverRoleId || pendingRemoveIds.has(approver.id)}
                title={approverRoleId ? undefined : "Unable to resolve the approver role right now"}
                onClick={() => {
                  void handleRemove(approver.id);
                }}
              >
                {pendingRemoveIds.has(approver.id) ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.addRow}>
        <UserPicker
          id="approver-picker"
          label="Add approver"
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
