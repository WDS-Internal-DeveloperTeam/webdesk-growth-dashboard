"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import { useSyncedState } from "@/lib/use-synced-state";
import styles from "./integration-active-toggle.module.css";

export interface IntegrationActiveToggleProps {
  readonly integrationId: string;
  readonly isActive: boolean;
}

/**
 * `POST /integrations/:id/toggle-active` — gated on the `configure` (`M`) action, the one
 * non-`super_admin`-exclusive mutation this module's RBAC mapping grants
 * `owner_growth_approver` (`docs/implementation/module-integrations.md`'s RBAC-mapping section),
 * mirroring `BrandLibraryPublishActions`'/`ContentTemplatePublishActions`' own toggle shape — a
 * single boolean, freely reversible either direction (unlike a publish/unpublish pair gated by a
 * separate approval-status workflow, `isActive` here has no such gate: `toggleActive()` accepts
 * any target value at any time), so neither direction needs a `window.confirm()`.
 *
 * `isActive` is re-synced from the server-passed prop via `useSyncedState()` — without it, a
 * toggle made in a second tab/operator wouldn't be reflected here even after
 * `router.refresh()` resolves, since React never resets `useState` from new props on its own (same
 * reasoning `BrandLibraryPublishActions`' own doc comment documents for its own `isPublished`).
 *
 * Submits via a direct browser `fetch()` with `credentials: "include"` — required for
 * `dashboard-api`'s `OriginCheckGuard` to see a real browser `Origin` header, same pattern every
 * mutation in this app already uses.
 */
export function IntegrationActiveToggle({
  integrationId,
  isActive: initialIsActive,
}: IntegrationActiveToggleProps): ReactNode {
  const router = useRouter();
  const [isActive, setIsActive] = useSyncedState(initialIsActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleToggle(): Promise<void> {
    const nextIsActive = !isActive;
    setError(null);
    setPending(true);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/integrations/${integrationId}/toggle-active`,
        { isActive: nextIsActive },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Same batched-render pattern BrandLibraryPublishActions uses: update the rendered button
      // from the just-confirmed transition immediately, rather than waiting on router.refresh() to
      // reconcile it.
      setIsActive(nextIsActive);
      router.refresh();
    } catch (err) {
      console.error("Failed to toggle integration active state", err);
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
          void handleToggle();
        }}
        disabled={pending}
        className={isActive ? styles.deactivateButton : styles.actionButton}
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
