import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ScanRunStatusActions } from "@/components/scan-run-status-actions";
import { tolerateDiscard } from "@/lib/business-knowledge";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import { getProject } from "@/lib/projects";
import {
  formatTimestamp,
  getScanDefinition,
  getScanFindingsForRun,
  getScanRun,
  scanFindingSeverityBadge,
  scanFindingStatusBadge,
  scanRunStatusBadge,
  SCAN_RUN_TRIGGER_TYPE_LABEL,
  withProjectId,
} from "@/lib/scan-center";
import { firstValue } from "@/lib/search-params";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ScanRunDetailPageProps {
  readonly params: Promise<{ runId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Timing, Findings, Status), rendered as sections rather than
 * client-side tabs, the same simplification every prior detail page in this app already
 * establishes.
 *
 * The parent scan definition is resolved only to build the "back to definition" breadcrumb/link
 * (its own name is more useful there than the definition's own bare id) — its own fetch failure
 * degrades to the raw id rather than crashing this page, since the run itself is this page's real
 * content, not the definition's own details.
 */
export default async function ScanRunDetailPage({ params, searchParams }: ScanRunDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const rawParams = await searchParams;
  const projectIdParam = firstValue(rawParams.projectId);
  const { runId } = await params;

  const runPromise = projectIdParam ? tolerateDiscard(getScanRun(projectIdParam, runId)) : null;
  const findingsPromise = projectIdParam
    ? tolerateDiscard(getScanFindingsForRun(projectIdParam, runId))
    : null;

  const project = projectIdParam ? await getProject(projectIdParam) : null;
  if (!project) {
    redirect("/scan-center");
  }

  const [run, findings] = await Promise.all([runPromise!, findingsPromise!]);
  if (!run) {
    notFound();
  }

  const definition = await getScanDefinition(project.id, run.scanDefinitionId).catch(() => null);
  const badge = scanRunStatusBadge(run.status);
  const definitionHref = withProjectId(
    `/scan-center/definitions/${run.scanDefinitionId}`,
    project.id,
  );

  return (
    <ContentContainer>
      <PageHeader
        title={run.publicId}
        breadcrumbs={[
          { label: "Scan Center", href: withProjectId("/scan-center", project.id) },
          { label: definition?.name ?? "Definition", href: definitionHref },
          { label: run.publicId },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <ScanRunStatusActions projectId={project.id} runId={run.id} status={run.status} />
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Definition">
            <Link href={definitionHref}>{definition?.name ?? run.scanDefinitionId}</Link>
          </Fact>
          <Fact label="Trigger type">{SCAN_RUN_TRIGGER_TYPE_LABEL[run.triggerType]}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Timing</h2>
        <dl style={dlStyle}>
          <Fact label="Started">
            {run.startedAt ? formatTimestamp(run.startedAt) : "Not started"}
          </Fact>
          <Fact label="Completed">
            {run.completedAt ? formatTimestamp(run.completedAt) : "Not completed"}
          </Fact>
        </dl>
        {run.errorSummary ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Error summary</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>{run.errorSummary}</p>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Findings</h2>
        {findings.length === 0 ? (
          <p style={mutedStyle}>No findings recorded for this run.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {findings.map((finding) => {
              const severityBadge = scanFindingSeverityBadge(finding.severity);
              const statusBadge = scanFindingStatusBadge(finding.status);
              return (
                <li
                  key={finding.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
                    fontSize: "0.875rem",
                  }}
                >
                  <Link href={withProjectId(`/scan-center/findings/${finding.id}`, project.id)}>
                    {finding.title}
                  </Link>
                  <StatusBadge status={severityBadge.token} label={severityBadge.label} />
                  <StatusBadge status={statusBadge.token} label={statusBadge.label} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Created">{formatTimestamp(run.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(run.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
