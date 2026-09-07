"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./user-status-actions.module.css";

export interface UserStatusActionsProps {
  readonly userId: string;
  readonly accountStatus: "active" | "disabled";
}

/**
 * Activates or deactivates a user via `POST .../users/:userId/status` — this module's only
 * mutation, gated on `edit` (`users_roles:edit`). Only Deactivate is confirmed
 * (`window.confirm()`) — it's the one genuinely disruptive transition here, since the backend
 * revokes every one of the target's existing sessions on a real transition to `disabled`
 * (`UsersDirectoryService.updateStatus()`'s own doc comment); reactivating an already-disabled
 * account carries no equivalent risk, matching `ProjectStatusActions`'s own
 * "only the irreversible/disruptive transition gets a confirm" convention.
 *
 * A self-deactivation or last-active-Super-Admin attempt is rejected server-side (403/409) — this
 * component renders both buttons unconditionally and lets the backend's own real enforcement
 * surface as an error message via `postMutation()`, rather than guessing at that logic client-side
 * (the same "backend is the real gate, UI is convenience" convention every other status-actions
 * component in this app already follows).
 */
export function UserStatusActions({
  userId,
  accountStatus: initialAccountStatus,
}: UserStatusActionsProps): ReactNode {
  const router = useRouter();
  const [accountStatus, setAccountStatus] = useSyncedState(initialAccountStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"active" | "disabled" | null>(null);

  async function handle(target: "active" | "disabled"): Promise<void> {
    if (
      target === "disabled" &&
      !window.confirm(
        "Deactivate this user? This immediately revokes every one of their active sessions.",
      )
    ) {
      return;
    }
    setError(null);
    setPending(target);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/users-roles-and-permissions/users/${userId}/status`,
        { status: target },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAccountStatus(target);
      router.refresh();
    } catch (err) {
      console.error(`Failed to set user ${userId}'s status to "${target}"`, err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      {accountStatus === "active" ? (
        <button
          type="button"
          onClick={() => {
            void handle("disabled");
          }}
          disabled={pending !== null}
          className={styles.terminalButton}
        >
          {pending === "disabled" ? "…" : "Deactivate"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            void handle("active");
          }}
          disabled={pending !== null}
          className={styles.actionButton}
        >
          {pending === "active" ? "…" : "Activate"}
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
