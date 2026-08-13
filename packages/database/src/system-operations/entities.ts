/**
 * The system-activity and system-health models (Phase 1E system-events-
 * health brief §24/§25) — persistence-layer shapes for `system_events`
 * (migration `00019`), `system_components` (migrations `00020`/`00021`),
 * and `system_health_checks` (migration `00022`). See
 * `docs/task-packages/phase-1e-system-events-health.md`.
 */

export type SystemEventSeverity = "critical" | "high" | "medium" | "low";

export interface SystemEventEntity {
  readonly id: string;
  readonly eventType: string;
  readonly category: string | null;
  readonly severity: SystemEventSeverity | null;
  readonly sourceApplication: string | null;
  readonly relatedEntityType: string | null;
  readonly relatedEntityId: string | null;
  readonly correlationId: string | null;
  readonly message: string;
  readonly metadata: Record<string, unknown> | null;
  readonly relatedAuditEventId: string | null;
  readonly createdAt: string;
}

export interface SystemComponentEntity {
  readonly id: string;
  readonly key: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type SystemHealthStatus =
  "unknown" | "healthy" | "degraded" | "unavailable" | "not_configured";

export interface SystemHealthCheckEntity {
  readonly id: string;
  readonly componentKey: string;
  readonly status: SystemHealthStatus;
  readonly detail: string | null;
  readonly checkedByUserId: string | null;
  readonly source: string;
  readonly correlationId: string | null;
  readonly createdAt: string;
}
