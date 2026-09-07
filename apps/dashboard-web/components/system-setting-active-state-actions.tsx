"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./system-setting-active-state-actions.module.css";

export interface SystemSettingActiveStateActionsProps {
  readonly settingId: string;
  readonly isActive: boolean;
}

/**
 * The only lifecycle action this module has — a plain `isActive` toggle, gated on the `configure`
 * RBAC action rather than `edit` (D4), checked dynamically inside
 * `SystemSettingsService.updateActiveState()` itself; the route only requires `view` at the guard
 * level, so a caller lacking `configure` still reaches this component and can still click it — the
 * backend's own 403 (surfaced as `postMutation()`'s generic fallback message, since
 * `ForbiddenException` carries no allowlisted safe text) is the real, sole enforcement point,
 * exactly like every sibling `*StatusActions`/`*PublishActions` component's own relationship to its
 * backend gate.
 *
 * Sends the current value back as `expectedIsActive` (the backend's optional CAS guard) so a
 * concurrent toggle by a second tab/operator surfaces as a clean, safe `ConflictException` message
 * instead of silently overwriting it.
 *
 * Uses the shared `useSyncedState()` hook from the start (this module was built after it was
 * extracted) rather than hand-copying the "resync local state from a fresh prop" `useEffect`
 * pattern a 6th time.
 *
 * Submits via `postMutation()` (`credentials: "include"`, required for `dashboard-api`'s
 * `OriginCheckGuard`) — `POST /system-settings/settings/:id/active-state`.
 */
export function SystemSettingActiveStateActions({
  settingId,
  isActive: initialIsActive,
}: SystemSettingActiveStateActionsProps): ReactNode {
  const router = useRouter();
  const [isActive, setIsActive] = useSyncedState(initialIsActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handle(): Promise<void> {
    const nextIsActive = !isActive;
    setError(null);
    setPending(true);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/system-settings/settings/${settingId}/active-state`,
        { isActive: nextIsActive, expectedIsActive: isActive },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIsActive(nextIsActive);
      router.refresh();
    } catch (err) {
      console.error("Failed to change system setting active state", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        onClick={() => {
          void handle();
        }}
        disabled={pending}
        className={styles.actionButton}
      >
        {pending ? "…" : isActive ? "Deactivate" : "Activate"}
      </button>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
