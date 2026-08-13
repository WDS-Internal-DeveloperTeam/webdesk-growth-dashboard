import { randomUUID } from "node:crypto";
import type { QueryInterface } from "sequelize";

/**
 * Seeds the real, already-approved retention matrix from Phase 1E
 * retention-architecture brief §20 — 25 categories, exact values. Three
 * category keys (`audit-7y`, `approval-audit-7y`, `security-log-1y`)
 * intentionally match the literal `retention_category` string values
 * `AuditService` has already been writing onto `audit_events` since the
 * original audit-foundation slice — this table becomes the single source
 * of truth those strings trace back to, not a second, competing
 * definition of the same three numbers.
 */
const POLICIES: ReadonlyArray<{
  key: string;
  name: string;
  value: number;
  unit: "days" | "years";
  anchor: string;
  description: string;
  entityType: string | null;
}> = [
  {
    key: "session-active-7d",
    name: "Active sessions",
    value: 7,
    unit: "days",
    anchor: "created_at",
    description: "Maximum lifetime of an active session.",
    entityType: "sessions",
  },
  {
    key: "session-expired-30d",
    name: "Expired sessions",
    value: 30,
    unit: "days",
    anchor: "expired_at",
    description: "Retention of session records after expiry/revocation.",
    entityType: "sessions",
  },
  {
    key: "auth-log-30d",
    name: "Authentication logs",
    value: 30,
    unit: "days",
    anchor: "created_at",
    description: "Login/logout/lockout event retention.",
    entityType: "auth_events",
  },
  {
    key: "app-log-90d",
    name: "General application logs",
    value: 90,
    unit: "days",
    anchor: "created_at",
    description: "General application/Sentry telemetry — not a Postgres table, external log store.",
    entityType: null,
  },
  {
    key: "audit-7y",
    name: "Immutable audit records",
    value: 7,
    unit: "years",
    anchor: "created_at",
    description: "General ADR-0017 audit-event retention.",
    entityType: "audit_events",
  },
  {
    key: "approval-active-1y",
    name: "Approval active records",
    value: 1,
    unit: "years",
    anchor: "created_at",
    description: "Active (non-immutable) approval workflow records — no approval table exists yet.",
    entityType: null,
  },
  {
    key: "approval-audit-7y",
    name: "Approval immutable audit",
    value: 7,
    unit: "years",
    anchor: "created_at",
    description: "Immutable approval/rejection audit-event retention.",
    entityType: "audit_events",
  },
  {
    key: "notification-30d",
    name: "Notification records",
    value: 30,
    unit: "days",
    anchor: "created_at",
    description: "Notification-record retention.",
    entityType: "notifications",
  },
  {
    key: "job-completed-30d",
    name: "Completed jobs",
    value: 30,
    unit: "days",
    anchor: "finished_at",
    description: "Job-record retention after a successful completion.",
    entityType: "jobs",
  },
  {
    key: "job-failed-120d",
    name: "Failed jobs",
    value: 120,
    unit: "days",
    anchor: "finished_at",
    description: "Job-record retention after a terminal failure.",
    entityType: "jobs",
  },
  {
    key: "scan-report-90d",
    name: "Scan reports",
    value: 90,
    unit: "days",
    anchor: "created_at",
    description: "Security/quality scan report retention — no scan table exists yet.",
    entityType: null,
  },
  {
    key: "scan-evidence-1y",
    name: "Scan evidence/screenshots",
    value: 1,
    unit: "years",
    anchor: "created_at",
    description: "Scan evidence/screenshot blob retention — no scan table exists yet.",
    entityType: null,
  },
  {
    key: "security-log-1y",
    name: "Security logs",
    value: 1,
    unit: "years",
    anchor: "created_at",
    description: "Security-exception-class audit-event retention.",
    entityType: "audit_events",
  },
  {
    key: "security-finding-closed-3y",
    name: "Closed security findings/incidents",
    value: 3,
    unit: "years",
    anchor: "closed_at",
    description:
      "Retention after a security finding/incident is closed — no findings table exists yet.",
    entityType: null,
  },
  {
    key: "malware-finding-closed-3y",
    name: "Malware findings",
    value: 3,
    unit: "years",
    anchor: "closed_at",
    description:
      "Retention after closure, specifically for malware findings — no findings table exists yet.",
    entityType: null,
  },
  {
    key: "upload-clean-90d",
    name: "Clean uploads",
    value: 90,
    unit: "days",
    anchor: "became_inactive_at",
    description:
      "Retention window after a clean upload becomes inactive — no uploads table exists yet.",
    entityType: null,
  },
  {
    key: "upload-quarantine-30d",
    name: "Rejected/infected/quarantined uploads",
    value: 30,
    unit: "days",
    anchor: "created_at",
    description:
      "Quarantine retention for rejected/infected uploads — no uploads table exists yet.",
    entityType: null,
  },
  {
    key: "import-export-artifact-7d",
    name: "Import/export files",
    value: 7,
    unit: "days",
    anchor: "created_at",
    description: "Import/export artifact file retention — no import/export table exists yet.",
    entityType: null,
  },
  {
    key: "soft-delete-30d",
    name: "Soft-deleted records",
    value: 30,
    unit: "days",
    anchor: "deleted_at",
    description:
      "Generic soft-delete retention window before permanent deletion — applies to any paranoid-mode table.",
    entityType: null,
  },
  {
    key: "db-backup-daily-35d",
    name: "Database backups (daily)",
    value: 35,
    unit: "days",
    anchor: "created_at",
    description: "Daily database backup retention — infrastructure-managed, not a Postgres table.",
    entityType: null,
  },
  {
    key: "db-backup-monthly-1y",
    name: "Database backups (monthly)",
    value: 1,
    unit: "years",
    anchor: "created_at",
    description:
      "Monthly database backup retention — infrastructure-managed, not a Postgres table.",
    entityType: null,
  },
  {
    key: "blob-backup-daily-35d",
    name: "Blob backups (daily)",
    value: 35,
    unit: "days",
    anchor: "created_at",
    description: "Daily blob storage backup retention — infrastructure-managed.",
    entityType: null,
  },
  {
    key: "blob-backup-monthly-90d",
    name: "Blob backups (monthly)",
    value: 90,
    unit: "days",
    anchor: "created_at",
    description: "Monthly blob storage backup retention — infrastructure-managed.",
    entityType: null,
  },
  {
    key: "deployment-log-30d",
    name: "Deployment logs",
    value: 30,
    unit: "days",
    anchor: "created_at",
    description: "Deployment log retention — infrastructure-managed.",
    entityType: null,
  },
  {
    key: "deployment-audit-7y",
    name: "Deployment audit records",
    value: 7,
    unit: "years",
    anchor: "created_at",
    description: "Immutable deployment/release audit-event retention.",
    entityType: "audit_events",
  },
];

export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const now = new Date();
  await context.bulkInsert(
    "retention_policies",
    POLICIES.map((policy) => ({
      id: randomUUID(),
      category_key: policy.key,
      display_name: policy.name,
      retention_value: policy.value,
      retention_unit: policy.unit,
      anchor: policy.anchor,
      description: policy.description,
      applies_to_entity_type: policy.entityType,
      created_at: now,
      updated_at: now,
    })),
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.bulkDelete("retention_policies", {
    category_key: POLICIES.map((policy) => policy.key),
  });
}
