/**
 * The Integrations module foundation — persistence-layer shapes for `integrations`,
 * `integration_environments`, `webhook_events`, and `secret_metadata` (migration `00122`,
 * `docs/implementation/module-integrations.md`, module #41). Record-keeping only (D1) — no real
 * outbound calls to any external service are made anywhere in this package.
 */

export type IntegrationProvider =
  | "github"
  | "wordpress"
  | "vercel_blob"
  | "postgresql"
  | "smtp"
  | "sentry"
  | "uptime_monitor"
  | "vulnerability_scanner"
  | "upstash"
  | "other";

export type IntegrationStatus = "connected" | "disconnected" | "error" | "not_configured";

export type IntegrationVerificationResult = "success" | "failure" | "unknown";

/** The primary entity — one row per external service connection. `configReference` is a plain
 *  string describing WHERE the real secret/config lives (e.g. a Vercel env var name) — never the
 *  secret value itself, matching the module registry's own seeded confidentiality note. No hard
 *  delete — `isActive: false` is the retirement mechanism. */
export interface IntegrationEntity {
  readonly id: string;
  readonly publicId: string;
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly status: IntegrationStatus;
  readonly configReference: string | null;
  readonly notes: string | null;
  readonly lastVerifiedAt: string | null;
  readonly lastVerifiedByUserId: string | null;
  readonly lastVerificationResult: IntegrationVerificationResult | null;
  readonly lastVerificationNotes: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A real one-to-many sub-resource — a real FK `integrationId`. Real delete allowed (a config row,
 *  not a historical record needing retention). */
export interface IntegrationEnvironmentEntity {
  readonly id: string;
  readonly integrationId: string;
  readonly environmentName: string;
  readonly status: IntegrationStatus;
  readonly configReference: string | null;
  readonly notes: string | null;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type WebhookEventProcessingStatus = "received" | "processed" | "failed";

/** An append-only, queryable local delivery log — no update, no delete route/repository method
 *  exists at all. Unlike `audit_events` (ADR-0017), there is no database-level trigger enforcing
 *  this; it's an application-level append-only log, mirroring `review_decisions`' own identical,
 *  honestly-scoped phrasing. `integrationId` is nullable — an event may arrive before it can be
 *  matched to a known integration. */
export interface WebhookEventEntity {
  readonly id: string;
  readonly integrationId: string | null;
  readonly eventType: string;
  readonly receivedAt: string;
  readonly payloadSummary: string | null;
  readonly processingStatus: WebhookEventProcessingStatus;
  readonly errorMessage: string | null;
  readonly createdAt: string;
}

/** Tracks which secret exists for an integration, never the value. Real FK, `CASCADE`. */
export interface SecretMetadataEntity {
  readonly id: string;
  readonly integrationId: string;
  readonly secretName: string;
  readonly storageLocation: string;
  readonly lastRotatedAt: string | null;
  readonly rotationDueAt: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
