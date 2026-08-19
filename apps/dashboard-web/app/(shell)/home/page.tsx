import Link from "next/link";
import {
  Badge,
  Card,
  colorTokens,
  ContentContainer,
  EmptyState,
  NotConfiguredState,
  PageHeader,
  spacingTokens,
  typographyTokens,
} from "@webdesk/ui";
import { formatTimestamp } from "@/lib/format-timestamp";
import { moduleImplementationStatusBadge } from "@/lib/modules";
import { getServerSession } from "@/lib/server-session";

/**
 * Shell-level Home landing page (Phase 1F brief §34, re-skinned per
 * `docs/design/dashboard-ui/15-representative-screen-specifications.md` §1's approved widget-grid
 * spec) — safe, real, registry-derived information only. Explicitly NOT business analytics: no
 * traffic/SEO/lead/AI-citation/approval/scan/revenue numbers, since no real records exist for any
 * of that yet (those modules aren't built). Every widget with no real data source renders
 * `EmptyState`, never a fabricated number (`00-dashboard-design-principles.md` §2.7) — "Project
 * Health" and "Git/Release Status" have one (project counts, `/health`'s own build metadata); "My
 * Work" and "Critical Findings" don't, since no per-user task or scan-findings module exists yet.
 */
export const dynamic = "force-dynamic";

const WIDGET_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: spacingTokens.lg,
  marginBottom: spacingTokens["2xl"],
};

const WIDGET_TITLE_STYLE: React.CSSProperties = {
  fontSize: typographyTokens.fontSizeLg,
  fontWeight: typographyTokens.fontWeightSemibold,
  color: colorTokens.foreground,
  margin: 0,
  marginBottom: spacingTokens.md,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: typographyTokens.fontSizeLg,
  fontWeight: typographyTokens.fontWeightSemibold,
  marginBottom: spacingTokens.sm,
};

function WidgetCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Card>
      <h3 style={WIDGET_TITLE_STYLE}>{title}</h3>
      {children}
    </Card>
  );
}

const PROJECT_STATUS_ORDER = ["active", "paused", "archived"] as const;
const PROJECT_STATUS_LABEL: Readonly<Record<(typeof PROJECT_STATUS_ORDER)[number], string>> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};
const PROJECT_STATUS_BUCKET: Readonly<
  Record<(typeof PROJECT_STATUS_ORDER)[number], "healthy" | "attention" | "neutral">
> = {
  active: "healthy",
  paused: "attention",
  archived: "neutral",
};

export default async function HomePage() {
  const session = await getServerSession();
  // The (shell) layout already redirects unauthenticated callers to sign-in
  // before this page renders — this is a defensive fallback, not the real guard.
  if (!session) {
    return null;
  }

  const { navigation, projects, systemStatus } = session;

  const projectCountsByStatus = PROJECT_STATUS_ORDER.map((status) => ({
    status,
    count: projects.filter((project) => project.status === status).length,
  }));

  return (
    <ContentContainer>
      <PageHeader title={`Welcome, ${session.me.displayName}`} />

      <div style={WIDGET_GRID_STYLE}>
        <WidgetCard title="Project Health">
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Project health will appear here once at least one project exists."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.sm }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacingTokens.sm }}>
                {projectCountsByStatus.map(({ status, count }) => (
                  <Badge
                    key={status}
                    bucket={PROJECT_STATUS_BUCKET[status]}
                    label={`${count} ${PROJECT_STATUS_LABEL[status]}`}
                  />
                ))}
              </div>
              <p
                style={{
                  fontSize: typographyTokens.fontSizeSm,
                  color: colorTokens.foregroundMuted,
                  margin: 0,
                }}
              >
                Page, approval, and Ready for Claude health will appear here once those modules are
                built.
              </p>
            </div>
          )}
        </WidgetCard>

        <WidgetCard title="My Work">
          <EmptyState
            title="No task assignments yet"
            description="Per-user work assignments aren't tracked by any module yet."
          />
        </WidgetCard>

        <WidgetCard title="Critical Findings">
          <EmptyState
            title="No findings tracked yet"
            description="Scan and security-findings modules aren't built yet."
          />
        </WidgetCard>

        <WidgetCard title="Git/Release Status">
          {systemStatus.release ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.sm }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacingTokens.sm }}>
                <Badge
                  bucket={systemStatus.isDegraded ? "attention" : "healthy"}
                  label={systemStatus.isDegraded ? "Degraded" : "Operational"}
                />
                {systemStatus.environment ? (
                  <Badge bucket="informational" label={systemStatus.environment} />
                ) : null}
              </div>
              <dl style={{ margin: 0, fontSize: typographyTokens.fontSizeSm }}>
                <div style={{ display: "flex", gap: spacingTokens.xs }}>
                  <dt style={{ color: colorTokens.foregroundMuted }}>Version</dt>
                  <dd style={{ margin: 0 }}>{systemStatus.release.version}</dd>
                </div>
                <div style={{ display: "flex", gap: spacingTokens.xs }}>
                  <dt style={{ color: colorTokens.foregroundMuted }}>Commit</dt>
                  <dd style={{ margin: 0, fontFamily: typographyTokens.fontFamilyMono }}>
                    {systemStatus.release.commitShaShort}
                  </dd>
                </div>
                <div style={{ display: "flex", gap: spacingTokens.xs }}>
                  <dt style={{ color: colorTokens.foregroundMuted }}>Deployed</dt>
                  <dd style={{ margin: 0 }}>{formatTimestamp(systemStatus.release.deployedAt)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <EmptyState
              title="Release status unavailable"
              description="dashboard-api's /health endpoint didn't return build metadata."
            />
          )}
        </WidgetCard>
      </div>

      <section style={{ marginBottom: spacingTokens["2xl"] }}>
        <h2 style={SECTION_TITLE_STYLE}>Project context</h2>
        <NotConfiguredState
          title="No project-scoped data yet"
          message="The header's Project Switcher lets you pick a project, but no module yet reads that selection to filter its own data — this page and every other module still show org-wide information only."
        />
      </section>

      <section>
        <h2 style={SECTION_TITLE_STYLE}>
          Available to you ({navigation.length} module{navigation.length === 1 ? "" : "s"})
        </h2>
        <p
          style={{
            color: colorTokens.foregroundMuted,
            fontSize: typographyTokens.fontSizeSm,
            marginBottom: spacingTokens.md,
          }}
        >
          Modules are shown based on your own role and permissions. A module appearing here does not
          mean its business functionality is built yet — check its status below.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: spacingTokens.md,
          }}
        >
          {navigation.map((module) => {
            const { bucket, label } = moduleImplementationStatusBadge(module.implementationStatus);
            return (
              <Card key={module.key}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacingTokens.sm,
                  }}
                >
                  <Link
                    href={module.route}
                    style={{
                      fontWeight: typographyTokens.fontWeightMedium,
                      color: colorTokens.foreground,
                      textDecoration: "none",
                    }}
                  >
                    {module.displayName ?? module.name}
                  </Link>
                  <Badge bucket={bucket} label={label} />
                  {module.featureStatus ? (
                    <p
                      style={{
                        fontSize: typographyTokens.fontSizeXs,
                        color: colorTokens.foregroundMuted,
                        margin: 0,
                      }}
                    >
                      {module.featureStatus}
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </ContentContainer>
  );
}
