import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { ImportRunStatusActions } from "@/components/import-run-status-actions";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getImportRun,
  getImportRunErrors,
  getImportRunRows,
  getImportTemplate,
  IMPORT_DUPLICATE_STRATEGY_LABEL,
  IMPORT_ROW_RESOLUTION_LABEL,
  importRowStatusBadge,
  importRunStatusBadge,
} from "@/lib/import-and-export-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ImportRunDetailPageProps {
  readonly params: Promise<{ runId: string }>;
}

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Counts, Timing, Rows, Errors, Failure & rollback), the smallest honest reading of an
 * unsourced screen. No "Edit" link exists for a run at all — confirmed directly against
 * `import-runs.controller.ts`: there is no update route for `import_runs`, only the dedicated
 * status-transition route (`ImportRunStatusActions`, rendered in the header alongside the status
 * badge).
 *
 * `template` (for the "Identity" section's own link back) and the run's own `rows`/`errors` are
 * all fetched via functions that degrade to `null`/an empty array on failure rather than throwing
 * — a transient outage in any of these secondary lookups must not crash the whole run detail page,
 * matching `getScanRunsForDefinition()`'s own precedent.
 */
export default async function ImportRunDetailPage({ params }: ImportRunDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { runId } = await params;
  const run = await getImportRun(runId);
  if (!run) {
    notFound();
  }

  const [template, rows, errors] = await Promise.all([
    getImportTemplate(run.importTemplateId),
    getImportRunRows(run.id),
    getImportRunErrors(run.id),
  ]);

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const badge = importRunStatusBadge(run.status);

  return (
    <ContentContainer>
      <PageHeader
        title={run.publicId}
        breadcrumbs={[
          { label: "Import and Export Center", href: "/import-and-export-center" },
          { label: "Runs", href: "/import-and-export-center/runs" },
          { label: run.publicId },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={badge.token} label={badge.label} />}
        contextActions={
          <ImportRunStatusActions runId={run.id} status={run.status} isDryRun={run.isDryRun} />
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Template">
            {template ? (
              <Link href={`/import-and-export-center/templates/${template.id}`}>
                {template.name}
              </Link>
            ) : (
              run.importTemplateId
            )}
          </Fact>
          <Fact label="Template version (snapshot)">{run.templateVersion}</Fact>
          <Fact label="Dry run">{run.isDryRun ? "Yes" : "No"}</Fact>
          <Fact label="Duplicate strategy">
            {run.duplicateStrategy
              ? IMPORT_DUPLICATE_STRATEGY_LABEL[run.duplicateStrategy]
              : "Uses template default"}
          </Fact>
          <Fact label="Source file reference">{run.sourceFileReference ?? "Not set"}</Fact>
          <Fact label="Source checksum">{run.sourceChecksum ?? "Not set"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Counts</h2>
        <dl style={dlStyle}>
          <Fact label="Total rows">{run.totalRows}</Fact>
          <Fact label="Success">{run.successCount}</Fact>
          <Fact label="Errors">{run.errorCount}</Fact>
          <Fact label="Skipped">{run.skippedCount}</Fact>
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
          <Fact label="Created">{formatTimestamp(run.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(run.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Rows</h2>
        {rows.length === 0 ? (
          <p style={mutedStyle}>No rows recorded for this run.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Row #</th>
                  <th style={thStyle}>External ID</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Resolution</th>
                  <th style={thStyle}>Raw data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowBadge = importRowStatusBadge(row.status);
                  return (
                    <tr key={row.id}>
                      <td style={tdStyle}>{row.rowNumber}</td>
                      <td style={tdStyle}>{row.externalId ?? "—"}</td>
                      <td style={tdStyle}>
                        <StatusBadge status={rowBadge.token} label={rowBadge.label} />
                      </td>
                      <td style={tdStyle}>
                        {row.resolution ? IMPORT_ROW_RESOLUTION_LABEL[row.resolution] : "—"}
                      </td>
                      <td style={tdStyle}>
                        {row.rawData ? (
                          <details>
                            <summary style={{ cursor: "pointer" }}>View</summary>
                            <pre
                              style={{
                                fontSize: "0.75rem",
                                marginTop: "0.375rem",
                                maxWidth: "24rem",
                                overflowX: "auto",
                              }}
                            >
                              {JSON.stringify(row.rawData, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Errors</h2>
        {errors.length === 0 ? (
          <p style={mutedStyle}>No errors recorded for this run.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem" }}>
            {errors.map((entry) => {
              const row = entry.importRowId ? rowsById.get(entry.importRowId) : null;
              return (
                <li key={entry.id} style={{ marginBottom: "0.5rem" }}>
                  <span>{entry.message}</span>
                  {entry.errorCode ? <span style={mutedStyle}> ({entry.errorCode})</span> : null}
                  {entry.fieldName ? (
                    <span style={mutedStyle}> — field: {entry.fieldName}</span>
                  ) : null}
                  {row ? <span style={mutedStyle}> — row #{row.rowNumber}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {run.errorSummary || run.rollbackNotes ? (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Failure &amp; rollback</h2>
          {run.errorSummary ? (
            <div style={{ marginBottom: "0.75rem" }}>
              <span style={mutedStyle}>Error summary</span>
              <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>{run.errorSummary}</p>
            </div>
          ) : null}
          {run.rollbackNotes ? (
            <div>
              <span style={mutedStyle}>Rollback notes</span>
              <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>{run.rollbackNotes}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </ContentContainer>
  );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "0.5rem 0.6rem",
  borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-subtle)",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "0.5rem 0.6rem",
  borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
  verticalAlign: "top" as const,
};
