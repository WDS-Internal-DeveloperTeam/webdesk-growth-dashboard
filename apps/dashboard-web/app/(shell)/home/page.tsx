import Link from "next/link";
import { ContentContainer, NotConfiguredState, PageHeader } from "@webdesk/ui";
import { getServerSession } from "@/lib/server-session";

/**
 * Shell-level Home landing page (Phase 1F brief §34) — safe, real,
 * registry-derived information only. Explicitly NOT business analytics:
 * no traffic/SEO/lead/AI-citation/approval/scan/revenue numbers, since no
 * real records exist for any of that yet (those modules aren't built).
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession();
  // The (shell) layout already redirects unauthenticated callers to sign-in
  // before this page renders — this is a defensive fallback, not the real guard.
  if (!session) {
    return null;
  }

  const { navigation } = session;

  return (
    <ContentContainer>
      <PageHeader title={`Welcome, ${session.me.displayName}`} />

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Project context
        </h2>
        <NotConfiguredState
          title="No project selected"
          message="The Projects module hasn't been built yet, so there's no project context to show. This will appear once Projects is implemented in a later phase."
        />
      </section>

      <section>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Available to you ({navigation.length} module{navigation.length === 1 ? "" : "s"})
        </h2>
        <p style={{ color: "#475569", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Modules are shown based on your own role and permissions. A module appearing here does not
          mean its business functionality is built yet — check its status below.
        </p>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {navigation.map((module) => (
            <li
              key={module.key}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                padding: "0.75rem 1rem",
              }}
            >
              <Link
                href={module.route}
                style={{ fontWeight: 500, color: "#0f172a", textDecoration: "none" }}
              >
                {module.displayName ?? module.name}
              </Link>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                {module.featureStatus ?? module.implementationStatus}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </ContentContainer>
  );
}
