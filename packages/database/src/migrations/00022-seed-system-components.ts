import { randomUUID } from "node:crypto";
import type { QueryInterface } from "sequelize";

/**
 * Seeds the real, already-approved 10-component catalog from Phase 1E
 * system-events-health brief §25's own list. No initial status rows are
 * seeded into `system_health_checks` — a component with zero recorded
 * checks correctly resolves to `"unknown"` via
 * `SystemHealthService.getCurrentStatus()`, never a fabricated `"healthy"`.
 */
const COMPONENTS: ReadonlyArray<{ key: string; name: string; description: string }> = [
  { key: "api", name: "API", description: "The dashboard-api Vercel Function itself." },
  { key: "database", name: "Database", description: "The Postgres (Neon) connection." },
  {
    key: "background_execution",
    name: "Background execution",
    description: "Job/queue execution — no permanent worker process (ADR).",
  },
  {
    key: "notification_delivery",
    name: "Notification delivery",
    description: "The notification-foundation slice's delivery adapter.",
  },
  {
    key: "integrations",
    name: "Integrations",
    description: "General third-party integration health, umbrella component.",
  },
  { key: "storage", name: "Storage", description: "Vercel Blob storage." },
  { key: "github", name: "GitHub", description: "The GitHub App integration." },
  { key: "wordpress", name: "WordPress", description: "The WordPress integration." },
  { key: "email", name: "Email", description: "Google Workspace SMTP." },
  {
    key: "queue_workflow_systems",
    name: "Queue/workflow systems",
    description: "Vercel Queues/Workflows/Cron.",
  },
];

export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const now = new Date();
  await context.bulkInsert(
    "system_components",
    COMPONENTS.map((component) => ({
      id: randomUUID(),
      key: component.key,
      display_name: component.name,
      description: component.description,
      created_at: now,
      updated_at: now,
    })),
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.bulkDelete("system_components", {
    key: COMPONENTS.map((component) => component.key),
  });
}
