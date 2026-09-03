"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { NotificationDeliveryState } from "@webdesk/shared-types";
import { postMutation } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";

export interface NotificationRetryActionProps {
  readonly notificationId: string;
  readonly deliveryState: NotificationDeliveryState;
  readonly retryEligible: boolean;
}

const RETRYABLE_STATES: ReadonlySet<NotificationDeliveryState> = new Set(["queued", "retrying"]);

/**
 * `POST /notifications/:id/attempt-delivery` — no body, mirrors `NotificationService.attemptDelivery()`'s
 * own guard (`deliveryState` must be `queued`/`retrying`). Only ever renders one button; unlike a
 * real status-transition component, there's no menu of legal next states to choose from — the
 * backend decides the outcome from the (currently always-rejecting) delivery adapter, this button
 * only triggers the attempt.
 *
 * Real SMTP delivery is out of scope for this phase (`UnconfiguredNotificationDeliveryAdapter`
 * always rejects) — a retry here will end in `retrying`/`permanently_failed` again, never a genuine
 * send. The button stays honest about that rather than implying otherwise.
 */
export function NotificationRetryAction({
  notificationId,
  deliveryState,
  retryEligible,
}: NotificationRetryActionProps): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!RETRYABLE_STATES.has(deliveryState) || !retryEligible) {
    return null;
  }

  async function handleRetry(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const result = await postMutation(
        `${getApiBaseUrl()}/notifications/${notificationId}/attempt-delivery`,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to attempt notification delivery", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleRetry()}
        style={{
          padding: "0.4rem 0.9rem",
          border: "1px solid var(--webdesk-dashboard-color-border)",
          borderRadius: "0.25rem",
          background: "var(--webdesk-dashboard-color-surface)",
          fontSize: "0.875rem",
          cursor: pending ? "default" : "pointer",
        }}
      >
        {pending ? "…" : "Attempt delivery"}
      </button>
      {error ? (
        <p
          role="alert"
          style={{ fontSize: "0.8125rem", color: "var(--webdesk-dashboard-color-danger)" }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
