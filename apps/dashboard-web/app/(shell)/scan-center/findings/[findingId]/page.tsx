import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ScanEvidenceSection } from "@/components/scan-evidence-section";
import { ScanFindingStatusActions } from "@/components/scan-finding-status-actions";
import { tolerateDiscard } from "@/lib/business-knowledge";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getProject } from "@/lib/projects";
import {
  formatTimestamp,
  getScanEvidenceForFinding,
  getScanFinding,
  getScanRun,
  scanFindingSeverityBadge,
  scanFindingStatusBadge,
  withProjectId,
} from "@/lib/scan-center";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ScanFindingDetailPageProps {
  readonly params: Promise<{ findingId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Description, Evidence, Status), rendered as sections rather than
 * client-side tabs, the same simplification every prior detail page in this app already
 * establishes.
 *
 * The parent scan run is resolved only to build the "back to run" breadcrumb/link (its own
 * `publicId` is more useful there than the run's own bare id) — its own fetch failure degrades to
 * the raw id rather than crashing this page, matching `ScanRunDetailPage`'s own identical
 * secondary-lookup precedent for its parent definition.
 */
export default async function ScanFindingDetailPage({
  params,
  searchParams,
}: ScanFindingDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { findingId } = await params;

  const findingPromise = projectIdParam
    ? tolerateDiscard(getScanFinding(projectIdParam, findingId))
    : null;
  const evidencePromise = projectIdParam
    ? tolerateDiscard(getScanEvidenceForFinding(projectIdParam, findingId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/scan-center");
  }

  const [finding, evidence] = await Promise.all([findingPromise!, evidencePromise!]);
  if (!finding) {
    notFound();
  }

  const run = await getScanRun(project.id, finding.scanRunId).catch(() => null);
  const severityBadge = scanFindingSeverityBadge(finding.severity);
  const statusBadge = scanFindingStatusBadge(finding.status);
  const runHref = withProjectId(`/scan-center/runs/${finding.scanRunId}`, project.id);

  return (
    <ContentContainer>
      <PageHeader
        title={finding.title}
        breadcrumbs={[
          { label: "Scan Center", href: withProjectId("/scan-center", project.id) },
          { label: run?.publicId ?? "Run", href: runHref },
          { label: finding.title },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={statusBadge.token} label={statusBadge.label} />}
        contextActions={
          <ScanFindingStatusActions
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
            <Link href={runHref}>{run?.publicId ?? finding.scanRunId}</Link>
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
        <h2 style={h2Style}>Evidence</h2>
        <ScanEvidenceSection
          projectId={project.id}
          findingId={finding.id}
          initialEvidence={evidence}
        />
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
