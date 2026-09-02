import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ExportRunStatusActions } from "@/components/export-run-status-actions";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  exportRunStatusBadge,
  formatTimestamp,
  getExportRun,
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  moduleDisplayName,
} from "@/lib/import-and-export-center";
import { isSafeHttpUrl } from "@/lib/safe-http-url";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ExportRunDetailPageProps {
  readonly params: Promise<{ exportRunId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Result, Timing), the smallest honest reading of an unsourced screen. No "Edit" link
 * exists for an export run at all — there is no update route for `export_runs`, only the dedicated
 * status-transition route (`ExportRunStatusActions`, rendered in the header).
 *
 * `fileReference` is rendered as a clickable link ONLY when `isSafeHttpUrl()` passes — the backend
 * deliberately does NOT URL-validate this field server-side (same reasoning as
 * `ImportRun.sourceFileReference`), so this client-side guard is the only defense-in-depth this
 * stored value gets before ever being rendered as an `<a href>`, matching every other stored-URL
 * field in this app's own convention.
 */
export default async function ExportRunDetailPage({ params }: ExportRunDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { exportRunId } = await params;
  const run = await getExportRun(exportRunId);
  if (!run) {
    notFound();
  }

  const targetModule = session.navigation.find((module) => module.key === run.targetModuleKey);
  const badge = exportRunStatusBadge(run.status);

  return (
    <ContentContainer>
      <PageHeader
        title={run.publicId}
        breadcrumbs={[
          { label: "Import and Export Center", href: "/import-and-export-center" },
          { label: "Exports", href: "/import-and-export-center/exports" },
          { label: run.publicId },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={<ExportRunStatusActions exportRunId={run.id} status={run.status} />}
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Target module">
            {targetModule ? moduleDisplayName(targetModule) : run.targetModuleKey}
          </Fact>
          <Fact label="Format">{IMPORT_EXPORT_FILE_FORMAT_LABEL[run.format]}</Fact>
        </dl>
        <div style={{ marginTop: "0.75rem" }}>
          <span style={mutedStyle}>Filter criteria</span>
          {run.filterCriteria ? (
            <pre
              style={{
                fontSize: "0.8125rem",
                background: "var(--webdesk-dashboard-color-surface)",
                border: "1px solid var(--webdesk-dashboard-color-border)",
                borderRadius: "0.375rem",
                padding: "0.75rem",
                marginTop: "0.375rem",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(run.filterCriteria, null, 2)}
            </pre>
          ) : (
            <p style={{ ...mutedStyle, marginTop: "0.375rem" }}>Not set.</p>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Result</h2>
        <dl style={dlStyle}>
          <Fact label="Row count">{run.rowCount ?? "Not set"}</Fact>
          <Fact label="File reference">
            {run.fileReference ? (
              isSafeHttpUrl(run.fileReference) ? (
                <a href={run.fileReference} target="_blank" rel="noopener noreferrer">
                  {run.fileReference}
                </a>
              ) : (
                run.fileReference
              )
            ) : (
              "Not set"
            )}
          </Fact>
          <Fact label="Excludes confidential fields">
            {run.excludesConfidentialFields ? "Yes" : "No"}
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
        <h2 style={h2Style}>Timing</h2>
        <dl style={dlStyle}>
          <Fact label="Started">
            {run.startedAt ? formatTimestamp(run.startedAt) : "Not started"}
          </Fact>
          <Fact label="Completed">
            {run.completedAt ? formatTimestamp(run.completedAt) : "Not completed"}
          </Fact>
          <Fact label="Created">{formatTimestamp(run.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(run.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
