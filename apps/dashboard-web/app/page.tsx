/**
 * Placeholder dashboard shell — Phase 1A. Not final navigation, not a real
 * dashboard module (those are separately authorized — see
 * docs/phase-plans/phase-1-foundation-plan.md).
 */
export default function DashboardShellPage() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>WebDesk Growth Dashboard</h1>
      <p>
        Phase 1A foundation — repository and monorepo scaffold only. No business modules,
        authentication, or data are implemented yet.
      </p>
      <p>
        <a href="/health">View service health</a>
      </p>
    </main>
  );
}
