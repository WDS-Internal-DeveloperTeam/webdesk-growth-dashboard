import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { ProjectDetail } from "@webdesk/shared-types";
import { ContentContainer, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getProjectDetail,
  objectiveStatusBadge,
  projectStatusBadge,
  roadmapItemStatusBadge,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

interface ProjectDetailPageProps {
  readonly params: Promise<{ projectId: string }>;
}

const CONFIDENTIALITY_LABEL: Readonly<Record<ProjectDetail["confidentiality"], string>> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  restricted: "Restricted",
};

/** No approved wireframe exists for a Project Detail screen — the only design reference is
 *  `module-projects-foundation.md` §8's own proposal (header + Overview/Team/Environments/
 *  Repositories/Roadmap tabs), explicitly flagged there as "not sourced... should be confirmed or
 *  corrected." This renders the same content grouping as a single scrollable page of sections
 *  instead of client-side tabs, keeping the page fully server-rendered like the rest of this app
 *  (no client component, no JS required) — a deliberate simplification, not a client-side gap.
 *  "Team" has no member-identity list (§8's proposal implies one) since no user-lookup endpoint
 *  exists yet to resolve a `userId` to a name; only the real, non-fabricated headcount is shown,
 *  same reasoning already established for `ownerUserId`/`activePhaseId` on the list page. The
 *  header's proposed pause/archive/edit actions are deliberately not built — this page is read-only,
 *  matching the list page's own precedent of shipping display-only UI before any mutation UI. */
export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { projectId } = await params;
  const detail = await getProjectDetail(projectId);
  if (!detail) {
    notFound();
  }

  const { project, roadmapItems, objectives, environments, repositories, teamCount } = detail;
  const badge = projectStatusBadge(project.status);
  const activePhase = project.activePhaseId
    ? (roadmapItems.find((item) => item.id === project.activePhaseId) ?? null)
    : null;

  return (
    <ContentContainer>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Overview</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">
            <span style={monoStyle}>{project.publicId}</span>
          </Fact>
          <Fact label="Confidentiality">{CONFIDENTIALITY_LABEL[project.confidentiality]}</Fact>
          <Fact label="Active phase">{activePhase ? activePhase.name : "None set"}</Fact>
          <Fact label="Owner">{project.ownerUserId ? "Assigned" : "Not assigned"}</Fact>
          <Fact label="Team">{teamCount === 1 ? "1 member" : `${teamCount} members`}</Fact>
          <Fact label="Created">{formatTimestamp(project.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(project.updatedAt)}</Fact>
        </dl>
        {project.description ? (
          <p style={descriptionStyle}>{project.description}</p>
        ) : (
          <p style={mutedStyle}>No description.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Roadmap</h2>
        {roadmapItems.length === 0 ? (
          <p style={mutedStyle}>No roadmap items yet.</p>
        ) : (
          <ol style={listStyle}>
            {roadmapItems.map((item) => {
              const itemBadge = roadmapItemStatusBadge(item.status);
              return (
                <li key={item.id} style={listItemStyle}>
                  <span style={sequenceStyle}>{item.sequence}</span>
                  <span style={itemLabelStyle}>{item.name}</span>
                  <StatusBadge status={itemBadge.token} label={itemBadge.label} />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Objectives</h2>
        {objectives.length === 0 ? (
          <p style={mutedStyle}>No objectives yet.</p>
        ) : (
          <ul style={listStyle}>
            {objectives.map((objective) => {
              const objectiveBadge = objectiveStatusBadge(objective.status);
              return (
                <li key={objective.id} style={listItemStyle}>
                  <span style={itemLabelStyle}>{objective.description}</span>
                  <StatusBadge status={objectiveBadge.token} label={objectiveBadge.label} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Environments</h2>
        {environments.length === 0 ? (
          <p style={mutedStyle}>No environments recorded yet.</p>
        ) : (
          <ul style={listStyle}>
            {environments.map((environment) => (
              <li key={environment.id} style={listItemStyle}>
                <span style={itemLabelStyle}>{environment.name}</span>
                {environment.url ? (
                  <a href={environment.url} target="_blank" rel="noopener noreferrer">
                    {environment.url}
                  </a>
                ) : (
                  <span style={mutedInlineStyle}>No URL set</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Repositories</h2>
        {repositories.length === 0 ? (
          <p style={mutedStyle}>No repositories recorded yet.</p>
        ) : (
          <ul style={listStyle}>
            {repositories.map((repository) => (
              <li key={repository.id} style={listItemStyle}>
                <a
                  href={`https://github.com/${repository.repoOwner}/${repository.repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {repository.repoOwner}/{repository.repoName}
                </a>
                <span style={mutedInlineStyle}>{repository.defaultBranch}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ContentContainer>
  );
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div style={factStyle}>
      <dt style={factLabelStyle}>{label}</dt>
      <dd style={factValueStyle}>{children}</dd>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  marginBottom: "2rem",
};

const h2Style: React.CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
};

const dlStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
  gap: "0.75rem 1.5rem",
  margin: "0 0 0.75rem",
};

const factStyle: React.CSSProperties = {
  margin: 0,
};

const factLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-subtle)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: 0,
};

const factValueStyle: React.CSSProperties = {
  fontSize: "0.9375rem",
  margin: "0.15rem 0 0",
};

const monoStyle: React.CSSProperties = {
  fontFamily: typographyTokens.fontFamilyMono,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
  margin: 0,
};

const mutedStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
  margin: 0,
};

const mutedInlineStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.6rem 0.75rem",
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.375rem",
  fontSize: "0.875rem",
};

const sequenceStyle: React.CSSProperties = {
  fontFamily: typographyTokens.fontFamilyMono,
  color: "var(--webdesk-dashboard-color-foreground-subtle)",
  minWidth: "1.25rem",
};

const itemLabelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: "10rem",
};
