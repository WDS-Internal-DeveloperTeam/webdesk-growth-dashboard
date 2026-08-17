import Link from "next/link";
import { colorTokens, ContentContainer, NotConfiguredState, PageHeader } from "@webdesk/ui";
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
          title="No project-scoped data yet"
          message="The header's Project Switcher lets you pick a project, but no module yet reads that selection to filter its own data — this page and every other module still show org-wide information only."
        />
      </section>

      <section>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Available to you ({navigation.length} module{navigation.length === 1 ? "" : "s"})
        </h2>
        <p
          style={{ color: colorTokens.foregroundMuted, fontSize: "0.875rem", marginBottom: "1rem" }}
        >
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
                border: `1px solid ${colorTokens.border}`,
                borderRadius: "0.5rem",
                padding: "0.75rem 1rem",
              }}
            >
              <Link
                href={module.route}
                style={{ fontWeight: 500, color: colorTokens.foreground, textDecoration: "none" }}
              >
                {module.displayName ?? module.name}
              </Link>
              {/*
               * colorTokens.foregroundSubtle (#94a3b8) fails WCAG AA contrast (2.56:1) at this
               * font size against a white card background — a real violation axe-core caught once
               * this page finally got automated a11y coverage (previously untested, since no
               * authenticated-route coverage existed at all). foregroundMuted passes and is the
               * closest existing token to the original intent.
               */}
              <div
                style={{
                  fontSize: "0.75rem",
                  color: colorTokens.foregroundMuted,
                  marginTop: "0.25rem",
                }}
              >
                {module.featureStatus ?? module.implementationStatus}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </ContentContainer>
  );
}
