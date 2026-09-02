import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { CreateImportRunButton } from "@/components/create-import-run-button";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getImportRuns,
  getImportTemplate,
  IMPORT_DUPLICATE_STRATEGY_LABEL,
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  importRunStatusBadge,
  moduleDisplayName,
  parseImportRunsSearchParams,
} from "@/lib/import-and-export-center";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface ImportTemplateDetailPageProps {
  readonly params: Promise<{ templateId: string }>;
}

const RECENT_RUNS_LIMIT = 10;

/**
 * No approved wireframe exists for this module — sections mirror the backend's own field grouping
 * (Identity, Column mapping, Create a run, Recent runs), the smallest honest reading of an
 * unsourced screen, matching every sibling module's own precedent.
 *
 * `createdBy`/`updatedBy` are resolved via `getUsersByIds()`, which already degrades a resolution
 * failure (most roles lack `users_roles:view`) to a missing map entry rather than throwing,
 * matching `ReadyForClaudeTaskDetailPage`'s own precedent. "Recent runs" is a best-effort,
 * unpaginated sub-list (`getImportRuns()` at `RECENT_RUNS_LIMIT`) — a failure there would crash
 * the whole page under `getImportRuns()`'s own "never degrade silently" contract (matching every
 * sibling module's own primary-list-fetch precedent for the list PAGE), so this sub-fetch is
 * wrapped in a try/catch here specifically, degrading to an empty section on failure rather than
 * losing the whole template detail page to a transient runs-list outage.
 */
export default async function ImportTemplateDetailPage({ params }: ImportTemplateDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { templateId } = await params;
  const template = await getImportTemplate(templateId);
  if (!template) {
    notFound();
  }

  const userIds = [template.createdBy, template.updatedBy].filter(
    (id): id is string => id !== null,
  );
  let recentRuns: Awaited<ReturnType<typeof getImportRuns>>["items"] = [];
  try {
    const result = await getImportRuns({
      ...parseImportRunsSearchParams({}),
      importTemplateId: template.id,
      pageSize: RECENT_RUNS_LIMIT,
    });
    recentRuns = result.items;
  } catch (error) {
    console.error(`Failed to load recent runs for import template ${template.id}:`, error);
  }
  const users = await getUsersByIds(userIds);
  const userLabel = (userId: string | null): string =>
    userId ? (users.get(userId)?.displayName ?? userId) : "Not set";

  const targetModule = session.navigation.find((module) => module.key === template.targetModuleKey);

  return (
    <ContentContainer>
      <PageHeader
        title={template.name}
        breadcrumbs={[
          { label: "Import and Export Center", href: "/import-and-export-center" },
          { label: template.name },
        ]}
        linkComponent={Link}
        statusBadge={
          template.isActive ? (
            <StatusBadge status="healthy" label="Active" />
          ) : (
            <StatusBadge status="notConfigured" label="Inactive" />
          )
        }
        contextActions={
          <Link
            href={`/import-and-export-center/templates/${template.id}/edit`}
            style={primaryActionLinkStyle}
          >
            Edit
          </Link>
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Public ID">{template.publicId}</Fact>
          <Fact label="Target module">
            {targetModule ? moduleDisplayName(targetModule) : template.targetModuleKey}
          </Fact>
          <Fact label="File format">{IMPORT_EXPORT_FILE_FORMAT_LABEL[template.fileFormat]}</Fact>
          <Fact label="Default duplicate strategy">
            {IMPORT_DUPLICATE_STRATEGY_LABEL[template.duplicateStrategyDefault]}
          </Fact>
          <Fact label="Version">{template.version}</Fact>
          <Fact label="Created by">{userLabel(template.createdBy)}</Fact>
          <Fact label="Updated by">{userLabel(template.updatedBy)}</Fact>
          <Fact label="Created">{formatTimestamp(template.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(template.updatedAt)}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Column mapping</h2>
        {template.columnMapping ? (
          <pre
            style={{
              fontSize: "0.8125rem",
              background: "var(--webdesk-dashboard-color-surface)",
              border: "1px solid var(--webdesk-dashboard-color-border)",
              borderRadius: "0.375rem",
              padding: "0.75rem",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(template.columnMapping, null, 2)}
          </pre>
        ) : (
          <p style={mutedStyle}>Not set.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Create a run</h2>
        <CreateImportRunButton
          importTemplateId={template.id}
          isTemplateActive={template.isActive}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Recent runs</h2>
        {recentRuns.length === 0 ? (
          <p style={mutedStyle}>No runs yet for this template.</p>
        ) : (
          <>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: "0.875rem" }}>
              {recentRuns.map((run) => {
                const badge = importRunStatusBadge(run.status);
                return (
                  <li
                    key={run.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid var(--webdesk-dashboard-color-border)",
                    }}
                  >
                    <Link href={`/import-and-export-center/runs/${run.id}`}>{run.publicId}</Link>
                    <StatusBadge status={badge.token} label={badge.label} />
                    <span style={mutedStyle}>{run.isDryRun ? "Dry run" : "Real import"}</span>
                    <span style={mutedStyle}>Updated {formatTimestamp(run.updatedAt)}</span>
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/import-and-export-center/runs?importTemplateId=${template.id}`}
              style={{ fontSize: "0.875rem" }}
            >
              View all runs for this template
            </Link>
          </>
        )}
      </section>
    </ContentContainer>
  );
}
