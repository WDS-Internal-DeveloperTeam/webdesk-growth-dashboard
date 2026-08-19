import { Activity, AlertTriangle, ClipboardList, GitBranch, type LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  Badge,
  Card,
  colorTokens,
  ContentContainer,
  EmptyState,
  Fact,
  IconBadge,
  NotConfiguredState,
  PageHeader,
  spacingTokens,
  statusTokens,
  typographyTokens,
} from "@webdesk/ui";
import { formatTimestamp } from "@/lib/format-timestamp";
import { moduleIcon } from "@/lib/module-icons";
import { moduleImplementationStatusBadge } from "@/lib/modules";
import { projectStatusBadge, type ProjectStatusFilter } from "@/lib/projects";
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
  fontWeight: typographyTokens.fontWeightBold,
  color: colorTokens.foreground,
  margin: 0,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: typographyTokens.fontSizeLg,
  fontWeight: typographyTokens.fontWeightSemibold,
  marginBottom: spacingTokens.sm,
};

function WidgetCard({
  title,
  icon: Icon,
  children,
}: {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly children: React.ReactNode;
}) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacingTokens.md,
          marginBottom: spacingTokens.md,
        }}
      >
        {/* `WidgetCard` itself runs server-side (no "use client"), so taking a component
            reference here and rendering it into a real element is safe — the element (not the
            bare function) is what actually crosses into `IconBadge`'s client boundary below. */}
        <IconBadge icon={<Icon aria-hidden="true" size={18} color={colorTokens.accent} />} />
        <h3 style={WIDGET_TITLE_STYLE}>{title}</h3>
      </div>
      {children}
    </Card>
  );
}

const PROJECT_STATUS_ORDER: readonly ProjectStatusFilter[] = ["active", "paused", "archived"];

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
        <WidgetCard title="Project Health" icon={Activity}>
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Project health will appear here once at least one project exists."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.md }}>
              <div style={{ display: "flex", gap: spacingTokens.xl }}>
                {projectCountsByStatus.map(({ status, count }) => {
                  const { token, label } = projectStatusBadge(status);
                  return (
                    <div key={status}>
                      <div
                        style={{
                          fontFamily: typographyTokens.fontFamilyDisplay,
                          fontSize: typographyTokens.fontSize2xl,
                          fontWeight: typographyTokens.fontWeightBold,
                          color: statusTokens[token],
                          lineHeight: typographyTokens.lineHeightTight,
                        }}
                      >
                        {count}
                      </div>
                      <div
                        style={{
                          fontSize: typographyTokens.fontSizeXs,
                          fontWeight: typographyTokens.fontWeightSemibold,
                          color: colorTokens.foregroundMuted,
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  );
                })}
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

        <WidgetCard title="My Work" icon={ClipboardList}>
          <EmptyState
            title="No task assignments yet"
            description="Per-user work assignments aren't tracked by any module yet."
          />
        </WidgetCard>

        <WidgetCard title="Critical Findings" icon={AlertTriangle}>
          <EmptyState
            title="No findings tracked yet"
            description="Scan and security-findings modules aren't built yet."
          />
        </WidgetCard>

        <WidgetCard title="Git/Release Status" icon={GitBranch}>
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
              <dl
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacingTokens.sm,
                  margin: 0,
                }}
              >
                <Fact label="Version">{systemStatus.release.version}</Fact>
                <Fact label="Commit">
                  <span style={{ fontFamily: typographyTokens.fontFamilyMono }}>
                    {systemStatus.release.commitShaShort}
                  </span>
                </Fact>
                {/* Not "Deployed" — this is when this one serverless Function instance's process
                    started (cold start), which can diverge from the real deploy time under
                    Vercel's warm-instance-reuse model. See ServerSessionSystemStatus.release's own
                    doc comment (lib/server-session.ts) for the full reasoning. */}
                <Fact label="Instance started">
                  {formatTimestamp(systemStatus.release.instanceStartedAt)}
                </Fact>
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
            const { Icon } = moduleIcon(module.iconReference);
            return (
              <Card key={module.key} padded={false}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacingTokens.md,
                    padding: `${spacingTokens.sm} ${spacingTokens.md}`,
                  }}
                >
                  <IconBadge
                    icon={<Icon aria-hidden="true" size={16} color={colorTokens.accent} />}
                    size={36}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: spacingTokens.xs }}>
                    <Link
                      href={module.route}
                      style={{
                        fontWeight: typographyTokens.fontWeightSemibold,
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
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </ContentContainer>
  );
}
