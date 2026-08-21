import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge, typographyTokens } from "@webdesk/ui";
import { ProjectApproversSection } from "@/components/project-approvers-section";
import { ProjectEnvironmentsSection } from "@/components/project-environments-section";
import { ProjectObjectivesSection } from "@/components/project-objectives-section";
import { ProjectRepositoriesSection } from "@/components/project-repositories-section";
import { ProjectRoadmapSection } from "@/components/project-roadmap-section";
import { ProjectStatusActions } from "@/components/project-status-actions";
import { ProjectTeamSection } from "@/components/project-team-section";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { CONFIDENTIALITY_LABEL } from "@/lib/project-confidentiality";
import { formatTimestamp, getProjectDetail, projectStatusBadge } from "@/lib/projects";
import { getApproverRoleId } from "@/lib/roles";
import { sanitizeRenderedHtml } from "@/lib/sanitize-html";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ProjectDetailPageProps {
  readonly params: Promise<{ projectId: string }>;
}

/** No approved wireframe exists for a Project Detail screen — the only design reference is
 *  `module-projects-foundation.md` §8's own proposal (header + Overview/Team/Environments/
 *  Repositories/Roadmap tabs), explicitly flagged there as "not sourced... should be confirmed or
 *  corrected." This renders the same content grouping as a single scrollable page of sections
 *  instead of client-side tabs — a deliberate simplification, not a client-side gap, and it keeps
 *  most sections below the header free of client state. Team and Approvers are now real
 *  roster-management sections (`ProjectTeamSection`/`ProjectApproversSection`, small client
 *  islands, `CLAUDE.md` "Active tasks" item 13 gaps 2/3) — user identities resolve via `GET
 *  /users/:userId` (`lib/users.ts#getUsersByIds`), the capability that was missing when this page
 *  was first built. Approvers renders only when the viewer holds `users_roles:view` (the
 *  permission `GET .../approvers` itself requires) — see `ProjectDetailData.approvers`'s own doc
 *  comment. An "Edit" action links to `/projects/:id/edit` (name/description/confidentiality
 *  only); pause/resume/archive actions (D2's own state machine — `archived` is terminal) are a
 *  small client island (`ProjectStatusActions`) rendered alongside it. */
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

  const { project, roadmapItems, objectives, environments, repositories, team, approvers } = detail;
  // approvers is non-null only when the viewer holds users_roles:view — the same permission
  // getApproverRoleId()'s own GET /authz/roles call needs, and the same permission UserPicker's
  // GET /users search needs. Gating both on this one already-resolved signal avoids a wasted
  // fetch (and a picker that would 403 on first keystroke) for the majority of viewers who don't
  // hold it (code-review findings, this branch).
  const approverRoleId = approvers ? await getApproverRoleId() : null;
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
        contextActions={
          <>
            <ProjectStatusActions projectId={project.id} status={project.status} />
            <Link href={`/projects/${project.id}/edit`} style={primaryActionLinkStyle}>
              Edit
            </Link>
          </>
        }
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
          <Fact label="Created">{formatTimestamp(project.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(project.updatedAt)}</Fact>
        </dl>
        {project.description ? (
          <div
            style={descriptionStyle}
            // Sanitized twice: dashboard-api's own write-time pass (project.service.ts's
            // sanitizeLongTextField()) before this was ever stored, and again here at render
            // time as defense-in-depth (lib/sanitize-html.ts) — same double-sanitization pattern
            // Business Knowledge Center's own content field already establishes.
            dangerouslySetInnerHTML={{ __html: sanitizeRenderedHtml(project.description) }}
          />
        ) : (
          <p style={mutedStyle}>No description.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Team</h2>
        <ProjectTeamSection
          projectId={project.id}
          initialTeam={team}
          canSearchUsers={approvers !== null}
        />
      </section>

      {approvers ? (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Approvers</h2>
          <ProjectApproversSection
            projectId={project.id}
            initialApprovers={approvers}
            approverRoleId={approverRoleId}
          />
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Roadmap</h2>
        <ProjectRoadmapSection
          projectId={project.id}
          initialRoadmapItems={roadmapItems}
          initialActivePhaseId={project.activePhaseId}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Objectives</h2>
        <ProjectObjectivesSection projectId={project.id} initialObjectives={objectives} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Environments</h2>
        <ProjectEnvironmentsSection projectId={project.id} initialEnvironments={environments} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Repositories</h2>
        <ProjectRepositoriesSection projectId={project.id} initialRepositories={repositories} />
      </section>
    </ContentContainer>
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
