import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { TechnicalFindingStatusActions } from "@/components/technical-finding-status-actions";
import { tolerateDiscard } from "@/lib/business-knowledge";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getProject } from "@/lib/projects";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";
import {
  formatTimestamp,
  getTechnicalCheckRun,
  getTechnicalFinding,
  technicalFindingSeverityBadge,
  technicalFindingStatusBadge,
  withProjectId,
} from "@/lib/technical-center";

export const dynamic = "force-dynamic";

interface TechnicalFindingDetailPageProps {
  readonly params: Promise<{ findingId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Description, Status), rendered as sections rather than
 * client-side tabs, the same simplification `ScanFindingDetailPage` (the literal structural
 * template for this module) already establishes. Unlike Scan Center, this module has no
 * `technical_evidence` table — no genuine "supporting artifact" need was identified for this
 * module's own findings — so there is deliberately no evidence section here.
 *
 * The parent technical check run is resolved only to build the "back to run" breadcrumb/link (its
 * own `publicId` is more useful there than the run's own bare id) — its own fetch failure degrades
 * to the raw id rather than crashing this page, matching `TechnicalCheckRunDetailPage`'s own
 * identical secondary-lookup precedent for its parent definition.
 */
export default async function TechnicalFindingDetailPage({
  params,
  searchParams,
}: TechnicalFindingDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { findingId } = await params;

  const findingPromise = projectIdParam
    ? tolerateDiscard(getTechnicalFinding(projectIdParam, findingId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/technical-center");
  }

  const finding = await findingPromise!;
  if (!finding) {
    notFound();
  }

  const run = await getTechnicalCheckRun(project.id, finding.technicalCheckRunId).catch(() => null);
  const severityBadge = technicalFindingSeverityBadge(finding.severity);
  const statusBadge = technicalFindingStatusBadge(finding.status);
  const runHref = withProjectId(
    `/technical-center/runs/${finding.technicalCheckRunId}`,
    project.id,
  );

  return (
    <ContentContainer>
      <PageHeader
        title={finding.title}
        breadcrumbs={[
          { label: "Technical Center", href: withProjectId("/technical-center", project.id) },
          { label: run?.publicId ?? "Run", href: runHref },
          { label: finding.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={statusBadge.token} label={statusBadge.label} />}
        contextActions={
          <TechnicalFindingStatusActions
            projectId={project.id}
            findingId={finding.id}
            status={finding.status}
          />
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{finding.publicId}</Fact>
          <Fact label="Run">
            <Link href={runHref}>{run?.publicId ?? finding.technicalCheckRunId}</Link>
          </Fact>
          <Fact label="Category">{finding.category ?? "—"}</Fact>
          <Fact label="Severity">
            <StatusBadge status={severityBadge.token} label={severityBadge.label} />
          </Fact>
          <Fact label="Location">{finding.location ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Description</h2>
        {finding.description ? (
          <p style={contentStyle}>{finding.description}</p>
        ) : (
          <p style={mutedStyle}>No description recorded.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Resolved">
            {finding.resolvedAt ? formatTimestamp(finding.resolvedAt) : "Not resolved"}
          </Fact>
          <Fact label="Created">{formatTimestamp(finding.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(finding.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}

const contentStyle = {
  fontSize: "0.9375rem",
  color: "var(--webdesk-dashboard-color-foreground)",
  whiteSpace: "pre-wrap",
  margin: 0,
} as const;
