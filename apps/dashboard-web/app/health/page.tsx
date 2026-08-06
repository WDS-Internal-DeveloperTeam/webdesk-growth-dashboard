import type { HealthCheckResult } from "@webdesk/shared-types";

/**
 * Health/status page — dashboard-web's own liveness, rendered server-side.
 * Does not call dashboard-api at Phase 1A (no NEXT_PUBLIC_API_BASE_URL
 * wiring yet) — reports only that this Next.js process itself is up.
 */
export default function HealthPage() {
  const result: HealthCheckResult = {
    status: "ok",
    service: "dashboard-web",
    timestamp: new Date().toISOString(),
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Service Health</h1>
      <dl>
        <dt>Status</dt>
        <dd>{result.status}</dd>
        <dt>Service</dt>
        <dd>{result.service}</dd>
        <dt>Timestamp</dt>
        <dd>{result.timestamp}</dd>
      </dl>
    </main>
  );
}
